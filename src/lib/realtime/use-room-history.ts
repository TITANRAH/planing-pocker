"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomChannel } from "@/lib/realtime/use-room-channel";
import { z } from "zod";
import { type HistoryItem, historyItemSchema } from "@/lib/schemas/history";

type Options = { channel: RoomChannel; roomId: string };

export type RoomHistory = {
  // null mientras carga por primera vez
  items: HistoryItem[] | null;
  refresh: () => void;
};

const historyResponseSchema = z.array(historyItemSchema);

// Pide el historial al GET de la sala; null si falla o la respuesta no es válida
async function fetchHistory(roomId: string): Promise<HistoryItem[] | null> {
  try {
    const response = await fetch(`/api/rooms/${roomId}/history`, { cache: "no-store" });
    if (!response.ok) return null;
    const parsed = historyResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// Historial de la sala (spec 004): se pide al suscribirse y con cada broadcast `estimate`, que la
// spec 003 emite al fijar, cambiar o borrar una estimación (RF-07, RF-09)
export function useRoomHistory({ channel, roomId }: Options): RoomHistory {
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  // Una sola petición a la vez, para que una respuesta vieja no pise a una nueva; si llega otro
  // aviso mientras tanto, se repite al terminar para no quedarse con datos viejos
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
          const data = await fetchHistory(roomId);
          if (data) setItems(data);
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
