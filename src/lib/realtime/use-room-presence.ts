"use client";

import { useEffect, useReducer, useRef } from "react";
import { helloPayload } from "@/lib/realtime/outgoing";
import {
  initialPresenceState,
  type InitialParticipant,
  listParticipants,
  newlyDisconnected,
  presenceReducer,
  type PresenceEntry,
} from "@/lib/realtime/presence";
import type { RoomChannel } from "@/lib/realtime/use-room-channel";
import type { PresencePayload } from "@/lib/schemas/room";
import { heartbeat, markDisconnected } from "@/server/rooms";

// Cada cliente se vuelve a anunciar y envía su latido al servidor cada 15 s (plan, §1 y §4)
const ANNOUNCE_INTERVAL_MS = 15 * 1000;
const TICK_INTERVAL_MS = 1000;

type Options = {
  channel: RoomChannel;
  roomId: string;
  me: PresencePayload;
  initialParticipants: readonly InitialParticipant[];
  // El servidor ya no nos considera activos: hay que volver con resumeSession
  onExpired: () => void;
};

export function useRoomPresence({
  channel,
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
    // La presence se replica entre servidores de Realtime por lotes (~2 s); el broadcast llega al
    // momento, así que adelanta los avisos de entrada y de salida (plan 001 v1.2/v1.3, RF-08/RF-10)
    const hello = helloPayload(me);
    const announce = () => {
      channel.track(hello);
      channel.send("hello", hello);
    };
    // Al cerrar la pestaña el WebSocket se corta: el aviso va por beacon y lo emite el servidor
    const sayBye = () => {
      navigator.sendBeacon(`/api/rooms/${roomId}/bye`);
    };
    // La página vuelve de la caché del navegador: anunciarse otra vez
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        announce();
        void heartbeat(roomId);
      }
    };

    const unsubscribe = [
      channel.on("presence-sync", (payloads) =>
        dispatch({ type: "sync", payloads, now: Date.now() }),
      ),
      channel.on("presence-join", (payloads) => {
        for (const payload of payloads) dispatch({ type: "seen", payload, now: Date.now() });
      }),
      channel.on("hello", (payload) => dispatch({ type: "seen", payload, now: Date.now() })),
      channel.on("bye", (payload) => dispatch({ type: "bye", payload, now: Date.now() })),
      channel.on("subscribed", announce),
    ];

    const announceTimer = setInterval(() => {
      announce();
      void heartbeat(roomId).then((result) => {
        if (!result.ok && result.error === "NOT_A_PARTICIPANT") onExpiredRef.current();
      });
    }, ANNOUNCE_INTERVAL_MS);
    const tick = setInterval(() => dispatch({ type: "tick", now: Date.now() }), TICK_INTERVAL_MS);
    window.addEventListener("pagehide", sayBye);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      for (const off of unsubscribe) off();
      window.removeEventListener("pagehide", sayBye);
      window.removeEventListener("pageshow", onPageShow);
      clearInterval(announceTimer);
      clearInterval(tick);
    };
  }, [channel, roomId, me]);

  return listParticipants(state);
}
