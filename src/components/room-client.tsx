"use client";

import { useCallback, useEffect, useState } from "react";
import { JoinRoomForm } from "@/components/join-room-form";
import { RoomFull } from "@/components/room-full";
import { RoomNotFound } from "@/components/room-not-found";
import { RoomView } from "@/components/room-view";
import { Skeleton } from "@/components/ui/skeleton";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ActionError, RoomState } from "@/server/room-service";
import { getRoomState, resumeSession } from "@/server/rooms";

type Status =
  | { kind: "loading" }
  | { kind: "ready"; state: RoomState }
  | { kind: "join"; mode: "new" | "rename" }
  | { kind: "full" }
  | { kind: "not-found" }
  | { kind: "error" };

function statusForError(error: ActionError): Status {
  switch (error) {
    case "NOT_A_PARTICIPANT":
      return { kind: "join", mode: "new" };
    case "NICKNAME_TAKEN":
      return { kind: "join", mode: "rename" };
    case "ROOM_FULL":
      return { kind: "full" };
    case "ROOM_NOT_FOUND":
    case "VALIDATION":
      return { kind: "not-found" };
    // Errores de votación y del historial: no llegan al cargar la sala
    case "NOT_MODERATOR":
    case "VOTES_PRESENT":
    case "ROUND_CLOSED":
    case "NO_VOTES":
    case "ROUND_NOT_REVEALED":
    case "ESTIMATE_PRESENT":
    case "TASK_NOT_FOUND":
    case "TASK_IS_CURRENT":
      return { kind: "error" };
  }
}

// Decide qué ve quien abre el link de la sala, según su sesión (cookie): RF-04, RF-06, RF-07, RF-09
export function RoomClient({ roomId }: { roomId: string }) {
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  const load = useCallback(async (): Promise<Status> => {
    const session = await resumeSession(roomId);
    if (!session.ok) return statusForError(session.error);
    const state = await getRoomState(roomId);
    return state.ok ? { kind: "ready", state: state.data } : statusForError(state.error);
  }, [roomId]);

  const reload = useCallback(() => {
    void load().then(setStatus);
  }, [load]);

  // Abre la conexión de Realtime mientras se resuelve la sesión o se escribe el apodo: así, al
  // entrar a la sala, los demás nos ven en 2 s o menos (RF-08)
  useEffect(() => {
    getSupabaseBrowserClient().realtime.connect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void load().then((next) => {
      if (!cancelled) setStatus(next);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  switch (status.kind) {
    case "loading":
      return <RoomSkeleton />;
    case "ready":
      return <RoomView state={status.state} onExpired={reload} />;
    case "join":
      return (
        <JoinRoomForm
          roomId={roomId}
          mode={status.mode}
          onJoined={reload}
          onError={(error) => setStatus(statusForError(error))}
        />
      );
    case "full":
      return <RoomFull />;
    case "not-found":
      return <RoomNotFound />;
    case "error":
      return <p role="alert">No se pudo cargar la sala.</p>;
  }
}

export function RoomSkeleton() {
  return (
    <div className="flex w-full max-w-md flex-col gap-3" aria-label="Cargando sala">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
