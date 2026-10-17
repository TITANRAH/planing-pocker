import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  castVote,
  createRoom,
  getRoomState,
  joinRoom,
  newTask,
  revealRound,
  revote,
  setEstimate,
} from "@/server/room-service";
import { FakeCookieJar } from "../../helpers/fake-cookies";
import { cleanupTestData, testRoomName } from "../../helpers/test-data";

const NOW = new Date("2026-10-16T12:00:00Z");
const SEC = 1000;
const MIN = 60 * SEC;
const at = (ms: number) => new Date(NOW.getTime() + ms);
const PREFIX = testRoomName("reveal-");

afterAll(async () => {
  await cleanupTestData(PREFIX);
});

type Person = { jar: FakeCookieJar; id: string };

// Sala con moderador (Mod), Ana y Beto, y una tarea con su ronda abierta
async function setup(label: string) {
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
  const mod = { jar: modJar, id: created.data.participantId };
  const ana = await player("Ana");
  const beto = await player("Beto");
  const task = await newTask({ roomId, title: "Login" }, { jar: modJar, now: NOW });
  if (!task.ok) throw new Error(task.error);
  return { roomId, mod, ana, beto, roundId: task.data.roundId, taskId: task.data.task.id };
}

const vote = (r: { roomId: string; roundId: string }, p: Person, card: string, now = NOW) =>
  castVote({ roomId: r.roomId, roundId: r.roundId, card }, { jar: p.jar, now });

async function revealed(label: string) {
  const r = await setup(label);
  await vote(r, r.ana, "5");
  await vote(r, r.beto, "8");
  const result = await revealRound(
    { roomId: r.roomId, roundId: r.roundId },
    { jar: r.mod.jar, now: NOW },
  );
  if (!result.ok) throw new Error(result.error);
  return r;
}

describe("revealRound", () => {
  it("RF-01/RF-03: revela y guarda la foto de quienes están en la sala, con 'No votó'", async () => {
    const r = await setup("revelar");
    await vote(r, r.ana, "5");
    const result = await revealRound(
      { roomId: r.roomId, roundId: r.roundId },
      { jar: r.mod.jar, now: NOW },
    );

    expect(result).toEqual({
      ok: true,
      data: {
        roundId: r.roundId,
        entries: [
          { participantId: r.mod.id, nickname: "Mod", card: null },
          { participantId: r.ana.id, nickname: "Ana", card: "5" },
          { participantId: r.beto.id, nickname: "Beto", card: null },
        ],
      },
    });
    const round = await db.round.findUniqueOrThrow({ where: { id: r.roundId } });
    expect(round.status).toBe("REVEALED");
  });

  it("RF-12: sin votos no se puede revelar", async () => {
    const r = await setup("revelar-sin-votos");
    expect(
      await revealRound({ roomId: r.roomId, roundId: r.roundId }, { jar: r.mod.jar, now: NOW }),
    ).toEqual({
      ok: false,
      error: "NO_VOTES",
    });
  });

  it("RF-12: un jugador no puede revelar", async () => {
    const r = await setup("revelar-jugador");
    await vote(r, r.ana, "5");
    expect(
      await revealRound({ roomId: r.roomId, roundId: r.roundId }, { jar: r.ana.jar, now: NOW }),
    ).toEqual({
      ok: false,
      error: "NOT_MODERATOR",
    });
  });

  it("RF-13: un moderador retirado no puede revelar", async () => {
    const r = await setup("revelar-sin-moderador");
    await vote(r, r.ana, "5");
    expect(
      await revealRound(
        { roomId: r.roomId, roundId: r.roundId },
        { jar: r.mod.jar, now: at(3 * MIN) },
      ),
    ).toEqual({ ok: false, error: "NOT_A_PARTICIPANT" });
  });

  it("RF-02: una ronda ya revelada no se vuelve a revelar ni admite votos", async () => {
    const r = await revealed("revelar-dos-veces");
    expect(
      await revealRound({ roomId: r.roomId, roundId: r.roundId }, { jar: r.mod.jar, now: NOW }),
    ).toEqual({
      ok: false,
      error: "ROUND_CLOSED",
    });
    expect(await vote(r, r.ana, "13")).toEqual({ ok: false, error: "ROUND_CLOSED" });
  });

  it("RF-12: voto y revelado simultáneos: el voto sale en la foto o se rechaza, nunca 'ok' sin salir", async () => {
    for (let i = 0; i < 5; i++) {
      const r = await setup(`revelar-concurrente-${i}`);
      await vote(r, r.ana, "5");
      const [voted, reveal] = await Promise.all([
        vote(r, r.beto, "8"),
        revealRound({ roomId: r.roomId, roundId: r.roundId }, { jar: r.mod.jar, now: NOW }),
      ]);
      if (!reveal.ok) throw new Error(reveal.error);
      const betoCard = reveal.data.entries.find((e) => e.participantId === r.beto.id)?.card ?? null;
      if (voted.ok) expect(betoCard).toBe("8");
      else expect([voted.error, betoCard]).toEqual(["ROUND_CLOSED", null]);
    }
  }, 90_000); // 5 salas completas contra la BD remota
});

describe("setEstimate", () => {
  it("RF-07: el moderador fija la estimación (quién y cuándo) y puede cambiarla", async () => {
    const r = await revealed("estimar");
    const input = { roomId: r.roomId, roundId: r.roundId };
    expect(await setEstimate({ ...input, card: "5" }, { jar: r.mod.jar, now: NOW })).toEqual({
      ok: true,
      data: null,
    });
    expect(
      await setEstimate({ ...input, card: "8" }, { jar: r.mod.jar, now: at(10 * SEC) }),
    ).toEqual({
      ok: true,
      data: null,
    });
    const task = await db.task.findUniqueOrThrow({ where: { id: r.taskId } });
    expect(task).toMatchObject({
      estimate: "8",
      estimatedAt: at(10 * SEC),
      estimatedById: r.mod.id,
    });
  });

  it("RF-07/RF-12: no admite '?' y exige ronda revelada y moderador", async () => {
    const r = await setup("estimar-invalido");
    const input = { roomId: r.roomId, roundId: r.roundId };
    expect(await setEstimate({ ...input, card: "?" }, { jar: r.mod.jar, now: NOW })).toEqual({
      ok: false,
      error: "VALIDATION",
    });
    expect(await setEstimate({ ...input, card: "8" }, { jar: r.mod.jar, now: NOW })).toEqual({
      ok: false,
      error: "ROUND_NOT_REVEALED",
    });
    await vote(r, r.ana, "5");
    await revealRound(input, { jar: r.mod.jar, now: NOW });
    expect(await setEstimate({ ...input, card: "8" }, { jar: r.ana.jar, now: NOW })).toEqual({
      ok: false,
      error: "NOT_MODERATOR",
    });
  });
});

describe("revote", () => {
  it("RF-08: abre una ronda nueva con la misma tarea y deja la revelada como estaba", async () => {
    const r = await revealed("volver");
    const result = await revote(
      { roomId: r.roomId, roundId: r.roundId },
      { jar: r.mod.jar, now: at(10 * SEC) },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.roundId).not.toBe(r.roundId);
    expect(result.data.task.id).toBe(r.taskId);

    const old = await db.round.findUniqueOrThrow({
      where: { id: r.roundId },
      include: { entries: true },
    });
    expect(old.status).toBe("REVEALED");
    expect(old.entries).toHaveLength(3);
    const state = await getRoomState(r.roomId, { jar: r.ana.jar, now: at(10 * SEC) });
    if (!state.ok) throw new Error(state.error);
    expect(state.data.round).toEqual({ id: result.data.roundId, status: "OPEN" });
    expect(state.data).toMatchObject({ voted: [], myVote: null, entries: [], estimate: null });
  });

  it("RF-08: con estimación fijada pide confirmación y, al confirmar, la borra", async () => {
    const r = await revealed("volver-con-estimacion");
    const input = { roomId: r.roomId, roundId: r.roundId };
    await setEstimate({ ...input, card: "8" }, { jar: r.mod.jar, now: NOW });
    expect(await revote(input, { jar: r.mod.jar, now: NOW })).toEqual({
      ok: false,
      error: "ESTIMATE_PRESENT",
    });
    expect((await revote({ ...input, confirm: true }, { jar: r.mod.jar, now: at(SEC) })).ok).toBe(
      true,
    );
    expect((await db.task.findUniqueOrThrow({ where: { id: r.taskId } })).estimate).toBeNull();
  });

  it("RF-08/RF-12: exige ronda revelada y moderador", async () => {
    const r = await setup("volver-invalido");
    const input = { roomId: r.roomId, roundId: r.roundId };
    expect(await revote(input, { jar: r.mod.jar, now: NOW })).toEqual({
      ok: false,
      error: "ROUND_NOT_REVEALED",
    });
    await vote(r, r.ana, "5");
    await revealRound(input, { jar: r.mod.jar, now: NOW });
    expect(await revote(input, { jar: r.ana.jar, now: NOW })).toEqual({
      ok: false,
      error: "NOT_MODERATOR",
    });
  });
});

describe("getRoomState con ronda revelada", () => {
  it("RF-10: devuelve el estado de la ronda, la foto y la estimación", async () => {
    const r = await revealed("estado");
    await setEstimate(
      { roomId: r.roomId, roundId: r.roundId, card: "8" },
      { jar: r.mod.jar, now: NOW },
    );
    const state = await getRoomState(r.roomId, { jar: r.beto.jar, now: NOW });
    if (!state.ok) throw new Error(state.error);
    expect(state.data.round).toEqual({ id: r.roundId, status: "REVEALED" });
    expect(state.data.entries).toEqual([
      { participantId: r.mod.id, nickname: "Mod", card: null },
      { participantId: r.ana.id, nickname: "Ana", card: "5" },
      { participantId: r.beto.id, nickname: "Beto", card: "8" },
    ]);
    expect(state.data.estimate).toBe("8");
  });

  it("RF-03: quien entra después de revelar no aparece en la foto", async () => {
    const r = await revealed("estado-recien-llegado");
    const jar = new FakeCookieJar();
    expect((await joinRoom({ roomId: r.roomId, nickname: "Dani" }, { jar, now: NOW })).ok).toBe(
      true,
    );
    const state = await getRoomState(r.roomId, { jar, now: NOW });
    if (!state.ok) throw new Error(state.error);
    expect(state.data.entries.map((e) => e.nickname)).toEqual(["Mod", "Ana", "Beto"]);
  });

  it("RF-11: quien es retirado después de revelar sigue en la foto", async () => {
    const r = await revealed("estado-retirado");
    await db.participant.update({ where: { id: r.beto.id }, data: { disconnectedAt: NOW } });
    await db.participant.updateMany({
      where: { id: { in: [r.mod.id, r.ana.id] } },
      data: { lastSeenAt: at(3 * MIN) },
    });
    const state = await getRoomState(r.roomId, { jar: r.ana.jar, now: at(3 * MIN) });
    if (!state.ok) throw new Error(state.error);
    expect(state.data.participants.map((p) => p.nickname)).not.toContain("Beto");
    expect(state.data.entries.find((e) => e.nickname === "Beto")?.card).toBe("8");
  });

  it("RF-02/Art. VI: con la ronda abierta no hay foto ni cartas ajenas", async () => {
    const r = await setup("estado-abierta");
    await vote(r, r.ana, "13");
    const state = await getRoomState(r.roomId, { jar: r.beto.jar, now: NOW });
    if (!state.ok) throw new Error(state.error);
    expect(state.data.round).toEqual({ id: r.roundId, status: "OPEN" });
    expect(state.data.entries).toEqual([]);
    expect(JSON.stringify(state.data)).not.toMatch(/"13"/);
  });

  it("RF-09: tras revelar, una nueva tarea no pide confirmación y la ronda revelada se conserva", async () => {
    const r = await revealed("estado-nueva-tarea");
    const result = await newTask(
      { roomId: r.roomId, title: "Logout" },
      { jar: r.mod.jar, now: at(10 * SEC) },
    );
    expect(result.ok).toBe(true);
    const old = await db.round.findUniqueOrThrow({
      where: { id: r.roundId },
      include: { entries: true },
    });
    expect(old.status).toBe("REVEALED");
    expect(old.entries).toHaveLength(3);
  });
});

describe("broadcast reveal y estimate", () => {
  async function listen(roomId: string) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
      { auth: { persistSession: false } },
    );
    const messages: { event: string; payload: unknown }[] = [];
    const channel = supabase.channel(`room:${roomId}`);
    for (const event of ["reveal", "estimate", "task"]) {
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
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      },
      close: () => supabase.removeAllChannels(),
    };
  }

  it("RF-01/RF-07/RF-08: avisa al revelar, al fijar la estimación y al volver a votar", async () => {
    const r = await setup("bc");
    await vote(r, r.ana, "5");
    const listener = await listen(r.roomId);
    const input = { roomId: r.roomId, roundId: r.roundId };
    try {
      await revealRound(input, { jar: r.mod.jar, now: NOW });
      await setEstimate({ ...input, card: "5" }, { jar: r.mod.jar, now: NOW });
      const again = await revote({ ...input, confirm: true }, { jar: r.mod.jar, now: at(SEC) });
      if (!again.ok) throw new Error(again.error);
      await listener.waitFor(5);

      expect(listener.messages).toEqual([
        {
          event: "reveal",
          payload: {
            roundId: r.roundId,
            entries: [
              { participantId: r.mod.id, nickname: "Mod", card: null },
              { participantId: r.ana.id, nickname: "Ana", card: "5" },
              { participantId: r.beto.id, nickname: "Beto", card: null },
            ],
          },
        },
        { event: "estimate", payload: { taskId: r.taskId, roundId: r.roundId, estimate: "5" } },
        {
          event: "task",
          payload: {
            roundId: again.data.roundId,
            task: { id: r.taskId, title: "Login", detail: null },
          },
        },
        {
          event: "estimate",
          payload: { taskId: r.taskId, roundId: again.data.roundId, estimate: null },
        },
      ]);
    } finally {
      await listener.close();
    }
  });
});
