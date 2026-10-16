"use client";

import { CopyIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const noSubscribe = () => () => {};

// RF-02: link de la sala visible y copiable con un clic
export function CopyLinkButton({ roomId }: { roomId: string }) {
  // El origen solo se conoce en el navegador; en el servidor se renderiza vacío
  const link = useSyncExternalStore(
    noSubscribe,
    () => `${window.location.origin}/r/${roomId}`,
    () => "",
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado");
    } catch {
      toast.error("No se pudo copiar el link. Cópialo a mano.");
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
      <span className="flex-1 truncate font-mono text-sm" title={link}>
        {link}
      </span>
      <Button type="button" size="sm" variant="outline" onClick={copy} disabled={!link}>
        <CopyIcon aria-hidden />
        Copiar link
      </Button>
    </div>
  );
}
