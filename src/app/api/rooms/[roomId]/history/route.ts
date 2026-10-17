import { HTTP_STATUS } from "@/server/http-status";
import { requestDeps } from "@/server/request-deps";
import { getHistory } from "@/server/room-service";

// Historial de la sala (spec 004). Es un GET y no una Server Action para no hacer cola con los
// votos del mismo navegador (plan 004 v1.2)
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/rooms/[roomId]/history">,
) {
  const { roomId } = await params;
  const result = await getHistory(roomId, await requestDeps());
  const headers = { "Cache-Control": "no-store" };
  if (!result.ok)
    return Response.json({ error: result.error }, { status: HTTP_STATUS[result.error], headers });
  return Response.json(result.data, { headers });
}
