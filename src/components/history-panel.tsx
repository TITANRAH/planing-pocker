"use client";

import { DownloadIcon } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildHistoryCsv,
  formatHistoryTime,
  historyFileName,
  historySummary,
} from "@/lib/domain/history";
import { formatAverage, summarizeRound } from "@/lib/domain/reveal";
import type { HistoryItem, HistoryRound } from "@/lib/schemas/history";

type Props = {
  roomName: string;
  // null mientras carga por primera vez
  items: HistoryItem[] | null;
};

// RF-05: el CSV se genera y descarga en el navegador, con la hora local de quien exporta
function download(roomName: string, items: readonly HistoryItem[]) {
  const blob = new Blob([buildHistoryCsv(items)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = historyFileName(roomName, new Date());
  link.click();
  URL.revokeObjectURL(url);
}

function RoundDetail({ round, index }: { round: HistoryRound; index: number }) {
  const summary = summarizeRound(round.entries.map((e) => e.card));
  return (
    <div className="flex flex-col gap-0.5">
      <p className="font-medium">Ronda {index + 1}</p>
      <p className="wrap-anywhere text-muted-foreground">
        {round.entries.map((e) => `${e.nickname} ${e.card ?? "No votó"}`).join(" · ")}
      </p>
      <p className="text-muted-foreground">
        {summary.average === null ? "Sin promedio" : `Promedio: ${formatAverage(summary.average)}`}
        {summary.consensus && <span className="ml-2 font-semibold text-green-600">¡Consenso!</span>}
      </p>
    </div>
  );
}

// Historial de la sala (spec 004): tareas con estimación, resumen, detalle y exportación
export function HistoryPanel({ roomName, items }: Props) {
  const summary = historySummary(items ?? []);
  const empty = items !== null && items.length === 0;

  return (
    <section aria-label="Historial" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Historial</h2>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!items || items.length === 0}
          onClick={() => items && download(roomName, items)}
        >
          <DownloadIcon aria-hidden />
          Exportar CSV
        </Button>
      </div>

      {items === null ? (
        <Skeleton className="h-10 w-full" />
      ) : empty ? (
        <p className="text-sm text-muted-foreground">Todavía no hay tareas estimadas</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {summary.count} {summary.count === 1 ? "tarea" : "tareas"} · {summary.points}{" "}
            {summary.points === 1 ? "punto" : "puntos"}
          </p>
          <Accordion>
            {items.map((item) => (
              <AccordionItem key={item.taskId} value={item.taskId}>
                <AccordionTrigger className="min-w-0">
                  <span className="truncate">
                    {item.title} · {item.estimate} · {formatHistoryTime(item.estimatedAt)}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-col gap-2 text-sm">
                    {item.detail && <p className="wrap-anywhere">{item.detail}</p>}
                    {item.rounds.map((round, index) => (
                      <RoundDetail key={round.roundId} round={round} index={index} />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </>
      )}
    </section>
  );
}
