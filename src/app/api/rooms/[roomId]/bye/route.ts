import { requestDeps } from "@/server/request-deps";
import { type ActionError, sayBye } from "@/server/room-service";

const STATUS: Record<ActionError, number> = {
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

// Recibe el beacon que envía el navegador al cerrar la pestaña o salir de la sala (RF-10)
export async function POST(_request: Request, { params }: RouteContext<"/api/rooms/[roomId]/bye">) {
  const { roomId } = await params;
  const result = await sayBye(roomId, await requestDeps());
  return new Response(null, { status: result.ok ? 204 : STATUS[result.error] });
}
