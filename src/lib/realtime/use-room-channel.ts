"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

// Un único canal de Realtime por sala, compartido por la presence (spec 001), la votación
// (spec 002) y el revelado (spec 003). Funciona como un bus: el canal se suscribe una vez y
// reparte cada evento a los hooks que se hayan registrado con `on` (plan 002, §4).

const BROADCAST_EVENTS = ["hello", "bye", "task", "vote", "reveal", "estimate"] as const;
export type BroadcastEvent = (typeof BROADCAST_EVENTS)[number];

type ChannelEvents = {
  subscribed: () => void;
  "presence-sync": (payloads: unknown[]) => void;
  "presence-join": (payloads: unknown[]) => void;
} & Record<BroadcastEvent, (payload: unknown) => void>;

type EventName = keyof ChannelEvents;
type AnyListener = (arg?: unknown) => void;

export type RoomChannel = {
  on<E extends EventName>(event: E, listener: ChannelEvents[E]): () => void;
  track(payload: Record<string, unknown>): void;
  send(event: BroadcastEvent, payload: Record<string, unknown>): void;
};

export function useRoomChannel(roomId: string, presenceKey: string): RoomChannel {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribedRef = useRef(false);
  const listeners = useRef(new Map<EventName, Set<AnyListener>>());

  const emit = useCallback((event: EventName, arg?: unknown) => {
    for (const listener of listeners.current.get(event) ?? []) listener(arg);
  }, []);

  const bus = useMemo<RoomChannel>(
    () => ({
      on(event, listener) {
        const set = listeners.current.get(event) ?? new Set<AnyListener>();
        const fn = listener as AnyListener;
        set.add(fn);
        listeners.current.set(event, set);
        // Quien se registra tarde no se pierde la suscripción ya hecha
        if (event === "subscribed" && subscribedRef.current) fn();
        return () => {
          set.delete(fn);
        };
      },
      track(payload) {
        void channelRef.current?.track(payload);
      },
      send(event, payload) {
        void channelRef.current?.send({ type: "broadcast", event, payload });
      },
    }),
    [],
  );

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase.channel(`room:${roomId}`, {
      config: { presence: { key: presenceKey }, broadcast: { self: false } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        emit("presence-sync", Object.values(channel.presenceState()).flat());
      })
      .on("presence", { event: "join" }, ({ newPresences }) => emit("presence-join", newPresences));
    for (const event of BROADCAST_EVENTS) {
      channel.on("broadcast", { event }, ({ payload }) => emit(event, payload));
    }
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        subscribedRef.current = true;
        emit("subscribed");
      }
    });
    channelRef.current = channel;

    return () => {
      subscribedRef.current = false;
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [emit, roomId, presenceKey]);

  return bus;
}
