"use client";

import { useMemo } from "react";
import { CopyLinkButton } from "@/components/copy-link-button";
import { ParticipantList } from "@/components/participant-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRoomPresence } from "@/lib/realtime/use-room-presence";
import type { PresencePayload } from "@/lib/schemas/room";
import type { RoomState } from "@/server/room-service";

type Props = {
  state: RoomState;
  // El servidor dejó de considerarnos activos (p. ej. tras suspender el equipo): volver a entrar
  onExpired: () => void;
};

// Vista principal de la sala, con la lista de participantes en vivo (RF-08, RF-10)
export function RoomView({ state, onExpired }: Props) {
  const me = useMemo<PresencePayload>(() => {
    const self = state.participants.find((p) => p.id === state.me);
    if (!self) throw new Error("El participante actual no está en el estado de la sala");
    return { participantId: self.id, nickname: self.nickname, role: self.role };
  }, [state]);

  const participants = useRoomPresence({
    roomId: state.room.id,
    me,
    initialParticipants: state.participants,
    onExpired,
  });

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="gap-3">
        <CardTitle>
          <h1 className="text-xl font-semibold break-words">{state.room.name}</h1>
        </CardTitle>
        <CopyLinkButton roomId={state.room.id} />
      </CardHeader>
      <CardContent>
        <ParticipantList participants={participants} />
      </CardContent>
    </Card>
  );
}
