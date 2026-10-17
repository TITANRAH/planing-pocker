"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { NUMERIC_CARDS, type NumericCard } from "@/lib/schemas/reveal";

type Props = {
  estimate: NumericCard | null;
  // Carta más cercana al promedio; null si no hay promedio (RF-07)
  suggestion: NumericCard | null;
  onPick: (card: NumericCard) => Promise<void>;
};

// RF-07: el moderador fija la estimación final con una carta numérica
export function EstimatePicker({ estimate, suggestion, onPick }: Props) {
  const [sending, setSending] = useState(false);

  async function pick(card: NumericCard) {
    setSending(true);
    try {
      await onPick(card);
    } finally {
      setSending(false);
    }
  }

  return (
    <div role="group" aria-label="Estimación final" className="flex flex-col gap-2">
      <p className="text-sm font-medium">Fija la estimación final</p>
      <div className="grid grid-cols-4 gap-2">
        {NUMERIC_CARDS.map((card) => {
          const suggested = suggestion === card;
          return (
            <Button
              key={card}
              type="button"
              variant={estimate === card ? "default" : "outline"}
              className={suggested ? "h-12 ring-2 ring-primary/40" : "h-12"}
              aria-label={`Estimar ${card}${suggested ? " (sugerida)" : ""}`}
              aria-pressed={estimate === card}
              disabled={sending}
              onClick={() => void pick(card)}
            >
              {card}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
