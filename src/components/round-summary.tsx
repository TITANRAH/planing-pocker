import { formatAverage, type RoundSummary as Summary } from "@/lib/domain/reveal";

// RF-04 a RF-06: promedio, mínimo, máximo y consenso de la ronda revelada
export function RoundSummary({ summary }: { summary: Summary }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p className="font-medium">
        {summary.average === null ? "Sin promedio" : `Promedio: ${formatAverage(summary.average)}`}
      </p>
      {summary.min !== null && summary.max !== null && (
        <p className="text-muted-foreground">
          <span>Mínimo: {summary.min}</span> · <span>Máximo: {summary.max}</span>
        </p>
      )}
      {summary.consensus && <p className="font-semibold text-green-600">¡Consenso!</p>}
      {summary.voteCount === 1 && <p className="text-muted-foreground">Solo votó 1 persona</p>}
    </div>
  );
}
