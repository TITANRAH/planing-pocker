"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomChannel } from "@/lib/realtime/use-room-channel";
import type { HistoryItem } from "@/lib/schemas/history";
import { getHistory } from "@/server/rooms";

type Options = { channel: RoomChannel; roomId: string };

export type RoomHistory = {
  // null mientras carga por primera vez
  items: HistoryItem[] | null;
  refresh: () => void;
};

// Historial de la sala (spec 004): se pide al suscribirse y con cada broadcast `estimate`, que la
// spec 003 emite al fijar, cambiar o borrar una estimación (RF-07, RF-09)
export function useRoomHistory({ channel, roomId }: Options): RoomHistory {
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  // Una sola petición a la vez (las Server Actions van en cola); si llega otro aviso mientras
  // tanto, se repite al terminar para no quedarse con datos viejos
  const running = useRef(false);
  const again = useRef(false);

  const refresh = useCallback(() => {
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    void (async () => {
      try {
        do {
          again.current = false;
          const result = await getHistory(roomId);
          if (result.ok) setItems(result.data);
        } while (again.current);
      } finally {
        running.current = false;
      }
    })();
  }, [roomId]);

  useEffect(() => {
    const unsubscribe = [channel.on("subscribed", refresh), channel.on("estimate", refresh)];
    return () => {
      for (const off of unsubscribe) off();
    };
  }, [channel, refresh]);

  return { items, refresh };
}
