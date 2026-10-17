import type { ActionError } from "@/server/room-service";

// Código HTTP de cada error de room-service, para los Route Handlers
export const HTTP_STATUS: Record<ActionError, number> = {
  VALIDATION: 400,
  NOT_A_PARTICIPANT: 403,
  ROOM_NOT_FOUND: 404,
  ROOM_FULL: 409,
  NICKNAME_TAKEN: 409,
  NOT_MODERATOR: 403,
  VOTES_PRESENT: 409,
  ROUND_CLOSED: 409,
  NO_VOTES: 409,
  ROUND_NOT_REVEALED: 409,
  ESTIMATE_PRESENT: 409,
};
