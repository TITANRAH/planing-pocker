"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { NumericCard } from "@/lib/schemas/reveal";

type Props = {
  estimate: NumericCard | null;
  onRevote: () => Promise<void>;
};

// RF-08: nueva ronda con la misma tarea; si hay estimación fijada, se confirma antes de borrarla
export function RevoteButton({ estimate, onRevote }: Props) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => (estimate === null ? void onRevote() : setConfirming(true))}
      >
        Volver a votar
      </Button>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Volver a votar esta tarea?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrará la estimación final: {estimate}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirming(false);
                void onRevote();
              }}
            >
              Sí, volver a votar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
