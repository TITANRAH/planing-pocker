import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  createRoom,
  getRoomState,
  heartbeat,
  joinRoom,
  markDisconnected,
  renameAndResume,
  resumeSession,
  sayBye,
} from "@/server/room-service";
import { hashToken } from "@/server/token";
import { FakeCookieJar } from "../../helpers/fake-cookies";
import { cleanupTestData, testRoomName } from "../../helpers/test-data";

const NOW = new Date("2026-10-16T12:00:00Z");
const PREFIX = testRoomName("rooms-");
const SEC = 1000;
const MIN = 60 * SEC;
const at = (ms: number) => new Date(NOW.getTime() + ms);

async function newRoom(label: string, nickname = "Moderador"): Promise<string> {
  const result = await createRoom(
    { roomName: `${PREFIX}${label}`, nickname },
    { jar: new FakeCookieJar(), now: NOW },
  );
  if (!result.ok) throw new Error(result.error);
  return result.data.roomId;
}

async function join(roomId: string, nickname: string, now = NOW, jar = new FakeCookieJar()) {
  return joinRoom({ roomId, nickname }, { jar, now });
}

afterAll(async () => {
  await cleanupTestData(PREFIX);
});

describe("createRoom", () => {
  it("RF-01: crea la sala con quien la crea como moderador y le pone la cookie", async () => {
    const jar = new FakeCookieJar();
    const result = await createRoom(
      { roomName: `${PREFIX}crear`, nickname: "Ana" },
      { jar, now: NOW },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { roomId, participantId } = result.data;

    const cookie = jar.store.get(`pp_${roomId}`);
    expect(cookie?.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });

    const participant = await db.participant.findUniqueOrThrow({ where: { id: participantId } });
    expect(participant).toMatchObject({
      roomId,
      nickname: "Ana",
      nicknameKey: "ana",
      role: "MODERATOR",
    });
    // En la base de datos solo se guarda el hash del token
    expect(participant.tokenHash).toBe(hashToken(cookie?.value ?? ""));
    expect(participant.tokenHash).not.toBe(cookie?.value);
  });

  it("RF-01: recorta los espacios del nombre y del apodo", async () => {
    const jar = new FakeCookieJar();
    const result = await createRoom(
      { roomName: `  ${PREFIX}espacios  `, nickname: "  Ana " },
      { jar, now: NOW },
    );
    if (!result.ok) throw new Error(result.error);
    const room = await db.room.findUniqueOrThrow({
      where: { id: result.data.roomId },
      include: { participants: true },
    });
    expect(room.name).toBe(`${PREFIX}espacios`);
    expect(room.participants[0]?.nickname).toBe("Ana");
  });

  it("RF-01: rechaza nombre o apodo inválidos con VALIDATION y no crea nada", async () => {
    const jar = new FakeCookieJar();
    expect(await createRoom({ roomName: "ab", nickname: "Ana" }, { jar, now: NOW })).toEqual({
      ok: false,
      error: "VALIDATION",
    });
    expect(
      await createRoom({ roomName: `${PREFIX}valida`, nickname: "A" }, { jar, now: NOW }),
    ).toEqual({
      ok: false,
      error: "VALIDATION",
    });
    expect(await createRoom(null, { jar, now: NOW })).toEqual({ ok: false, error: "VALIDATION" });
    expect(jar.store.size).toBe(0);
  });
});

describe("joinRoom", () => {
  it("RF-04: entra a la sala como jugador y recibe su cookie", async () => {
    const roomId = await newRoom("unirse");
    const jar = new FakeCookieJar();
    const result = await join(roomId, "Ana", NOW, jar);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(jar.get(`pp_${roomId}`)).toBeDefined();
    const participant = await db.participant.findUniqueOrThrow({
      where: { id: result.data.participantId },
    });
    expect(participant).toMatchObject({ roomId, nickname: "Ana", role: "PLAYER" });
  });

  it("RF-04: rechaza apodos inválidos con VALIDATION", async () => {
    const roomId = await newRoom("apodo-invalido");
    expect(await join(roomId, "A")).toEqual({ ok: false, error: "VALIDATION" });
  });

  it("RF-07: una sala inexistente devuelve ROOM_NOT_FOUND", async () => {
    expect(await join("NoExiste_123", "Ana")).toEqual({ ok: false, error: "ROOM_NOT_FOUND" });
  });

  it("RF-05: un apodo en uso devuelve NICKNAME_TAKEN, sin distinguir mayúsculas ni espacios", async () => {
    const roomId = await newRoom("apodo-repetido");
    expect((await join(roomId, "Juan")).ok).toBe(true);
    expect(await join(roomId, "Juan")).toEqual({ ok: false, error: "NICKNAME_TAKEN" });
    expect(await join(roomId, "  juan ")).toEqual({ ok: false, error: "NICKNAME_TAKEN" });
    expect(await join(roomId, "JUAN")).toEqual({ ok: false, error: "NICKNAME_TAKEN" });
  });

  it("RF-05: el apodo de alguien desconectado hace menos de 2 minutos sigue reservado", async () => {
    const roomId = await newRoom("apodo-reservado");
    const first = await join(roomId, "Juan");
    if (!first.ok) throw new Error(first.error);
    await db.participant.update({
      where: { id: first.data.participantId },
      data: { disconnectedAt: at(10 * SEC) },
    });

    expect(await join(roomId, "Juan", at(1 * MIN))).toEqual({ ok: false, error: "NICKNAME_TAKEN" });
  });

  it("RF-05: el apodo de alguien expirado queda libre y se le retira", async () => {
    const roomId = await newRoom("apodo-liberado");
    const first = await join(roomId, "Juan");
    if (!first.ok) throw new Error(first.error);
    await db.participant.update({
      where: { id: first.data.participantId },
      data: { disconnectedAt: NOW },
    });

    const second = await join(roomId, "juan", at(2 * MIN + 1 * SEC));
    expect(second.ok).toBe(true);
    const old = await db.participant.findUniqueOrThrow({ where: { id: first.data.participantId } });
    expect(old.nicknameKey).toBeNull();
  });

  it("RF-05: dos personas que entran a la vez con el mismo apodo: solo una lo consigue", async () => {
    const roomId = await newRoom("apodo-simultaneo");
    const results = await Promise.all([join(roomId, "Juan"), join(roomId, "juan")]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, error: "NICKNAME_TAKEN" }]);
  });

  describe("cupo de 15", () => {
    // Llena la sala directamente en la BD (más rápido); lo que se prueba es el joinRoom siguiente
    async function fullRoom(label: string): Promise<{ roomId: string; lastId: string }> {
      const roomId = await newRoom(label); // el moderador cuenta: 1
      await db.participant.createMany({
        data: Array.from({ length: 14 }, (_, i) => ({
          roomId,
          nickname: `Jugador ${i + 2}`,
          nicknameKey: `jugador ${i + 2}`,
          role: "PLAYER" as const,
          tokenHash: `hash-${roomId}-${i}`,
          lastSeenAt: NOW,
        })),
      });
      const last = await db.participant.findFirstOrThrow({
        where: { roomId, nicknameKey: "jugador 15" },
      });
      return { roomId, lastId: last.id };
    }

    it("RF-06: con 15 participantes la sala está llena", async () => {
      const { roomId } = await fullRoom("llena");
      expect(await join(roomId, "Nuevo")).toEqual({ ok: false, error: "ROOM_FULL" });
    });

    it("RF-06: un desconectado hace menos de 2 minutos sigue ocupando su lugar", async () => {
      const { roomId, lastId } = await fullRoom("llena-reservada");
      await db.participant.update({ where: { id: lastId }, data: { disconnectedAt: NOW } });
      expect(await join(roomId, "Nuevo", at(1 * MIN))).toEqual({ ok: false, error: "ROOM_FULL" });
    });

    it("RF-06: un desconectado hace más de 2 minutos libera su lugar", async () => {
      const { roomId, lastId } = await fullRoom("llena-liberada");
      await db.participant.update({ where: { id: lastId }, data: { disconnectedAt: NOW } });
      // El resto sigue enviando latidos
      await db.participant.updateMany({
        where: { roomId, id: { not: lastId } },
        data: { lastSeenAt: at(2 * MIN) },
      });
      expect((await join(roomId, "Nuevo", at(2 * MIN + 1 * SEC))).ok).toBe(true);
    });
  });
});

describe("resumeSession y renameAndResume", () => {
  async function playerIn(label: string, nickname = "Ana") {
    const roomId = await newRoom(label);
    const jar = new FakeCookieJar();
    const result = await join(roomId, nickname, NOW, jar);
    if (!result.ok) throw new Error(result.error);
    return { roomId, jar, participantId: result.data.participantId };
  }

  it("RF-09: al recargar, una sesión activa vuelve con el mismo apodo y rol", async () => {
    const { roomId, jar, participantId } = await playerIn("reanudar");
    const result = await resumeSession(roomId, { jar, now: at(30 * SEC) });

    expect(result).toEqual({ ok: true, data: { participantId, nickname: "Ana", role: "PLAYER" } });
    const row = await db.participant.findUniqueOrThrow({ where: { id: participantId } });
    expect(row.lastSeenAt).toEqual(at(30 * SEC));
    expect(row.disconnectedAt).toBeNull();
  });

  it("RF-09: sin cookie, o con la cookie de otra sala, no es participante", async () => {
    const { jar } = await playerIn("sin-cookie-a");
    const otherRoom = await newRoom("sin-cookie-b");
    expect(await resumeSession(otherRoom, { jar: new FakeCookieJar(), now: NOW })).toEqual({
      ok: false,
      error: "NOT_A_PARTICIPANT",
    });
    expect(await resumeSession(otherRoom, { jar, now: NOW })).toEqual({
      ok: false,
      error: "NOT_A_PARTICIPANT",
    });
  });

  it("RF-06: quien no es participante y abre una sala llena recibe ROOM_FULL", async () => {
    const roomId = await newRoom("abrir-llena");
    await db.participant.createMany({
      data: Array.from({ length: 14 }, (_, i) => ({
        roomId,
        nickname: `Otro ${i}`,
        nicknameKey: `otro ${i}`,
        role: "PLAYER" as const,
        tokenHash: `hash-${roomId}-${i}`,
        lastSeenAt: NOW,
      })),
    });
    expect(await resumeSession(roomId, { jar: new FakeCookieJar(), now: at(10 * SEC) })).toEqual({
      ok: false,
      error: "ROOM_FULL",
    });
  });

  it("RF-07: una sala inexistente devuelve ROOM_NOT_FOUND", async () => {
    expect(await resumeSession("NoExiste_123", { jar: new FakeCookieJar(), now: NOW })).toEqual({
      ok: false,
      error: "ROOM_NOT_FOUND",
    });
  });

  it("RF-09: tras más de 2 minutos fuera, vuelve con su apodo si sigue libre", async () => {
    const { roomId, jar, participantId } = await playerIn("volver-libre");
    const result = await resumeSession(roomId, { jar, now: at(3 * MIN) });
    expect(result).toEqual({ ok: true, data: { participantId, nickname: "Ana", role: "PLAYER" } });
  });

  it("RF-09: si otro tomó su apodo, se le pide uno nuevo y al renombrar conserva su fila y rol", async () => {
    const { roomId, jar, participantId } = await playerIn("volver-ocupado");
    expect((await join(roomId, "ana", at(3 * MIN))).ok).toBe(true);

    expect(await resumeSession(roomId, { jar, now: at(3 * MIN + 10 * SEC) })).toEqual({
      ok: false,
      error: "NICKNAME_TAKEN",
    });
    expect(
      await renameAndResume({ roomId, nickname: "ANA" }, { jar, now: at(3 * MIN + 20 * SEC) }),
    ).toEqual({
      ok: false,
      error: "NICKNAME_TAKEN",
    });
    expect(
      await renameAndResume({ roomId, nickname: "Ana B" }, { jar, now: at(3 * MIN + 30 * SEC) }),
    ).toEqual({
      ok: true,
      data: { participantId, nickname: "Ana B", role: "PLAYER" },
    });
  });

  it("RF-09: si la sala se llenó mientras estaba fuera, ve ROOM_FULL", async () => {
    const { roomId, jar } = await playerIn("volver-llena");
    await db.participant.createMany({
      data: Array.from({ length: 13 }, (_, i) => ({
        roomId,
        nickname: `Otro ${i}`,
        nicknameKey: `otro ${i}`,
        role: "PLAYER" as const,
        tokenHash: `hash-${roomId}-${i}`,
        lastSeenAt: at(3 * MIN),
      })),
    });
    // Moderador activo + 13 = 14; con Ana expirada entra uno más y la sala se llena
    await db.participant.updateMany({
      where: { roomId, role: "MODERATOR" },
      data: { lastSeenAt: at(3 * MIN) },
    });
    expect((await join(roomId, "Último", at(3 * MIN))).ok).toBe(true);

    expect(await resumeSession(roomId, { jar, now: at(3 * MIN + 10 * SEC) })).toEqual({
      ok: false,
      error: "ROOM_FULL",
    });
  });

  it("RF-11: el moderador conserva su rol al volver, incluso tras renombrarse", async () => {
    const jar = new FakeCookieJar();
    const created = await createRoom(
      { roomName: `${PREFIX}moderador-vuelve`, nickname: "Mod" },
      { jar, now: NOW },
    );
    if (!created.ok) throw new Error(created.error);
    const { roomId, participantId } = created.data;

    expect(await resumeSession(roomId, { jar, now: at(1 * MIN) })).toEqual({
      ok: true,
      data: { participantId, nickname: "Mod", role: "MODERATOR" },
    });

    expect((await join(roomId, "mod", at(4 * MIN))).ok).toBe(true);
    expect(
      await renameAndResume({ roomId, nickname: "Mod 2" }, { jar, now: at(4 * MIN + 10 * SEC) }),
    ).toEqual({
      ok: true,
      data: { participantId, nickname: "Mod 2", role: "MODERATOR" },
    });
  });

  it("RF-09: renameAndResume valida el apodo", async () => {
    const { roomId, jar } = await playerIn("renombrar-invalido");
    expect(await renameAndResume({ roomId, nickname: "A" }, { jar, now: NOW })).toEqual({
      ok: false,
      error: "VALIDATION",
    });
  });
});

describe("heartbeat, markDisconnected y getRoomState", () => {
  async function roomWithTwo(label: string) {
    const modJar = new FakeCookieJar();
    const created = await createRoom(
      { roomName: `${PREFIX}${label}`, nickname: "Mod" },
      { jar: modJar, now: NOW },
    );
    if (!created.ok) throw new Error(created.error);
    const anaJar = new FakeCookieJar();
    const joined = await join(created.data.roomId, "Ana", NOW, anaJar);
    if (!joined.ok) throw new Error(joined.error);
    return {
      roomId: created.data.roomId,
      mod: { jar: modJar, id: created.data.participantId },
      ana: { jar: anaJar, id: joined.data.participantId },
    };
  }

  it("RF-10: el latido actualiza lastSeenAt y quita la marca de desconexión", async () => {
    const { roomId, ana } = await roomWithTwo("latido");
    await db.participant.update({ where: { id: ana.id }, data: { disconnectedAt: at(5 * SEC) } });

    expect(await heartbeat(roomId, { jar: ana.jar, now: at(15 * SEC) })).toEqual({
      ok: true,
      data: null,
    });
    const row = await db.participant.findUniqueOrThrow({ where: { id: ana.id } });
    expect(row.lastSeenAt).toEqual(at(15 * SEC));
    expect(row.disconnectedAt).toBeNull();
  });

  it("RF-10: el latido de alguien sin sesión o ya expirado no lo reactiva", async () => {
    const { roomId, ana } = await roomWithTwo("latido-expirado");
    expect(await heartbeat(roomId, { jar: new FakeCookieJar(), now: NOW })).toEqual({
      ok: false,
      error: "NOT_A_PARTICIPANT",
    });
    // Expirado: debe volver con resumeSession, que comprueba apodo y cupo
    expect(await heartbeat(roomId, { jar: ana.jar, now: at(3 * MIN) })).toEqual({
      ok: false,
      error: "NOT_A_PARTICIPANT",
    });
  });

  it("RF-10: otro participante marca la desconexión y no pisa una marca existente", async () => {
    const { roomId, mod, ana } = await roomWithTwo("marcar");
    const input = { roomId, participantId: ana.id };

    expect(await markDisconnected(input, { jar: mod.jar, now: at(10 * SEC) })).toEqual({
      ok: true,
      data: null,
    });
    expect(await markDisconnected(input, { jar: mod.jar, now: at(20 * SEC) })).toEqual({
      ok: true,
      data: null,
    });

    const row = await db.participant.findUniqueOrThrow({ where: { id: ana.id } });
    expect(row.disconnectedAt).toEqual(at(10 * SEC));
  });

  it("RF-10: solo un participante de la misma sala puede marcar desconexiones", async () => {
    const { roomId, ana } = await roomWithTwo("marcar-ajeno");
    const other = await roomWithTwo("marcar-ajeno-b");
    const input = { roomId, participantId: ana.id };

    expect(await markDisconnected(input, { jar: new FakeCookieJar(), now: NOW })).toEqual({
      ok: false,
      error: "NOT_A_PARTICIPANT",
    });
    expect(await markDisconnected(input, { jar: other.mod.jar, now: NOW })).toEqual({
      ok: false,
      error: "NOT_A_PARTICIPANT",
    });
    // Un participante de otra sala no se ve afectado aunque se indique su id
    expect(
      await markDisconnected({ roomId, participantId: other.ana.id }, { jar: ana.jar, now: NOW }),
    ).toEqual({
      ok: true,
      data: null,
    });
    expect(
      (await db.participant.findUniqueOrThrow({ where: { id: other.ana.id } })).disconnectedAt,
    ).toBeNull();
    expect(
      await markDisconnected({ roomId, participantId: "" }, { jar: ana.jar, now: NOW }),
    ).toEqual({
      ok: false,
      error: "VALIDATION",
    });
  });

  it("RF-08/RF-11: el estado de la sala lista a los activos con su rol y conexión, sin secretos", async () => {
    const { roomId, mod, ana } = await roomWithTwo("estado");
    await db.participant.update({ where: { id: ana.id }, data: { disconnectedAt: at(10 * SEC) } });

    const result = await getRoomState(roomId, { jar: mod.jar, now: at(30 * SEC) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.room).toEqual({ id: roomId, name: `${PREFIX}estado` });
    expect(result.data.me).toBe(mod.id);
    expect(result.data.participants).toEqual([
      { id: mod.id, nickname: "Mod", role: "MODERATOR", disconnectedAt: null },
      { id: ana.id, nickname: "Ana", role: "PLAYER", disconnectedAt: at(10 * SEC) },
    ]);
    expect(JSON.stringify(result.data)).not.toMatch(/tokenHash|hash-/);
  });

  it("RF-10: el estado omite a los participantes expirados", async () => {
    const { roomId, mod, ana } = await roomWithTwo("estado-expirados");
    await db.participant.update({ where: { id: ana.id }, data: { disconnectedAt: NOW } });
    await db.participant.update({ where: { id: mod.id }, data: { lastSeenAt: at(2 * MIN) } });

    const result = await getRoomState(roomId, { jar: mod.jar, now: at(2 * MIN + 1 * SEC) });
    if (!result.ok) throw new Error(result.error);
    expect(result.data.participants.map((p) => p.id)).toEqual([mod.id]);
  });

  it("RF-07: el estado de una sala inexistente o sin sesión devuelve error", async () => {
    const { roomId } = await roomWithTwo("estado-errores");
    expect(await getRoomState("NoExiste_123", { jar: new FakeCookieJar(), now: NOW })).toEqual({
      ok: false,
      error: "ROOM_NOT_FOUND",
    });
    expect(await getRoomState(roomId, { jar: new FakeCookieJar(), now: NOW })).toEqual({
      ok: false,
      error: "NOT_A_PARTICIPANT",
    });
  });
});

describe("sayBye", () => {
  // Escucha el canal de la sala como lo haría otro participante en el navegador
  async function listenForBye(roomId: string) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
      { auth: { persistSession: false } },
    );
    const received: unknown[] = [];
    const channel = supabase.channel(`room:${roomId}`);
    channel.on("broadcast", { event: "bye" }, ({ payload }) => received.push(payload));
    await new Promise<void>((resolve, reject) => {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") resolve();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(new Error(status));
      });
    });
    return {
      received,
      async waitFor(count: number, timeoutMs: number) {
        const start = Date.now();
        while (received.length < count && Date.now() - start < timeoutMs) {
          await new Promise((r) => setTimeout(r, 50));
        }
      },
      close: () => supabase.removeAllChannels(),
    };
  }

  it("RF-10: marca la desconexión de quien se va y avisa al canal con un broadcast bye", async () => {
    const roomId = await newRoom("bye");
    const jar = new FakeCookieJar();
    const joined = await join(roomId, "Ana", NOW, jar);
    if (!joined.ok) throw new Error(joined.error);
    const listener = await listenForBye(roomId);

    try {
      expect(await sayBye(roomId, { jar, now: at(10 * SEC) })).toEqual({ ok: true, data: null });
      await listener.waitFor(1, 5_000);
      expect(listener.received).toEqual([{ participantId: joined.data.participantId }]);
      const row = await db.participant.findUniqueOrThrow({
        where: { id: joined.data.participantId },
      });
      expect(row.disconnectedAt).toEqual(at(10 * SEC));
    } finally {
      await listener.close();
    }
  });

  it("RF-10: sin sesión activa no marca nada ni emite el broadcast", async () => {
    const roomId = await newRoom("bye-ajeno");
    const jar = new FakeCookieJar();
    const joined = await join(roomId, "Ana", NOW, jar);
    if (!joined.ok) throw new Error(joined.error);
    const listener = await listenForBye(roomId);

    try {
      expect(await sayBye(roomId, { jar: new FakeCookieJar(), now: NOW })).toEqual({
        ok: false,
        error: "NOT_A_PARTICIPANT",
      });
      expect(await sayBye(roomId, { jar, now: at(3 * MIN) })).toEqual({
        ok: false,
        error: "NOT_A_PARTICIPANT",
      });
      expect(await sayBye("x", { jar, now: NOW })).toEqual({ ok: false, error: "VALIDATION" });
      await listener.waitFor(1, 1_500);
      expect(listener.received).toEqual([]);
      const row = await db.participant.findUniqueOrThrow({
        where: { id: joined.data.participantId },
      });
      expect(row.disconnectedAt).toBeNull();
    } finally {
      await listener.close();
    }
  });
});

describe("RF-11: la sala sin su moderador", () => {
  it("RF-11: con el moderador desconectado y expirado, los jugadores siguen usando la sala", async () => {
    const modJar = new FakeCookieJar();
    const created = await createRoom(
      { roomName: `${PREFIX}sin-moderador`, nickname: "Mod" },
      { jar: modJar, now: NOW },
    );
    if (!created.ok) throw new Error(created.error);
    const { roomId } = created.data;
    const anaJar = new FakeCookieJar();
    expect((await join(roomId, "Ana", NOW, anaJar)).ok).toBe(true);
    await db.participant.update({
      where: { id: created.data.participantId },
      data: { disconnectedAt: at(10 * SEC) },
    });

    // Ana sigue enviando latidos mientras el moderador está fuera
    expect(await heartbeat(roomId, { jar: anaJar, now: at(2 * MIN) })).toEqual({
      ok: true,
      data: null,
    });
    const later = at(3 * MIN);
    expect((await join(roomId, "Carla", later)).ok).toBe(true);
    expect(await heartbeat(roomId, { jar: anaJar, now: later })).toEqual({ ok: true, data: null });

    const state = await getRoomState(roomId, { jar: anaJar, now: later });
    if (!state.ok) throw new Error(state.error);
    expect(state.data.participants.map((p) => [p.nickname, p.role])).toEqual([
      ["Ana", "PLAYER"],
      ["Carla", "PLAYER"],
    ]);
  });

  it("RF-11: si el moderador pierde su identidad, entra como jugador con otro apodo y la sala sigue sin moderador", async () => {
    const created = await createRoom(
      { roomName: `${PREFIX}moderador-sin-identidad`, nickname: "Mod" },
      { jar: new FakeCookieJar(), now: NOW },
    );
    if (!created.ok) throw new Error(created.error);
    const { roomId } = created.data;

    // Otro navegador (sin cookie), cuando la sesión antigua del moderador ya expiró
    const newJar = new FakeCookieJar();
    const later = at(3 * MIN);
    expect(await resumeSession(roomId, { jar: newJar, now: later })).toEqual({
      ok: false,
      error: "NOT_A_PARTICIPANT",
    });
    const rejoined = await join(roomId, "Mod nuevo", later, newJar);
    expect(rejoined.ok).toBe(true);

    const state = await getRoomState(roomId, { jar: newJar, now: later });
    if (!state.ok) throw new Error(state.error);
    expect(state.data.room.id).toBe(roomId);
    expect(state.data.participants).toEqual([
      expect.objectContaining({ nickname: "Mod nuevo", role: "PLAYER" }),
    ]);
  });
});
