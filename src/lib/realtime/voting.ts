import { type Card, type TaskView, taskEventSchema, voteEventSchema } from "@/lib/schemas/voting";

// Estado de la votación en el cliente (RF-02, RF-04, RF-06, RF-08, RF-13). Reducer puro.
// Nunca contiene las cartas de los demás: solo quién votó y mi propio voto (Art. VI).

export type VotingState = {
  roundId: string | null;
  task: TaskView | null;
  voted: readonly string[];
  myVote: Card | null;
};

export type VotingSnapshot = {
  task: TaskView | null;
  round: { id: string } | null;
  voted: readonly string[];
  myVote: Card | null;
};

export type VotingEvent =
  // Estado completo pedido al servidor (al suscribirse y en cada latido)
  | { type: "snapshot"; snapshot: VotingSnapshot }
  // Broadcast `task`: tarea nueva (otra ronda) o editada (misma ronda)
  | { type: "task"; payload: unknown }
  // Broadcast `vote`: alguien votó o quitó su voto
  | { type: "vote"; payload: unknown }
  // Mi propio voto tras una acción confirmada por el servidor
  | { type: "myVote"; roundId: string; card: Card | null };

export function initialVotingState(snapshot: VotingSnapshot): VotingState {
  return {
    roundId: snapshot.round?.id ?? null,
    task: snapshot.round ? snapshot.task : null,
    voted: [...snapshot.voted],
    myVote: snapshot.round ? snapshot.myVote : null,
  };
}

export function votingReducer(state: VotingState, event: VotingEvent): VotingState {
  switch (event.type) {
    case "snapshot":
      return initialVotingState(event.snapshot);
    case "task": {
      const parsed = taskEventSchema.safeParse(event.payload);
      if (!parsed.success) return state;
      const { roundId, task } = parsed.data;
      if (roundId === state.roundId) return { ...state, task };
      return { roundId, task, voted: [], myVote: null };
    }
    case "vote": {
      const parsed = voteEventSchema.safeParse(event.payload);
      if (!parsed.success || parsed.data.roundId !== state.roundId) return state;
      const { participantId, voted } = parsed.data;
      const others = state.voted.filter((id) => id !== participantId);
      return { ...state, voted: voted ? [...others, participantId] : others };
    }
    case "myVote":
      return event.roundId === state.roundId ? { ...state, myVote: event.card } : state;
  }
}

export function hasVoted(state: VotingState, participantId: string): boolean {
  return state.voted.includes(participantId);
}

// "N de M votaron": M son los participantes de la lista (los que están en la sala, RF-06/RF-11)
export function voteCount(
  state: VotingState,
  participantIds: readonly string[],
): { voted: number; total: number } {
  return {
    voted: participantIds.filter((id) => state.voted.includes(id)).length,
    total: participantIds.length,
  };
}
