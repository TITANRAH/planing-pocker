import { NUMERIC_CARDS, type NumericCard } from "@/lib/schemas/reveal";
import type { Card } from "@/lib/schemas/voting";

// Resumen de una ronda revelada (RF-04 a RF-07). Función pura: se calcula a partir de la foto,
// tanto en el cliente como en el servidor, y no se guarda en la BD.

export type RoundSummary = {
  average: number | null;
  min: NumericCard | null;
  max: NumericCard | null;
  consensus: boolean;
  // Votos emitidos, incluidos "?" y "☕" (los "No votó" no cuentan)
  voteCount: number;
  suggestion: NumericCard | null;
};

function isNumeric(card: Card): card is NumericCard {
  return (NUMERIC_CARDS as readonly string[]).includes(card);
}

// Carta numérica más cercana al promedio; si empatan dos, la mayor
function nearestCard(average: number): NumericCard {
  let best: NumericCard = NUMERIC_CARDS[0];
  for (const card of NUMERIC_CARDS) {
    if (Math.abs(Number(card) - average) <= Math.abs(Number(best) - average)) best = card;
  }
  return best;
}

export function summarizeRound(cards: readonly (Card | null)[]): RoundSummary {
  const votes = cards.filter((card): card is Card => card !== null);
  const numeric = votes.filter(isNumeric);
  const values = numeric.map(Number);
  const average = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const sorted = [...numeric].sort((a, b) => Number(a) - Number(b));
  const [first] = votes;
  return {
    average,
    min: sorted[0] ?? null,
    max: sorted.at(-1) ?? null,
    // Al menos 2 votos y todos la misma carta numérica (un "?" o un "☕" lo rompe)
    consensus:
      votes.length >= 2 &&
      first !== undefined &&
      isNumeric(first) &&
      votes.every((card) => card === first),
    voteCount: votes.length,
    suggestion: average === null ? null : nearestCard(average),
  };
}

// "5,3", "5,0": coma decimal y siempre un decimal (RF-04)
export function formatAverage(average: number): string {
  return (Math.round(average * 10) / 10).toFixed(1).replace(".", ",");
}
