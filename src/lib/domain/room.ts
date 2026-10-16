// Reglas puras de la sala. Todas reciben `now` para poder probar los plazos sin esperar.

export const MAX_PARTICIPANTS = 15;
// Tiempo que un desconectado conserva su apodo y su lugar (RF-05, RF-06, RF-10)
export const DISCONNECT_GRACE_MS = 2 * 60 * 1000;
// Respaldo cuando nadie observó la desconexión: sin latido durante este tiempo, expira
export const HEARTBEAT_FALLBACK_MS = 2.5 * 60 * 1000;

export type ParticipantState = {
  id: string;
  nicknameKey: string | null;
  lastSeenAt: Date;
  disconnectedAt: Date | null;
};

export function normalizeNickname(nickname: string): string {
  return nickname.trim().toLowerCase();
}

export function isActive(participant: ParticipantState, now: Date): boolean {
  const { disconnectedAt, lastSeenAt } = participant;
  const withinGrace =
    disconnectedAt === null || now.getTime() - disconnectedAt.getTime() < DISCONNECT_GRACE_MS;
  const recentHeartbeat = now.getTime() - lastSeenAt.getTime() < HEARTBEAT_FALLBACK_MS;
  return withinGrace && recentHeartbeat;
}

export function countActive(participants: readonly ParticipantState[], now: Date): number {
  return participants.filter((p) => isActive(p, now)).length;
}

export function canJoin(participants: readonly ParticipantState[], now: Date): boolean {
  return countActive(participants, now) < MAX_PARTICIPANTS;
}

// `exceptId` excluye al propio participante cuando vuelve con su apodo (RF-09)
export function isNicknameAvailable(
  participants: readonly ParticipantState[],
  nickname: string,
  now: Date,
  exceptId?: string,
): boolean {
  const key = normalizeNickname(nickname);
  return !participants.some((p) => p.id !== exceptId && p.nicknameKey === key && isActive(p, now));
}
