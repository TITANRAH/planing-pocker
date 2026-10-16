import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

// Token secreto del participante (RF-09): viaja solo en la cookie httpOnly;
// en la base de datos se guarda únicamente su hash.

export const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
