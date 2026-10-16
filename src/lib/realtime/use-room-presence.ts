"use client";

import { useEffect, useReducer, useRef } from "react";
import {
  initialPresenceState,
  type InitialParticipant,
  listParticipants,
  newlyDisconnected,
  presenceReducer,
  type PresenceEntry,
} from "@/lib/realtime/presence";
import type { PresencePayload } from "@/lib/schemas/room";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { heartbeat, markDisconnected } from "@/server/rooms";

// Cada cliente se vuelve a anunciar y envía su latido al servidor cada 15 s (plan, §1 y §4)
const ANNOUNCE_INTERVAL_MS = 15 * 1000;
const TICK_INTERVAL_MS = 1000;

type Options = {
  roomId: string;
  me: PresencePayload;
  initialParticipants: readonly InitialParticipant[];
  // El servidor ya no nos considera activos: hay que volver con resumeSession
  onExpired: () => void;
};

export function useRoomPresence({
  roomId,
  me,
  initialParticipants,
  onExpired,
}: Options): PresenceEntry[] {
  const [state, dispatch] = useReducer(presenceReducer, null, () =>
    initialPresenceState(initialParticipants, Date.now()),
  );

  // Avisa al servidor de quien acaba de desconectarse (si varios clientes avisan, gana el primero)
  const previous = useRef(state);
  useEffect(() => {
    const gone = newlyDisconnected(previous.current, state).filter((id) => id !== me.participantId);
    previous.current = state;
    for (const participantId of gone) void markDisconnected({ roomId, participantId });
  }, [state, roomId, me.participantId]);

  const onExpiredRef = useRef(onExpired);
  useEffect(() => {
    onExpiredRef.current = onExpired;
  }, [onExpired]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase.channel(`room:${roomId}`, {
      config: { presence: { key: me.participantId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const payloads = Object.values(channel.presenceState()).flat();
        dispatch({ type: "sync", payloads, now: Date.now() });
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        for (const payload of newPresences) dispatch({ type: "seen", payload, now: Date.now() });
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void channel.track(me);
      });

    const announce = setInterval(() => {
      void channel.track(me);
      void heartbeat(roomId).then((result) => {
        if (!result.ok && result.error === "NOT_A_PARTICIPANT") onExpiredRef.current();
      });
    }, ANNOUNCE_INTERVAL_MS);
    const tick = setInterval(() => dispatch({ type: "tick", now: Date.now() }), TICK_INTERVAL_MS);

    return () => {
      clearInterval(announce);
      clearInterval(tick);
      void supabase.removeChannel(channel);
    };
  }, [roomId, me]);

  return listParticipants(state);
}
