import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  castVote,
  clearVote,
  createRoom,
  editTask,
  getRoomState,
  joinRoom,
  newTask,
  resumeSession,
} from "@/server/room-service";
import { FakeCookieJar } from "../../helpers/fake-cookies";
import { cleanupTestData, testRoomName } from "../../helpers/test-data";

const NOW = new Date("2026-10-16T12:00:00Z");
const SEC = 1000;
const MIN = 60 * SEC;
const at = (ms: number) => new Date(NOW.getTime() + ms);
const PREFIX = testRoomName("voting-");

afterAll(async () => {
  await cleanupTestData(PREFIX);
});

type Person = { jar: FakeCookieJar; id: string };

// Sala con moderador (Mod) y dos jugadores (Ana y Beto)
async function room(
  label: string,
): Promise<{ roomId: string; mod: Person; ana: Person; beto: Person }> {
  const modJar = new FakeCookieJar();
  const created = await createRoom(
    { roomName: `${PREFIX}${label}`, nickname: "Mod" },
    { jar: modJar, now: NOW },
  );
  if (!created.ok) throw new Error(created.error);
  const { roomId } = created.data;
  const player = async (nickname: string): Promise<Person> => {
    const jar = new FakeCookieJar();
    const joined = await joinRoom({ roomId, nickname }, { jar, now: NOW });
    if (!joined.ok) throw new Error(joined.error);
    return { jar, id: joined.data.participantId };
  };
  return {
    roomId,
    mod: { jar: modJar, id: created.data.participantId },
    ana: await player("Ana"),
    beto: await player("Beto"),
  };
}

async function withTask(label: string) {
  const r = await room(label);
  const result = await newTask(
    { roomId: r.roomId, title: "Login con Google" },
    { jar: r.mod.jar, now: NOW },
  );
  if (!result.ok) throw new Error(result.error);
  return { ...r, roundId: result.data.roundId, taskId: result.data.task.id };
}

describe("newTask", () => {
  it("RF-01: el moderador carga una tarea y se abre una ronda", async () => {
    const r = await room("nueva");
    const result = await newTask(
      { roomId: r.roomId, title: "  Login con Google ", detail: "PP-12" },
      { jar: r.mod.jar, now: NOW },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.task).toMatchObject({ title: "Login con Google", detail: "PP-12" });
    const round = await db.round.findUniqueOrThrow({ where: { id: result.data.roundId } });
    expect(round.status).toBe("OPEN");
  });

  it("RF-01: rechaza un título inválido con VALIDATION", async () => {
    const r = await room("nueva-invalida");
    expect(await newTask({ roomId: r.roomId, title: "ab" }, { jar: r.mod.jar, now: NOW })).toEqual({
      ok: false,
      error: "VALIDATION",
    });
  });

  it("RF-08: con votos y sin confirmar, devuelve VOTES_PRESENT y no cambia nada", async () => {
    const r = await withTask("nueva-con-votos");
    await castVote(
      { roomId: r.roomId, roundId: r.roundId, card: "5" },
      { jar: r.ana.jar, now: NOW },
    );
    expect(
      await newTask({ roomId: r.roomId, title: "Logout" }, { jar: r.mod.jar, now: NOW }),
    ).toEqual({
      ok: false,
      error: "VOTES_PRESENT",
    });
    expect((await db.round.findUniqueOrThrow({ where: { id: r.roundId } })).status).toBe("OPEN");
    expect(await db.vote.count({ where: { roundId: r.roundId } })).toBe(1);
  });

  it("RF-08: al confirmar, cierra la ronda, borra sus votos y abre otra", async () => {
    const r = await withTask("nueva-confirmada");
    await castVote(
      { roomId: r.roomId, roundId: r.roundId, card: "5" },
      { jar: r.ana.jar, now: NOW },
    );
    const result = await newTask(
      { roomId: r.roomId, title: "Logout", discardVotes: true },
      { jar: r.mod.jar, now: at(10 * SEC) },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.roundId).not.toBe(r.roundId);
    const old = await db.round.findUniqueOrThrow({ where: { id: r.roundId } });
    expect(old.status).toBe("CLOSED");
    expect(await db.vote.count({ where: { roundId: r.roundId } })).toBe(0);
    expect(await db.round.count({ where: { roomId: r.roomId, status: "OPEN" } })).toBe(1);
  });

  it("RF-08: sin votos no hace falta confirmar", async () => {
    const r = await withTask("nueva-sin-votos");
    const result = await newTask(
      { roomId: r.roomId, title: "Logout" },
      { jar: r.mod.jar, now: NOW },
    );
    expect(result.ok).toBe(true);
  });

  it("RF-12: un jugador no puede cargar tareas", async () => {
    const r = await room("nueva-jugador");
    expect(
      await newTask({ roomId: r.roomId, title: "Login" }, { jar: r.ana.jar, now: NOW }),
    ).toEqual({
      ok: false,
      error: "NOT_MODERATOR",
    });
  });

  it("RF-14: un moderador retirado de la sala no puede cargar tareas", async () => {
    const r = await room("nueva-moderador-retirado");
    expect(
      await newTask({ roomId: r.roomId, title: "Login" }, { jar: r.mod.jar, now: at(3 * MIN) }),
    ).toEqual({
      ok: false,
      error: "NOT_A_PARTICIPANT",
    });
  });
});

describe("editTask", () => {
  it("RF-13: corrige título y detalle sin tocar la ronda ni los votos", async () => {
    const r = await withTask("editar");
    await castVote(
      { roomId: r.roomId, roundId: r.roundId, card: "8" },
      { jar: r.ana.jar, now: NOW },
    );
    const result = await editTask(
      { roomId: r.roomId, taskId: r.taskId, title: "Login con Google y GitHub", detail: "PP-12" },
      { jar: r.mod.jar, now: NOW },
    );
    expect(result).toEqual({
      ok: true,
      data: {
        roundId: r.roundId,
        task: { id: r.taskId, title: "Login con Google y GitHub", detail: "PP-12" },
      },
    });
    expect(await db.vote.count({ where: { roundId: r.roundId } })).toBe(1);
  });

  it("RF-12: un jugador no puede editar la tarea", async () => {
    const r = await withTask("editar-jugador");
    expect(
      await editTask(
        { roomId: r.roomId, taskId: r.taskId, title: "Otra" },
        { jar: r.ana.jar, now: NOW },
      ),
    ).toEqual({ ok: false, error: "NOT_MODERATOR" });
  });

  it("RF-13: editar una tarea que ya no es la actual devuelve ROUND_CLOSED", async () => {
    const r = await withTask("editar-vieja");
    await newTask({ roomId: r.roomId, title: "Logout" }, { jar: r.mod.jar, now: NOW });
    expect(
      await editTask(
        { roomId: r.roomId, taskId: r.taskId, title: "Otra" },
        { jar: r.mod.jar, now: NOW },
      ),
    ).toEqual({ ok: false, error: "ROUND_CLOSED" });
  });
});

describe("castVote y clearVote", () => {
  it("RF-03/RF-04: vota, cambia la carta (sigue habiendo un voto) y lo quita", async () => {
    const r = await withTask("votar");
    const deps = { jar: r.ana.jar, now: NOW };
    expect(await castVote({ roomId: r.roomId, roundId: r.roundId, card: "5" }, deps)).toEqual({
      ok: true,
      data: null,
    });
    expect(await castVote({ roomId: r.roomId, roundId: r.roundId, card: "8" }, deps)).toEqual({
      ok: true,
      data: null,
    });
    const votes = await db.vote.findMany({ where: { roundId: r.roundId } });
    expect(votes.map((v) => [v.participantId, v.card])).toEqual([[r.ana.id, "8"]]);

    expect(await clearVote({ roomId: r.roomId, roundId: r.roundId }, deps)).toEqual({
      ok: true,
      data: null,
    });
    expect(await db.vote.count({ where: { roundId: r.roundId } })).toBe(0);
  });

  it("RF-03: '?' y '☕' son votos válidos", async () => {
    const r = await withTask("votar-especiales");
    expect(
      (
        await castVote(
          { roomId: r.roomId, roundId: r.roundId, card: "?" },
          { jar: r.ana.jar, now: NOW },
        )
      ).ok,
    ).toBe(true);
    expect(
      (
        await castVote(
          { roomId: r.roomId, roundId: r.roundId, card: "☕" },
          { jar: r.beto.jar, now: NOW },
        )
      ).ok,
    ).toBe(true);
  });

  it("RF-12: una carta fuera de la baraja se rechaza y no se registra", async () => {
    const r = await withTask("votar-invalido");
    expect(
      await castVote(
        { roomId: r.roomId, roundId: r.roundId, card: "4" },
        { jar: r.ana.jar, now: NOW },
      ),
    ).toEqual({
      ok: false,
      error: "VALIDATION",
    });
    expect(await db.vote.count({ where: { roundId: r.roundId } })).toBe(0);
  });

  it("RF-09: sin tarea no se puede votar", async () => {
    const r = await room("votar-sin-tarea");
    expect(
      await castVote(
        { roomId: r.roomId, roundId: "ninguna", card: "5" },
        { jar: r.ana.jar, now: NOW },
      ),
    ).toEqual({
      ok: false,
      error: "ROUND_CLOSED",
    });
  });

  it("RF-12: votar en una ronda que ya se cerró devuelve ROUND_CLOSED", async () => {
    const r = await withTask("votar-ronda-vieja");
    await newTask({ roomId: r.roomId, title: "Logout" }, { jar: r.mod.jar, now: NOW });
    expect(
      await castVote(
        { roomId: r.roomId, roundId: r.roundId, card: "5" },
        { jar: r.ana.jar, now: NOW },
      ),
    ).toEqual({
      ok: false,
      error: "ROUND_CLOSED",
    });
  });

  it("RF-12: sin sesión en la sala no se puede votar", async () => {
    const r = await withTask("votar-sin-sesion");
    expect(
      await castVote(
        { roomId: r.roomId, roundId: r.roundId, card: "5" },
        { jar: new FakeCookieJar(), now: NOW },
      ),
    ).toEqual({ ok: false, error: "NOT_A_PARTICIPANT" });
  });
});

describe("getRoomState con votación", () => {
  it("RF-10: devuelve la tarea, la ronda, quién votó y el voto propio", async () => {
    const r = await withTask("estado");
    await castVote(
      { roomId: r.roomId, roundId: r.roundId, card: "13" },
      { jar: r.ana.jar, now: NOW },
    );
    const state = await getRoomState(r.roomId, { jar: r.ana.jar, now: NOW });
    if (!state.ok) throw new Error(state.error);
    expect(state.data.task).toEqual({ id: r.taskId, title: "Login con Google", detail: null });
    expect(state.data.round).toEqual({ id: r.roundId });
    expect(state.data.voted).toEqual([r.ana.id]);
    expect(state.data.myVote).toBe("13");
  });

  it("RF-05: el estado de Beto no contiene la carta de Ana", async () => {
    const r = await withTask("estado-secreto");
    await castVote(
      { roomId: r.roomId, roundId: r.roundId, card: "13" },
      { jar: r.ana.jar, now: NOW },
    );
    const state = await getRoomState(r.roomId, { jar: r.beto.jar, now: NOW });
    if (!state.ok) throw new Error(state.error);
    expect(state.data.voted).toEqual([r.ana.id]);
    expect(state.data.myVote).toBeNull();
    // Como valor JSON exacto: los ids aleatorios pueden contener "13" por casualidad
    const raw = JSON.stringify(state.data);
    expect(raw).not.toMatch(/"13"/);
    expect(raw).not.toContain('"card"');
  });

  it("RF-09: sin tarea, el estado no tiene ronda", async () => {
    const r = await room("estado-sin-tarea");
    const state = await getRoomState(r.roomId, { jar: r.ana.jar, now: NOW });
    if (!state.ok) throw new Error(state.error);
    expect(state.data).toMatchObject({ task: null, round: null, voted: [], myVote: null });
  });

  it("RF-11: quien votó y está desconectado hace menos de 2 min sigue en 'voted'; los expirados no", async () => {
    const r = await withTask("estado-desconectados");
    await castVote(
      { roomId: r.roomId, roundId: r.roundId, card: "5" },
      { jar: r.ana.jar, now: NOW },
    );
    await castVote(
      { roomId: r.roomId, roundId: r.roundId, card: "8" },
      { jar: r.beto.jar, now: NOW },
    );
    // Ana envió su último latido y se desconectó al minuto
    await db.participant.update({
      where: { id: r.ana.id },
      data: { lastSeenAt: at(1 * MIN), disconnectedAt: at(1 * MIN) },
    });
    await db.participant.update({ where: { id: r.beto.id }, data: { disconnectedAt: NOW } });
    await db.participant.update({ where: { id: r.mod.id }, data: { lastSeenAt: at(2 * MIN) } });

    const state = await getRoomState(r.roomId, { jar: r.mod.jar, now: at(2 * MIN + 30 * SEC) });
    if (!state.ok) throw new Error(state.error);
    expect(state.data.voted).toEqual([r.ana.id]);
  });

  it("RF-11: al volver tras ser retirado, su voto de la ronda abierta se descarta", async () => {
    const r = await withTask("estado-vuelve");
    await castVote(
      { roomId: r.roomId, roundId: r.roundId, card: "5" },
      { jar: r.ana.jar, now: NOW },
    );
    const back = await resumeSession(r.roomId, { jar: r.ana.jar, now: at(3 * MIN) });
    expect(back.ok).toBe(true);
    expect(await db.vote.count({ where: { roundId: r.roundId, participantId: r.ana.id } })).toBe(0);
  });

  it("RF-07: al recargar (sesión activa) el voto se conserva", async () => {
    const r = await withTask("estado-recarga");
    await castVote(
      { roomId: r.roomId, roundId: r.roundId, card: "21" },
      { jar: r.ana.jar, now: NOW },
    );
    expect((await resumeSession(r.roomId, { jar: r.ana.jar, now: at(30 * SEC) })).ok).toBe(true);
    const state = await getRoomState(r.roomId, { jar: r.ana.jar, now: at(30 * SEC) });
    if (!state.ok) throw new Error(state.error);
    expect(state.data.myVote).toBe("21");
  });
});

describe("broadcast task y vote", () => {
  // Escucha el canal de la sala como otro participante: guarda cada mensaje broadcast recibido
  async function listen(roomId: string) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
      { auth: { persistSession: false } },
    );
    const messages: { event: string; payload: unknown }[] = [];
    const channel = supabase.channel(`room:${roomId}`);
    for (const event of ["task", "vote"]) {
      channel.on("broadcast", { event }, ({ payload }) => messages.push({ event, payload }));
    }
    await new Promise<void>((resolve, reject) => {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") resolve();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(new Error(status));
      });
    });
    return {
      messages,
      async waitFor(count: number, timeoutMs = 5_000) {
        const start = Date.now();
        while (messages.length < count && Date.now() - start < timeoutMs) {
          await new Promise((r) => setTimeout(r, 50));
        }
      },
      close: () => supabase.removeAllChannels(),
    };
  }

  it("RF-02/RF-13: avisa con task al cargar y al editar la tarea", async () => {
    const r = await room("bc-tarea");
    const listener = await listen(r.roomId);
    try {
      const created = await newTask(
        { roomId: r.roomId, title: "Login" },
        { jar: r.mod.jar, now: NOW },
      );
      if (!created.ok) throw new Error(created.error);
      await editTask(
        { roomId: r.roomId, taskId: created.data.task.id, title: "Login con Google" },
        { jar: r.mod.jar, now: NOW },
      );
      await listener.waitFor(2);
      expect(listener.messages).toEqual([
        {
          event: "task",
          payload: {
            roundId: created.data.roundId,
            task: { id: created.data.task.id, title: "Login", detail: null },
          },
        },
        {
          event: "task",
          payload: {
            roundId: created.data.roundId,
            task: { id: created.data.task.id, title: "Login con Google", detail: null },
          },
        },
      ]);
    } finally {
      await listener.close();
    }
  });

  it("RF-06/RF-05: avisa con vote al votar y al quitar, sin la carta; cambiar de carta no avisa", async () => {
    const r = await withTask("bc-voto");
    const listener = await listen(r.roomId);
    const deps = { jar: r.ana.jar, now: NOW };
    try {
      await castVote({ roomId: r.roomId, roundId: r.roundId, card: "21" }, deps);
      await castVote({ roomId: r.roomId, roundId: r.roundId, card: "☕" }, deps);
      await clearVote({ roomId: r.roomId, roundId: r.roundId }, deps);
      await listener.waitFor(2);
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      expect(listener.messages).toEqual([
        { event: "vote", payload: { roundId: r.roundId, participantId: r.ana.id, voted: true } },
        { event: "vote", payload: { roundId: r.roundId, participantId: r.ana.id, voted: false } },
      ]);
      const raw = JSON.stringify(listener.messages);
      expect(raw).not.toContain("card");
      expect(raw).not.toMatch(/"21"/); // valor exacto: los ids aleatorios pueden contener "21"
      expect(raw).not.toContain("☕");
    } finally {
      await listener.close();
    }
  });

  it("RF-11: quien vuelve tras ser retirado avisa de que su voto se descartó", async () => {
    const r = await withTask("bc-vuelve");
    await castVote(
      { roomId: r.roomId, roundId: r.roundId, card: "5" },
      { jar: r.ana.jar, now: NOW },
    );
    const listener = await listen(r.roomId);
    try {
      expect((await resumeSession(r.roomId, { jar: r.ana.jar, now: at(3 * MIN) })).ok).toBe(true);
      await listener.waitFor(1);
      expect(listener.messages).toEqual([
        { event: "vote", payload: { roundId: r.roundId, participantId: r.ana.id, voted: false } },
      ]);
    } finally {
      await listener.close();
    }
  });
});
