import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

// RF-07: el link no corresponde a ninguna sala
export function RoomNotFound() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl font-semibold">Esta sala no existe</h1>
        </CardTitle>
        <CardDescription>Revisa el link o crea una sala nueva para tu equipo.</CardDescription>
      </CardHeader>
      <CardFooter>
        <Link href="/" className={buttonVariants()}>
          Crear una sala nueva
        </Link>
      </CardFooter>
    </Card>
  );
}
