import { describe, expect, it } from "vitest";
import { generateToken, hashToken, tokenSchema } from "@/server/token";

describe("tokens de participante", () => {
  it("RF-09: genera tokens de 32 bytes en base64url (43 caracteres)", () => {
    const token = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateToken()).not.toBe(token);
  });

  it("RF-09: el hash es determinista y distinto del token", () => {
    const token = generateToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toBe(token);
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("RF-09: rechaza tokens con formato inválido", () => {
    expect(tokenSchema.safeParse(generateToken()).success).toBe(true);
    expect(tokenSchema.safeParse("corto").success).toBe(false);
    expect(tokenSchema.safeParse("!".repeat(43)).success).toBe(false);
    expect(tokenSchema.safeParse(undefined).success).toBe(false);
  });
});
