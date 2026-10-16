import { z } from "zod";

// Esquemas compartidos entre cliente y servidor (Constitución, Art. IV)

export const roomNameSchema = z
  .string()
  .trim()
  .min(3, "El nombre debe tener entre 3 y 50 caracteres")
  .max(50, "El nombre debe tener entre 3 y 50 caracteres");

export const nicknameSchema = z
  .string()
  .trim()
  .min(2, "El apodo debe tener entre 2 y 20 caracteres")
  .max(20, "El apodo debe tener entre 2 y 20 caracteres");

export const roomIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{12}$/, "Identificador de sala inválido");

export const roleSchema = z.enum(["MODERATOR", "PLAYER"]);

export const createRoomInput = z.object({
  roomName: roomNameSchema,
  nickname: nicknameSchema,
});

export const joinRoomInput = z.object({
  roomId: roomIdSchema,
  nickname: nicknameSchema,
});

export const presencePayloadSchema = z.object({
  participantId: z.string().min(1),
  nickname: nicknameSchema,
  role: roleSchema,
});

export type Role = z.infer<typeof roleSchema>;
export type CreateRoomInput = z.infer<typeof createRoomInput>;
export type JoinRoomInput = z.infer<typeof joinRoomInput>;
export type PresencePayload = z.infer<typeof presencePayloadSchema>;
