import type { RevealEntryView } from "@/lib/schemas/reveal";

// RF-03: foto fija de la ronda revelada, con la carta de cada uno o "No votó"
export function RevealedRound({ entries }: { entries: readonly RevealEntryView[] }) {
  return (
    <ul aria-label="Cartas reveladas" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {entries.map((entry) => (
        <li
          key={entry.participantId}
          className="flex min-w-0 items-center justify-between gap-2 rounded-md border px-3 py-2"
        >
          <span className="truncate">{entry.nickname}</span>
          {entry.card === null ? (
            <span className="shrink-0 text-sm text-muted-foreground">No votó</span>
          ) : (
            <span className="shrink-0 text-lg font-semibold">{entry.card}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
