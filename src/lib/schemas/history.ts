import { z } from "zod";
import { estimateSchema, revealEntrySchema } from "@/lib/schemas/reveal";
import { roomIdSchema } from "@/lib/schemas/room";

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

// Borrado de una tarea del historial por el moderador (RF-11)
export const deleteHistoryItemInput = z.object({
  roomId: roomIdSchema,
  taskId: z.string().min(1),
});

// Broadcast tras el borrado: solo el id de la tarea, sin cartas (Art. VI)
export const historyDeletedEventSchema = z.strictObject({
  taskId: z.string().min(1),
});

export type HistoryRound = z.infer<typeof historyRoundSchema>;
export type HistoryItem = z.infer<typeof historyItemSchema>;
export type HistoryDeletedEvent = z.infer<typeof historyDeletedEventSchema>;
