import { HTTP_STATUS } from "@/server/http-status";
import { requestDeps } from "@/server/request-deps";
import { sayBye } from "@/server/room-service";

// Recibe el beacon que envía el navegador al cerrar la pestaña o salir de la sala (RF-10)
export async function POST(_request: Request, { params }: RouteContext<"/api/rooms/[roomId]/bye">) {
  const { roomId } = await params;
  const result = await sayBye(roomId, await requestDeps());
  return new Response(null, { status: result.ok ? 204 : HTTP_STATUS[result.error] });
}
