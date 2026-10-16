import { Suspense } from "react";
import { RoomClient, RoomSkeleton } from "@/components/room-client";

export default function RoomPage({ params }: PageProps<"/r/[roomId]">) {
  return (
    <main className="flex flex-1 items-start justify-center p-4 sm:items-center">
      <Suspense fallback={<RoomSkeleton />}>
        <RoomLoader params={params} />
      </Suspense>
    </main>
  );
}

async function RoomLoader({ params }: Pick<PageProps<"/r/[roomId]">, "params">) {
  const { roomId } = await params;
  return <RoomClient roomId={roomId} />;
}
