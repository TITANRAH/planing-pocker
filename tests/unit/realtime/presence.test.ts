import { describe, expect, it } from "vitest";
import {
  initialPresenceState,
  listParticipants,
  newlyDisconnected,
  presenceReducer,
  PRESENCE_TIMEOUT_MS,
  type PresenceState,
} from "@/lib/realtime/presence";

const T0 = new Date("2026-10-16T12:00:00Z").getTime();
const SEC = 1000;
const MIN = 60 * SEC;

const mod = { participantId: "m", nickname: "Mod", role: "MODERATOR" as const };
const ana = { participantId: "a", nickname: "Ana", role: "PLAYER" as const };
const juan = { participantId: "j", nickname: "Juan", role: "PLAYER" as const };

function start(): PresenceState {
  return initialPresenceState(
    [
      { id: "m", nickname: "Mod", role: "MODERATOR", disconnectedAt: null },
      { id: "a", nickname: "Ana", role: "PLAYER", disconnectedAt: null },
    ],
    T0,
  );
}

const ids = (state: PresenceState) => listParticipants(state).map((p) => p.id);
const byId = (state: PresenceState, id: string) => listParticipants(state).find((p) => p.id === id);

describe("presenceReducer", () => {
  it("RF-08: parte del estado del servidor, con el moderador primero", () => {
    const state = start();
    expect(ids(state)).toEqual(["m", "a"]);
    expect(byId(state, "m")).toMatchObject({ role: "MODERATOR", connected: true });
  });

  it("RF-10: un participante que ya venía desconectado se retira a los 2 minutos de su desconexión", () => {
    const state = initialPresenceState(
      [{ id: "a", nickname: "Ana", role: "PLAYER", disconnectedAt: new Date(T0 - 30 * SEC) }],
      T0,
    );
    expect(byId(state, "a")).toMatchObject({ connected: false, removeAt: T0 - 30 * SEC + 2 * MIN });
  });

  it("RF-08: quien aparece en la presence se añade conectado", () => {
    const state = presenceReducer(start(), {
      type: "sync",
      payloads: [mod, ana, juan],
      now: T0 + SEC,
    });
    expect(ids(state)).toEqual(["m", "a", "j"]);
    expect(byId(state, "j")).toMatchObject({ nickname: "Juan", connected: true });
  });

  it("RF-10: quien desaparece de la presence pasa a desconectado y se programa su retirada a +2 min", () => {
    let state = presenceReducer(start(), { type: "sync", payloads: [mod, ana], now: T0 });
    state = presenceReducer(state, { type: "sync", payloads: [mod], now: T0 + 5 * SEC });
    expect(byId(state, "a")).toMatchObject({
      connected: false,
      disconnectedAt: T0 + 5 * SEC,
      removeAt: T0 + 5 * SEC + 2 * MIN,
    });
  });

  it("RF-10: se retira de la lista al cumplirse los 2 minutos, y no antes", () => {
    let state = presenceReducer(start(), { type: "sync", payloads: [mod], now: T0 });
    state = presenceReducer(state, { type: "tick", now: T0 + 2 * MIN - SEC });
    expect(ids(state)).toEqual(["m", "a"]);
    state = presenceReducer(state, { type: "tick", now: T0 + 2 * MIN });
    expect(ids(state)).toEqual(["m"]);
  });

  it("RF-10: si vuelve antes de 2 minutos, se lo ve conectado otra vez", () => {
    let state = presenceReducer(start(), { type: "sync", payloads: [mod], now: T0 });
    state = presenceReducer(state, { type: "sync", payloads: [mod, ana], now: T0 + MIN });
    expect(byId(state, "a")).toMatchObject({
      connected: true,
      disconnectedAt: null,
      removeAt: null,
    });
  });

  it("RF-10: sin noticias durante más de 25 s (red caída) se lo marca desconectado", () => {
    let state = presenceReducer(start(), { type: "sync", payloads: [mod, ana], now: T0 });
    state = presenceReducer(state, { type: "seen", payload: mod, now: T0 + 20 * SEC });
    state = presenceReducer(state, { type: "tick", now: T0 + PRESENCE_TIMEOUT_MS });
    expect(byId(state, "a")?.connected).toBe(true);
    state = presenceReducer(state, { type: "tick", now: T0 + PRESENCE_TIMEOUT_MS + SEC });
    expect(byId(state, "a")).toMatchObject({
      connected: false,
      disconnectedAt: T0 + PRESENCE_TIMEOUT_MS + SEC,
    });
    expect(byId(state, "m")?.connected).toBe(true);
    expect(PRESENCE_TIMEOUT_MS).toBeLessThanOrEqual(25 * SEC);
  });

  it("RF-10: un sync no renueva la última noticia de quien ya estaba conectado", () => {
    let state = presenceReducer(start(), {
      type: "sync",
      payloads: [mod, ana],
      now: T0 + 20 * SEC,
    });
    state = presenceReducer(state, { type: "tick", now: T0 + PRESENCE_TIMEOUT_MS + SEC });
    // El servidor aún listaba a Ana, pero ella no se anunció desde T0
    expect(byId(state, "a")?.connected).toBe(false);
  });

  it("RF-10: alguien marcado por silencio no se reconecta por un sync que aún lo lista; sí cuando se anuncia", () => {
    let state = presenceReducer(start(), { type: "tick", now: T0 + PRESENCE_TIMEOUT_MS + SEC });
    expect(byId(state, "a")?.connected).toBe(false);
    state = presenceReducer(state, { type: "sync", payloads: [mod, ana], now: T0 + 30 * SEC });
    expect(byId(state, "a")?.connected).toBe(false);
    state = presenceReducer(state, { type: "seen", payload: ana, now: T0 + 40 * SEC });
    expect(byId(state, "a")).toMatchObject({ connected: true, lastSeenAt: T0 + 40 * SEC });
  });

  it("RF-10: un bye lo marca desconectado al instante y programa su retirada a +2 min", () => {
    const state = presenceReducer(start(), {
      type: "bye",
      payload: { participantId: "a" },
      now: T0 + SEC,
    });
    expect(byId(state, "a")).toMatchObject({
      connected: false,
      disconnectedAt: T0 + SEC,
      removeAt: T0 + SEC + 2 * MIN,
      disconnectReason: "bye",
    });
    expect(newlyDisconnected(start(), state)).toEqual(["a"]);
  });

  it("RF-10: un bye inválido o de alguien desconocido no cambia el estado", () => {
    const state = start();
    expect(
      presenceReducer(state, { type: "bye", payload: { participantId: "nadie" }, now: T0 }),
    ).toBe(state);
    expect(presenceReducer(state, { type: "bye", payload: { id: "a" }, now: T0 })).toBe(state);
    expect(presenceReducer(state, { type: "bye", payload: null, now: T0 })).toBe(state);
  });

  it("RF-10: tras un bye, un sync atrasado que aún lo lista no lo reconecta", () => {
    let state = presenceReducer(start(), { type: "bye", payload: { participantId: "a" }, now: T0 });
    state = presenceReducer(state, { type: "sync", payloads: [mod, ana], now: T0 + SEC });
    expect(byId(state, "a")?.connected).toBe(false);
  });

  it("RF-10: quien se despidió vuelve a verse conectado con su siguiente anuncio", () => {
    let state = presenceReducer(start(), { type: "bye", payload: { participantId: "a" }, now: T0 });
    state = presenceReducer(state, { type: "seen", payload: ana, now: T0 + 10 * SEC });
    expect(byId(state, "a")).toMatchObject({
      connected: true,
      disconnectedAt: null,
      removeAt: null,
    });
  });

  it("RF-08: ignora payloads inválidos", () => {
    const state = presenceReducer(start(), {
      type: "sync",
      payloads: [mod, ana, { participantId: "x", nickname: "X", role: "ADMIN" }, null, "basura"],
      now: T0,
    });
    expect(ids(state)).toEqual(["m", "a"]);
    expect(presenceReducer(state, { type: "seen", payload: { nickname: "sin id" }, now: T0 })).toBe(
      state,
    );
  });

  it("RF-10: newlyDisconnected devuelve solo a quienes acaban de pasar a desconectados", () => {
    const before = presenceReducer(start(), { type: "sync", payloads: [mod, ana], now: T0 });
    const after = presenceReducer(before, { type: "sync", payloads: [mod], now: T0 + SEC });
    expect(newlyDisconnected(before, after)).toEqual(["a"]);
    expect(newlyDisconnected(after, after)).toEqual([]);
  });
});
