import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  castVote,
  createRoom,
  deleteHistoryItem,
  getHistory,
  joinRoom,
  newTask,
  revealRound,
  revote,
  setEstimate,
} from "@/server/room-service";
import { FakeCookieJar } from "../../helpers/fake-cookies";
import { cleanupTestData, testRoomName } from "../../helpers/test-data";

const NOW = new Date("2026-10-17T12:00:00Z");
const SEC = 1000;
const at = (ms: number) => new Date(NOW.getTime() + ms);
const PREFIX = testRoomName("history-");

afterAll(async () => {
  await cleanupTestData(PREFIX);
});

// Sala con moderador (Mod) y Ana
async function setup(label: string) {
  const mod = new FakeCookieJar();
  const created = await createRoom(
    { roomName: `${PREFIX}${label}`, nickname: "Mod" },
    { jar: mod, now: NOW },
  );
  if (!created.ok) throw new Error(created.error);
  const { roomId } = created.data;
  const ana = new FakeCookieJar();
  if (!(await joinRoom({ roomId, nickname: "Ana" }, { jar: ana, now: NOW })).ok)
    throw new Error("join");
  const deps = (jar: FakeCookieJar, now = NOW) => ({ jar, now });

  // Carga una tarea, vota (Mod y Ana), revela y, si se indica, fija la estimación
  async function estimate(title: string, cards: [string, string], value: string | null, now = NOW) {
    const task = await newTask({ roomId, title }, deps(mod, now));
    if (!task.ok) throw new Error(task.error);
    const { roundId } = task.data;
    await castVote({ roomId, roundId, card: cards[0] }, deps(mod, now));
    await castVote({ roomId, roundId, card: cards[1] }, deps(ana, now));
    const revealed = await revealRound({ roomId, roundId }, deps(mod, now));
    if (!revealed.ok) throw new Error(revealed.error);
    if (value) await setEstimate({ roomId, roundId, card: value }, deps(mod, now));
    return { roundId, taskId: task.data.task.id };
  }

  async function history(jar = ana) {
    const result = await getHistory(roomId, deps(jar));
    if (!result.ok) throw new Error(result.error);
    return result.data;
  }

  return { roomId, mod, ana, deps, estimate, history };
}

describe("getHistory", () => {
  it("RF-01: solo tareas estimadas, de la estimación más reciente a la más antigua", async () => {
    const r = await setup("orden");
    await r.estimate("Login", ["5", "5"], "5", at(1 * SEC));
    await r.estimate("Logout", ["3", "2"], "3", at(2 * SEC));
    const items = await r.history();
    expect(items.map((i) => [i.title, i.estimate])).toEqual([
      ["Logout", "3"],
      ["Login", "5"],
    ]);
    expect(items[0]?.estimatedAt).toEqual(at(2 * SEC));
  });

  it("RF-03: cambiar la estimación de la tarea actual muestra el último valor y su hora", async () => {
    const r = await setup("cambio");
    const login = await r.estimate("Login", ["5", "8"], "5", at(1 * SEC));
    await setEstimate(
      { roomId: r.roomId, roundId: login.roundId, card: "8" },
      r.deps(r.mod, at(4 * SEC)),
    );
    const items = await r.history();
    expect(items.map((i) => [i.title, i.estimate])).toEqual([["Login", "8"]]);
    expect(items[0]?.estimatedAt).toEqual(at(4 * SEC));
  });

  it("RF-03: una tarea reemplazada sin estimar no aparece; al volver a votar, sale", async () => {
    const r = await setup("vigente");
    await r.estimate("Sin estimar", ["5", "8"], null, at(1 * SEC));
    const login = await r.estimate("Login", ["5", "8"], "5", at(2 * SEC));
    expect((await r.history()).map((i) => i.title)).toEqual(["Login"]);

    await revote(
      { roomId: r.roomId, roundId: login.roundId, confirm: true },
      r.deps(r.mod, at(3 * SEC)),
    );
    expect(await r.history()).toEqual([]);
  });

  it("RF-04: muestra las rondas reveladas de la tarea, de la más antigua a la más reciente", async () => {
    const r = await setup("rondas");
    const first = await r.estimate("Login", ["5", "8"], null, at(1 * SEC));
    const again = await revote(
      { roomId: r.roomId, roundId: first.roundId },
      r.deps(r.mod, at(2 * SEC)),
    );
    if (!again.ok) throw new Error(again.error);
    const roundId = again.data.roundId;
    await castVote({ roomId: r.roomId, roundId, card: "8" }, r.deps(r.mod, at(3 * SEC)));
    await castVote({ roomId: r.roomId, roundId, card: "8" }, r.deps(r.ana, at(3 * SEC)));
    await revealRound({ roomId: r.roomId, roundId }, r.deps(r.mod, at(4 * SEC)));
    await setEstimate({ roomId: r.roomId, roundId, card: "8" }, r.deps(r.mod, at(5 * SEC)));

    const [login] = await r.history();
    expect(login?.rounds.map((round) => round.entries.map((e) => [e.nickname, e.card]))).toEqual([
      [
        ["Mod", "5"],
        ["Ana", "8"],
      ],
      [
        ["Mod", "8"],
        ["Ana", "8"],
      ],
    ]);
  });

  it("RF-08: no incluye nada de la ronda abierta en curso", async () => {
    const r = await setup("secreto");
    await r.estimate("Login", ["5", "5"], "5", at(1 * SEC));
    const logout = await newTask({ roomId: r.roomId, title: "Logout" }, r.deps(r.mod, at(2 * SEC)));
    if (!logout.ok) throw new Error(logout.error);
    await castVote(
      { roomId: r.roomId, roundId: logout.data.roundId, card: "13" },
      r.deps(r.ana, at(2 * SEC)),
    );

    const items = await r.history();
    expect(items.map((i) => i.title)).toEqual(["Login"]);
    expect(JSON.stringify(items)).not.toMatch(/"13"/);
  });

  it("RF-10: solo muestra las tareas de la propia sala", async () => {
    const a = await setup("sala-a");
    const b = await setup("sala-b");
    await a.estimate("Tarea A", ["5", "5"], "5");
    await b.estimate("Tarea B", ["3", "3"], "3");
    expect((await a.history()).map((i) => i.title)).toEqual(["Tarea A"]);
  });

  it("RF-09: sin sesión o con una sala inexistente devuelve error", async () => {
    const r = await setup("errores");
    expect(await getHistory(r.roomId, { jar: new FakeCookieJar(), now: NOW })).toEqual({
      ok: false,
      error: "NOT_A_PARTICIPANT",
    });
    expect(await getHistory("NoExiste_123", { jar: new FakeCookieJar(), now: NOW })).toEqual({
      ok: false,
      error: "ROOM_NOT_FOUND",
    });
  });
});

describe("deleteHistoryItem", () => {
  // Login y Logout estimadas; la tarea actual es Signup (ronda abierta)
  async function withTwo(label: string) {
    const r = await setup(label);
    const login = await r.estimate("Login", ["5", "5"], "5", at(1 * SEC));
    const logout = await r.estimate("Logout", ["3", "3"], "3", at(2 * SEC));
    const signup = await newTask({ roomId: r.roomId, title: "Signup" }, r.deps(r.mod, at(3 * SEC)));
    if (!signup.ok) throw new Error(signup.error);
    return { ...r, login, logout };
  }

  it("RF-11: el moderador borra la tarea con sus rondas y su foto, sin tocar las demás", async () => {
    const r = await withTwo("borrar");
    const result = await deleteHistoryItem(
      { roomId: r.roomId, taskId: r.login.taskId },
      r.deps(r.mod),
    );
    expect(result).toEqual({ ok: true, data: { taskId: r.login.taskId } });
    expect((await r.history()).map((i) => i.title)).toEqual(["Logout"]);
    expect(await db.task.count({ where: { id: r.login.taskId } })).toBe(0);
    expect(await db.round.count({ where: { taskId: r.login.taskId } })).toBe(0);
    expect(await db.revealEntry.count({ where: { roundId: r.login.roundId } })).toBe(0);
    expect(await db.revealEntry.count({ where: { roundId: r.logout.roundId } })).toBe(2);
  });

  it("RF-11: un jugador no puede borrar", async () => {
    const r = await withTwo("jugador");
    expect(
      await deleteHistoryItem({ roomId: r.roomId, taskId: r.login.taskId }, r.deps(r.ana)),
    ).toEqual({ ok: false, error: "NOT_MODERATOR" });
    expect(await r.history()).toHaveLength(2);
  });

  it("RF-11: la tarea actual no se borra desde el historial", async () => {
    const r = await setup("actual");
    const login = await r.estimate("Login", ["5", "5"], "5", at(1 * SEC));
    expect(
      await deleteHistoryItem({ roomId: r.roomId, taskId: login.taskId }, r.deps(r.mod)),
    ).toEqual({ ok: false, error: "TASK_IS_CURRENT" });
    expect(await r.history()).toHaveLength(1);
  });

  it("RF-11: una tarea de otra sala o sin estimación no se encuentra", async () => {
    const r = await withTwo("ajena");
    const other = await setup("ajena-otra");
    const foreign = await other.estimate("Ajena", ["8", "8"], "8");
    await newTask({ roomId: other.roomId, title: "Siguiente" }, other.deps(other.mod, at(SEC)));
    expect(
      await deleteHistoryItem({ roomId: r.roomId, taskId: foreign.taskId }, r.deps(r.mod)),
    ).toEqual({ ok: false, error: "TASK_NOT_FOUND" });

    const pending = await r.estimate("Sin estimar", ["1", "2"], null, at(4 * SEC));
    await newTask({ roomId: r.roomId, title: "Otra" }, r.deps(r.mod, at(5 * SEC)));
    expect(
      await deleteHistoryItem({ roomId: r.roomId, taskId: pending.taskId }, r.deps(r.mod)),
    ).toEqual({ ok: false, error: "TASK_NOT_FOUND" });
    expect(await other.history(other.ana)).toHaveLength(1);
  }, 60_000);

  it("RF-11: avisa por broadcast con el id de la tarea borrada", async () => {
    const r = await withTwo("broadcast");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
      { auth: { persistSession: false } },
    );
    const messages: unknown[] = [];
    const channel = supabase.channel(`room:${r.roomId}`);
    channel.on("broadcast", { event: "historyDeleted" }, ({ payload }) => messages.push(payload));
    await new Promise<void>((resolve, reject) => {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") resolve();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(new Error(status));
      });
    });
    try {
      await deleteHistoryItem({ roomId: r.roomId, taskId: r.login.taskId }, r.deps(r.mod));
      const start = Date.now();
      while (messages.length < 1 && Date.now() - start < 5_000) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      expect(messages).toEqual([{ taskId: r.login.taskId }]);
    } finally {
      await supabase.removeAllChannels();
    }
  });
});
