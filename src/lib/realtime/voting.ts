import {
  estimateEventSchema,
  type NumericCard,
  type RevealEntryView,
  revealEventSchema,
} from "@/lib/schemas/reveal";
import { type Card, type TaskView, taskEventSchema, voteEventSchema } from "@/lib/schemas/voting";

// Estado de la votación en el cliente (spec 002 y 003). Reducer puro.
// Con la ronda abierta nunca contiene las cartas de los demás: solo quién votó y mi propio voto.
// Las cartas de todos llegan solo con la foto de la ronda revelada (Art. VI).

export type RoundPhase = "open" | "revealed";

export type VotingState = {
  roundId: string | null;
  phase: RoundPhase;
  task: TaskView | null;
  voted: readonly string[];
  myVote: Card | null;
  // Spec 003: foto fija de la ronda revelada y estimación final de la tarea
  entries: readonly RevealEntryView[];
  estimate: NumericCard | null;
};

export type VotingSnapshot = {
  task: TaskView | null;
  round: { id: string; status?: "OPEN" | "REVEALED" } | null;
  voted: readonly string[];
  myVote: Card | null;
  entries?: readonly RevealEntryView[];
  estimate?: NumericCard | null;
};

export type VotingEvent =
  // Estado completo pedido al servidor (al suscribirse y en cada latido)
  | { type: "snapshot"; snapshot: VotingSnapshot }
  // Broadcast `task`: tarea nueva (otra ronda) o editada (misma ronda)
  | { type: "task"; payload: unknown }
  // Broadcast `vote`: alguien votó o quitó su voto
  | { type: "vote"; payload: unknown }
  // Mi propio voto tras una acción confirmada por el servidor
  | { type: "myVote"; roundId: string; card: Card | null }
  // Broadcast `reveal`: la foto fija de la ronda (spec 003)
  | { type: "reveal"; payload: unknown }
  // Broadcast `estimate`: estimación final fijada o borrada (spec 003)
  | { type: "estimate"; payload: unknown };

export function initialVotingState(snapshot: VotingSnapshot): VotingState {
  const revealed = snapshot.round?.status === "REVEALED";
  return {
    roundId: snapshot.round?.id ?? null,
    phase: revealed ? "revealed" : "open",
    task: snapshot.round ? snapshot.task : null,
    voted: revealed ? [] : [...snapshot.voted],
    myVote: snapshot.round && !revealed ? snapshot.myVote : null,
    entries: revealed ? [...(snapshot.entries ?? [])] : [],
    estimate: snapshot.round ? (snapshot.estimate ?? null) : null,
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
      // Ronda nueva (nueva tarea o volver a votar): todo empieza de cero
      return { roundId, phase: "open", task, voted: [], myVote: null, entries: [], estimate: null };
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
    case "reveal": {
      const parsed = revealEventSchema.safeParse(event.payload);
      if (!parsed.success || parsed.data.roundId !== state.roundId) return state;
      return { ...state, phase: "revealed", entries: parsed.data.entries, voted: [], myVote: null };
    }
    case "estimate": {
      const parsed = estimateEventSchema.safeParse(event.payload);
      if (!parsed.success || parsed.data.roundId !== state.roundId) return state;
      return { ...state, estimate: parsed.data.estimate };
    }
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
