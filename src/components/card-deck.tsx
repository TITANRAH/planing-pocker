"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { type Card, DECK } from "@/lib/schemas/voting";

type Props = {
  myVote: Card | null;
  // Solo se puede votar con una ronda abierta (RF-09)
  enabled: boolean;
  onVote: (card: Card) => Promise<void>;
};

// Baraja Fibonacci (RF-03). Tocar la carta elegida quita el voto (RF-04)
export function CardDeck({ myVote, enabled, onVote }: Props) {
  const [sending, setSending] = useState(false);

  async function choose(card: Card) {
    setSending(true);
    try {
      await onVote(card);
    } finally {
      setSending(false);
    }
  }

  return (
    <div role="group" aria-label="Cartas" className="grid grid-cols-5 gap-2">
      {DECK.map((card) => {
        const selected = myVote === card;
        return (
          <Button
            key={card}
            type="button"
            variant={selected ? "default" : "outline"}
            className="h-14 text-lg font-semibold"
            aria-label={`Carta ${card}`}
            aria-pressed={selected}
            disabled={!enabled || sending}
            onClick={() => void choose(card)}
          >
            {card}
          </Button>
        );
      })}
    </div>
  );
}
