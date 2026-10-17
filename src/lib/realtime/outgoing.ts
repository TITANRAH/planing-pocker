import {
  type ByePayload,
  byePayloadSchema,
  type PresencePayload,
  presencePayloadSchema,
} from "@/lib/schemas/room";
import {
  type EstimateEvent,
  estimateEventSchema,
  type RevealEvent,
  revealEventSchema,
} from "@/lib/schemas/reveal";
import {
  type TaskEvent,
  taskEventSchema,
  type VoteEvent,
  voteEventSchema,
} from "@/lib/schemas/voting";

// Payloads de los mensajes Realtime que se envían, validados con Zod antes de salir
// (Constitución, Art. IV.1: validación al enviar y al recibir)

export function helloPayload(input: unknown): PresencePayload {
  return presencePayloadSchema.parse(input);
}

export function byePayload(participantId: string): ByePayload {
  return byePayloadSchema.parse({ participantId });
}

// Broadcast de votación emitidos por el servidor (spec 002). `vote` nunca lleva la carta (Art. VI)
export function taskEventPayload(input: unknown): TaskEvent {
  return taskEventSchema.parse(input);
}

export function voteEventPayload(input: unknown): VoteEvent {
  return voteEventSchema.parse(input);
}

// Broadcast del revelado (spec 003): la foto lleva las cartas, porque la ronda ya se reveló (Art. VI)
export function revealEventPayload(input: unknown): RevealEvent {
  return revealEventSchema.parse(input);
}

export function estimateEventPayload(input: unknown): EstimateEvent {
  return estimateEventSchema.parse(input);
}
