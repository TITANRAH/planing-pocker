import { z } from "zod";
import { roomIdSchema } from "@/lib/schemas/room";

// Esquemas de la votación, compartidos entre cliente y servidor (Constitución, Art. IV y VI.4)

export const DECK = ["0", "1", "2", "3", "5", "8", "13", "21", "?", "☕"] as const;
export const cardSchema = z.enum(DECK);

export const taskTitleSchema = z
  .string()
  .trim()
  .min(3, "El título debe tener entre 3 y 100 caracteres")
  .max(100, "El título debe tener entre 3 y 100 caracteres");

// Opcional; vacío o solo espacios equivale a no tener detalle
export const taskDetailSchema = z
  .string()
  .trim()
  .max(300, "El detalle no puede superar los 300 caracteres")
  .nullish()
  .transform((detail) => (detail ? detail : null));

export const newTaskInput = z.object({
  roomId: roomIdSchema,
  title: taskTitleSchema,
  detail: taskDetailSchema,
  // Confirmación de que se descartan los votos de la ronda actual (RF-08)
  discardVotes: z.boolean().default(false),
});

export const editTaskInput = z.object({
  roomId: roomIdSchema,
  taskId: z.string().min(1),
  title: taskTitleSchema,
  detail: taskDetailSchema,
});

export const castVoteInput = z.object({
  roomId: roomIdSchema,
  roundId: z.string().min(1),
  card: cardSchema,
});

export const clearVoteInput = z.object({
  roomId: roomIdSchema,
  roundId: z.string().min(1),
});

export const taskViewSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  detail: z.string().nullable(),
});

// Broadcast emitidos por el servidor. `vote` es estricto: nunca puede llevar la carta (Art. VI)
export const taskEventSchema = z.object({
  roundId: z.string().min(1),
  task: taskViewSchema,
});

export const voteEventSchema = z.strictObject({
  roundId: z.string().min(1),
  participantId: z.string().min(1),
  voted: z.boolean(),
});

export type Card = z.infer<typeof cardSchema>;
export type TaskView = z.infer<typeof taskViewSchema>;
export type TaskEvent = z.infer<typeof taskEventSchema>;
export type VoteEvent = z.infer<typeof voteEventSchema>;
