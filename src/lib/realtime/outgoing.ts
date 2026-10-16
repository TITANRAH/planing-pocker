import {
  type ByePayload,
  byePayloadSchema,
  type PresencePayload,
  presencePayloadSchema,
} from "@/lib/schemas/room";

// Payloads de los mensajes Realtime que se envían, validados con Zod antes de salir
// (Constitución, Art. IV.1: validación al enviar y al recibir)

export function helloPayload(input: unknown): PresencePayload {
  return presencePayloadSchema.parse(input);
}

export function byePayload(participantId: string): ByePayload {
  return byePayloadSchema.parse({ participantId });
}
