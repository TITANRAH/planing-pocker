"use client";

import { useMemo } from "react";
import { CardDeck } from "@/components/card-deck";
import { CopyLinkButton } from "@/components/copy-link-button";
import { ParticipantList } from "@/components/participant-list";
import { TaskPanel } from "@/components/task-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { VoteCounter } from "@/components/vote-counter";
import { useRoomChannel } from "@/lib/realtime/use-room-channel";
import { useRoomPresence } from "@/lib/realtime/use-room-presence";
import { useRoomVoting } from "@/lib/realtime/use-room-voting";
import { hasVoted, voteCount } from "@/lib/realtime/voting";
import type { PresencePayload } from "@/lib/schemas/room";
import type { RoomState } from "@/server/room-service";

type Props = {
  state: RoomState;
  // El servidor dejó de considerarnos activos (p. ej. tras suspender el equipo): volver a entrar
  onExpired: () => void;
};

// Vista principal de la sala: tarea, cartas y participantes en vivo (spec 001 y 002)
export function RoomView({ state, onExpired }: Props) {
  const me = useMemo<PresencePayload>(() => {
    const self = state.participants.find((p) => p.id === state.me);
    if (!self) throw new Error("El participante actual no está en el estado de la sala");
    return { participantId: self.id, nickname: self.nickname, role: self.role };
  }, [state]);

  const channel = useRoomChannel(state.room.id, me.participantId);
  const participants = useRoomPresence({
    channel,
    roomId: state.room.id,
    me,
    initialParticipants: state.participants,
    onExpired,
  });
  const voting = useRoomVoting({ channel, roomId: state.room.id, initial: state });

  const isModerator = me.role === "MODERATOR";
  const hasModerator = participants.some((p) => p.role === "MODERATOR");
  const count = voteCount(
    voting.state,
    participants.map((p) => p.id),
  );
  const listed = participants.map((p) => ({ ...p, voted: hasVoted(voting.state, p.id) }));

  return (
    <Card className="w-full min-w-0 max-w-md">
      <CardHeader className="min-w-0 gap-3">
        <CardTitle className="min-w-0">
          <h1 className="text-xl font-semibold wrap-anywhere">{state.room.name}</h1>
        </CardTitle>
        <CopyLinkButton roomId={state.room.id} />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <TaskPanel
          roomId={state.room.id}
          task={voting.state.task}
          isModerator={isModerator}
          hasModerator={hasModerator}
          onChanged={() => void voting.refresh()}
        />
        <CardDeck
          myVote={voting.state.myVote}
          enabled={voting.state.roundId !== null}
          onVote={voting.vote}
        />
        <Separator />
        <VoteCounter voted={count.voted} total={count.total} />
        <ParticipantList participants={listed} />
      </CardContent>
    </Card>
  );
}
