import { z } from "zod";
import { estimateSchema, revealEntrySchema } from "@/lib/schemas/reveal";

// Historial de la sala (spec 004): tareas con estimación y sus rondas reveladas. Solo incluye
// rondas reveladas, así que las cartas que contiene ya son públicas (Art. VI). Las fechas se
// coercionan porque en JSON (GET del historial) llegan como texto ISO

export const historyRoundSchema = z.object({
  roundId: z.string().min(1),
  revealedAt: z.coerce.date(),
  entries: z.array(revealEntrySchema),
});

export const historyItemSchema = z.object({
  taskId: z.string().min(1),
  title: z.string(),
  detail: z.string().nullable(),
  estimate: estimateSchema,
  estimatedAt: z.coerce.date(),
  rounds: z.array(historyRoundSchema),
});

export type HistoryRound = z.infer<typeof historyRoundSchema>;
export type HistoryItem = z.infer<typeof historyItemSchema>;
