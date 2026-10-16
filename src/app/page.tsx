import { CreateRoomForm } from "@/components/create-room-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            <h1 className="text-2xl font-semibold">Planning Poker</h1>
          </CardTitle>
          <CardDescription>
            Crea una sala, comparte el link y estimad juntos con cartas virtuales.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateRoomForm />
        </CardContent>
      </Card>
    </main>
  );
}
