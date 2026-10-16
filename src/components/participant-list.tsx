import { Badge } from "@/components/ui/badge";
import type { Role } from "@/lib/schemas/room";

export type ParticipantListItem = {
  id: string;
  nickname: string;
  role: Role;
  connected: boolean;
};

// Lista de participantes de la sala (RF-08): apodo, estado de conexión y moderador destacado
export function ParticipantList({
  participants,
}: {
  participants: readonly ParticipantListItem[];
}) {
  return (
    <ul aria-label="Participantes" className="flex flex-col gap-2">
      {participants.map((p) => (
        <li key={p.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
          <span
            aria-hidden
            className={
              p.connected
                ? "size-2.5 rounded-full bg-green-500"
                : "size-2.5 rounded-full bg-muted-foreground/40"
            }
          />
          <span className="flex-1 truncate">{p.nickname}</span>
          <span className="sr-only">{p.connected ? "Conectado" : "Desconectado"}</span>
          {p.role === "MODERATOR" && <Badge variant="secondary">Moderador</Badge>}
        </li>
      ))}
    </ul>
  );
}
