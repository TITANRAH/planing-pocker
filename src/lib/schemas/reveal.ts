import { z } from "zod";
import { roomIdSchema } from "@/lib/schemas/room";
import { cardSchema } from "@/lib/schemas/voting";

// Esquemas del revelado (spec 003), compartidos entre cliente y servidor (Art. IV y VI.4)

export const NUMERIC_CARDS = ["0", "1", "2", "3", "5", "8", "13", "21"] as const;
// La estimación final es siempre una carta numérica de la baraja (RF-07)
export const estimateSchema = z.enum(NUMERIC_CARDS);

export const revealInput = z.object({
  roomId: roomIdSchema,
  roundId: z.string().min(1),
});

export const setEstimateInput = z.object({
  roomId: roomIdSchema,
  roundId: z.string().min(1),
  card: estimateSchema,
});

export const revoteInput = z.object({
  roomId: roomIdSchema,
  roundId: z.string().min(1),
  // Confirmación de que se borra la estimación final ya fijada (RF-08)
  confirm: z.boolean().default(false),
});

// Una entrada de la foto fija: carta o null ("No votó")
export const revealEntrySchema = z.object({
  participantId: z.string().min(1),
  nickname: z.string(),
  card: cardSchema.nullable(),
});

// Broadcast emitidos por el servidor tras revelar: aquí las cartas sí viajan (Art. VI)
export const revealEventSchema = z.object({
  roundId: z.string().min(1),
  entries: z.array(revealEntrySchema),
});

export const estimateEventSchema = z.object({
  taskId: z.string().min(1),
  roundId: z.string().min(1),
  estimate: estimateSchema.nullable(),
});

export type NumericCard = z.infer<typeof estimateSchema>;
export type RevealEntryView = z.infer<typeof revealEntrySchema>;
export type RevealEvent = z.infer<typeof revealEventSchema>;
export type EstimateEvent = z.infer<typeof estimateEventSchema>;
