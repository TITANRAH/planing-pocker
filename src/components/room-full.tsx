import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MAX_PARTICIPANTS } from "@/lib/domain/room";

// RF-06: la sala alcanzó el máximo de participantes
export function RoomFull() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl font-semibold">
            La sala está llena ({MAX_PARTICIPANTS}/{MAX_PARTICIPANTS})
          </h1>
        </CardTitle>
        <CardDescription>Vuelve a intentarlo cuando alguien salga de la sala.</CardDescription>
      </CardHeader>
    </Card>
  );
}
