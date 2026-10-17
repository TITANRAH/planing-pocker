"use client";

import { useMemo } from "react";
import { CardDeck } from "@/components/card-deck";
import { CopyLinkButton } from "@/components/copy-link-button";
import { EstimatePicker } from "@/components/estimate-picker";
import { ParticipantList } from "@/components/participant-list";
import { RevealButton } from "@/components/reveal-button";
import { RevealedRound } from "@/components/revealed-round";
import { RevoteButton } from "@/components/revote-button";
import { RoundSummary } from "@/components/round-summary";
import { TaskPanel } from "@/components/task-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { VoteCounter } from "@/components/vote-counter";
import { useRoomChannel } from "@/lib/realtime/use-room-channel";
import { useRoomPresence } from "@/lib/realtime/use-room-presence";
import { useRoomVoting } from "@/lib/realtime/use-room-voting";
import { summarizeRound } from "@/lib/domain/reveal";
import { hasVoted, voteCount } from "@/lib/realtime/voting";
import type { NumericCard } from "@/lib/schemas/reveal";
import type { PresencePayload } from "@/lib/schemas/room";
import type { RoomState } from "@/server/room-service";
import { revealRound, revote, setEstimate } from "@/server/rooms";

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
  const { roundId, phase, task, entries, estimate } = voting.state;
  const revealed = phase === "revealed";
  const summary = revealed ? summarizeRound(entries.map((e) => e.card)) : null;

  // Acciones del moderador (spec 003). Si el servidor las confirma, se aplican al momento sin
  // esperar al broadcast; si fallan (p. ej. otra ronda), se recupera el estado real
  async function reveal() {
    if (!roundId) return;
    const result = await revealRound({ roomId: state.room.id, roundId });
    if (result.ok) voting.apply({ type: "reveal", payload: result.data });
    else await voting.refresh();
  }

  async function pickEstimate(card: NumericCard) {
    if (!roundId || !task) return;
    const result = await setEstimate({ roomId: state.room.id, roundId, card });
    if (result.ok) {
      voting.apply({ type: "estimate", payload: { taskId: task.id, roundId, estimate: card } });
    } else await voting.refresh();
  }

  async function revoteRound() {
    if (!roundId) return;
    const result = await revote({ roomId: state.room.id, roundId, confirm: true });
    if (result.ok) voting.apply({ type: "task", payload: result.data });
    else await voting.refresh();
  }

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
        {revealed && summary && (
          <section aria-label="Resultado" className="flex flex-col gap-3">
            <RevealedRound entries={entries} />
            <RoundSummary summary={summary} />
            {estimate !== null && (
              <p className="text-lg font-semibold">Estimación final: {estimate}</p>
            )}
            {isModerator && (
              <>
                <EstimatePicker
                  estimate={estimate}
                  suggestion={summary.suggestion}
                  onPick={pickEstimate}
                />
                <RevoteButton estimate={estimate} onRevote={revoteRound} />
              </>
            )}
          </section>
        )}
        {/* Con la ronda revelada la baraja se oculta: no se puede votar (RF-02, plan 003 v1.1) */}
        {!revealed && (
          <CardDeck myVote={voting.state.myVote} enabled={roundId !== null} onVote={voting.vote} />
        )}
        {isModerator && roundId !== null && !revealed && (
          <RevealButton hasVotes={voting.state.voted.length > 0} onReveal={reveal} />
        )}
        <Separator />
        {!revealed && <VoteCounter voted={count.voted} total={count.total} />}
        <ParticipantList participants={listed} />
      </CardContent>
    </Card>
  );
}
