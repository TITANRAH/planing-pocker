"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  hasVotes: boolean;
  onReveal: () => Promise<void>;
};

// RF-01: el moderador revela los votos de la ronda abierta (al menos un voto)
export function RevealButton({ hasVotes, onReveal }: Props) {
  const [sending, setSending] = useState(false);

  async function reveal() {
    setSending(true);
    try {
      await onReveal();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" disabled={!hasVotes || sending} onClick={() => void reveal()}>
        Revelar cartas
      </Button>
      {!hasVotes && <p className="text-center text-sm text-muted-foreground">Nadie votó todavía</p>}
    </div>
  );
}
