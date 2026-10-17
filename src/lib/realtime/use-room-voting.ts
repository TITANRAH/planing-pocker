"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { RoomChannel } from "@/lib/realtime/use-room-channel";
import {
  initialVotingState,
  type VotingSnapshot,
  votingReducer,
  type VotingState,
} from "@/lib/realtime/voting";
import type { Card } from "@/lib/schemas/voting";
import { castVote, clearVote, getRoomState } from "@/server/rooms";

// Pide el estado completo al suscribirse y cada 15 s: corrige cualquier evento perdido (plan 002, §4)
const REFRESH_INTERVAL_MS = 15 * 1000;

type Options = {
  channel: RoomChannel;
  roomId: string;
  initial: VotingSnapshot;
};

export type RoomVoting = {
  state: VotingState;
  // Elige una carta; si es la que ya tenía, quita el voto (RF-03, RF-04)
  vote: (card: Card) => Promise<void>;
  // Vuelve a pedir el estado al servidor (p. ej. tras cargar o editar la tarea)
  refresh: () => Promise<void>;
};

export function useRoomVoting({ channel, roomId, initial }: Options): RoomVoting {
  const [state, dispatch] = useReducer(votingReducer, initial, initialVotingState);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Un solo refresco a la vez: las Server Actions de cada navegador van en cola y un refresco
  // pendiente retrasaría el voto o la tarea del usuario
  const refreshing = useRef<Promise<void> | null>(null);
  const refresh = useCallback(() => {
    refreshing.current ??= getRoomState(roomId)
      .then((result) => {
        if (result.ok) dispatch({ type: "snapshot", snapshot: result.data });
      })
      .finally(() => {
        refreshing.current = null;
      });
    return refreshing.current;
  }, [roomId]);

  useEffect(() => {
    const unsubscribe = [
      channel.on("task", (payload) => dispatch({ type: "task", payload })),
      channel.on("vote", (payload) => dispatch({ type: "vote", payload })),
      channel.on("subscribed", () => void refresh()),
    ];
    const timer = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => {
      for (const off of unsubscribe) off();
      clearInterval(timer);
    };
  }, [channel, refresh]);

  const vote = useCallback(
    async (card: Card) => {
      const { roundId, myVote } = stateRef.current;
      if (!roundId) return;
      const removing = myVote === card;
      const result = removing
        ? await clearVote({ roomId, roundId })
        : await castVote({ roomId, roundId, card });
      if (result.ok) {
        dispatch({ type: "myVote", roundId, card: removing ? null : card });
      } else {
        // La ronda cambió mientras tanto (p. ej. nueva tarea): se recupera el estado real
        await refresh();
      }
    },
    [roomId, refresh],
  );

  return { state, vote, refresh };
}
