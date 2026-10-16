import { DISCONNECT_GRACE_MS } from "@/lib/domain/room";
import { type PresencePayload, presencePayloadSchema, type Role } from "@/lib/schemas/room";

// Estado de la lista de participantes en el cliente (RF-08, RF-10). Reducer puro: los tiempos
// llegan en cada evento como milisegundos, para poder probarlo sin relojes reales.

// Sin noticias de alguien durante este tiempo (red caída sin cerrar la pestaña), se lo marca
// desconectado. Cada cliente se anuncia cada 15 s, así la detección queda por debajo de 30 s.
export const PRESENCE_TIMEOUT_MS = 25 * 1000;

export type PresenceEntry = {
  id: string;
  nickname: string;
  role: Role;
  connected: boolean;
  lastSeenAt: number;
  disconnectedAt: number | null;
  removeAt: number | null;
  // "left": dejó de aparecer en la presence; "silent": dejó de anunciarse (red caída)
  disconnectReason: "left" | "silent" | null;
};

export type PresenceState = {
  order: readonly string[];
  byId: Readonly<Record<string, PresenceEntry>>;
};

export type InitialParticipant = {
  id: string;
  nickname: string;
  role: Role;
  disconnectedAt: Date | null;
};

export type PresenceEvent =
  // Estado completo del canal: quiénes están conectados ahora mismo
  | { type: "sync"; payloads: readonly unknown[]; now: number }
  // Alguien se anunció (al entrar o en su latido)
  | { type: "seen"; payload: unknown; now: number }
  // Paso del tiempo: detecta silencios y retira a los expirados
  | { type: "tick"; now: number };

export function initialPresenceState(
  participants: readonly InitialParticipant[],
  now: number,
): PresenceState {
  const byId: Record<string, PresenceEntry> = {};
  for (const p of participants) {
    const disconnectedAt = p.disconnectedAt ? p.disconnectedAt.getTime() : null;
    byId[p.id] = {
      id: p.id,
      nickname: p.nickname,
      role: p.role,
      connected: disconnectedAt === null,
      lastSeenAt: now,
      disconnectedAt,
      removeAt: disconnectedAt === null ? null : disconnectedAt + DISCONNECT_GRACE_MS,
      disconnectReason: disconnectedAt === null ? null : "left",
    };
  }
  return { order: participants.map((p) => p.id), byId };
}

function parsePayloads(payloads: readonly unknown[]): PresencePayload[] {
  return payloads.flatMap((payload) => {
    const parsed = presencePayloadSchema.safeParse(payload);
    return parsed.success ? [parsed.data] : [];
  });
}

function markSeen(state: PresenceState, payload: PresencePayload, now: number): PresenceState {
  const entry: PresenceEntry = {
    id: payload.participantId,
    nickname: payload.nickname,
    role: payload.role,
    connected: true,
    lastSeenAt: now,
    disconnectedAt: null,
    removeAt: null,
    disconnectReason: null,
  };
  const order = state.order.includes(entry.id) ? state.order : [...state.order, entry.id];
  return { order, byId: { ...state.byId, [entry.id]: entry } };
}

function markDisconnected(
  entry: PresenceEntry,
  now: number,
  reason: "left" | "silent",
): PresenceEntry {
  return {
    ...entry,
    connected: false,
    disconnectedAt: now,
    removeAt: now + DISCONNECT_GRACE_MS,
    disconnectReason: reason,
  };
}

export function presenceReducer(state: PresenceState, event: PresenceEvent): PresenceState {
  switch (event.type) {
    case "sync": {
      // El sync lista lo que el servidor cree conectado, incluidos clientes muertos que aún no
      // descartó. Por eso solo añade a los nuevos y reconecta a quien había salido de la lista;
      // la "última noticia" (lastSeenAt) solo la renueva un anuncio real ("seen").
      const present = parsePayloads(event.payloads);
      let next = state;
      for (const payload of present) {
        const entry = next.byId[payload.participantId];
        if (!entry || entry.disconnectReason === "left") next = markSeen(next, payload, event.now);
      }
      const presentIds = new Set(present.map((p) => p.participantId));
      const byId = { ...next.byId };
      for (const entry of Object.values(next.byId)) {
        if (entry.connected && !presentIds.has(entry.id)) {
          byId[entry.id] = markDisconnected(entry, event.now, "left");
        }
      }
      return { ...next, byId };
    }
    case "seen": {
      const parsed = presencePayloadSchema.safeParse(event.payload);
      return parsed.success ? markSeen(state, parsed.data, event.now) : state;
    }
    case "tick": {
      let changed = false;
      const byId: Record<string, PresenceEntry> = {};
      for (const entry of Object.values(state.byId)) {
        if (entry.removeAt !== null && entry.removeAt <= event.now) {
          changed = true;
          continue;
        }
        if (entry.connected && event.now - entry.lastSeenAt > PRESENCE_TIMEOUT_MS) {
          changed = true;
          byId[entry.id] = markDisconnected(entry, event.now, "silent");
          continue;
        }
        byId[entry.id] = entry;
      }
      if (!changed) return state;
      return { order: state.order.filter((id) => id in byId), byId };
    }
  }
}

// Moderador primero; el resto, por orden de llegada
export function listParticipants(state: PresenceState): PresenceEntry[] {
  const entries = state.order.flatMap((id) => {
    const entry = state.byId[id];
    return entry ? [entry] : [];
  });
  return [
    ...entries.filter((e) => e.role === "MODERATOR"),
    ...entries.filter((e) => e.role !== "MODERATOR"),
  ];
}

// Participantes que estaban conectados en `before` y ya no en `after`: hay que avisar al servidor
export function newlyDisconnected(before: PresenceState, after: PresenceState): string[] {
  return Object.values(after.byId)
    .filter((entry) => !entry.connected && before.byId[entry.id]?.connected === true)
    .map((entry) => entry.id);
}
