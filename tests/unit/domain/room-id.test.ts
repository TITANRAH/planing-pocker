import { describe, expect, it } from "vitest";
import { generateRoomId } from "@/lib/domain/room-id";
import { roomIdSchema } from "@/lib/schemas/room";

describe("generateRoomId", () => {
  it("RF-03: genera identificadores de 12 caracteres base64url", () => {
    const id = generateRoomId();
    expect(id).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(roomIdSchema.safeParse(id).success).toBe(true);
  });

  it("RF-03: 1.000 identificadores no se repiten", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateRoomId()));
    expect(ids.size).toBe(1000);
  });

  it("RF-03: dos salas seguidas reciben identificadores distintos y no consecutivos", () => {
    const a = generateRoomId();
    const b = generateRoomId();
    expect(a).not.toBe(b);
    // No comparten prefijo largo: no es un contador ni deriva del nombre
    expect(a.slice(0, 6)).not.toBe(b.slice(0, 6));
  });
});
