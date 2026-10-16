import { describe, expect, it } from "vitest";
import {
  byePayloadSchema,
  createRoomInput,
  joinRoomInput,
  nicknameSchema,
  presencePayloadSchema,
  roomIdSchema,
  roomNameSchema,
} from "@/lib/schemas/room";

describe("roomNameSchema", () => {
  it("RF-01: acepta nombres de 3 a 50 caracteres", () => {
    expect(roomNameSchema.safeParse("abc").success).toBe(true);
    expect(roomNameSchema.safeParse("a".repeat(50)).success).toBe(true);
  });

  it("RF-01: rechaza nombres de menos de 3 o más de 50 caracteres", () => {
    expect(roomNameSchema.safeParse("ab").success).toBe(false);
    expect(roomNameSchema.safeParse("a".repeat(51)).success).toBe(false);
  });

  it("RF-01: recorta los espacios antes de validar", () => {
    expect(roomNameSchema.parse("  Sprint 12  ")).toBe("Sprint 12");
    expect(roomNameSchema.safeParse("   ab   ").success).toBe(false);
  });

  it("RF-01: el error está en español", () => {
    const result = roomNameSchema.safeParse("ab");
    expect(result.error?.issues[0]?.message).toBe("El nombre debe tener entre 3 y 50 caracteres");
  });
});

describe("nicknameSchema", () => {
  it("RF-04: acepta apodos de 2 a 20 caracteres", () => {
    expect(nicknameSchema.safeParse("Jo").success).toBe(true);
    expect(nicknameSchema.safeParse("a".repeat(20)).success).toBe(true);
  });

  it("RF-04: rechaza apodos de menos de 2 o más de 20 caracteres", () => {
    expect(nicknameSchema.safeParse("J").success).toBe(false);
    expect(nicknameSchema.safeParse("a".repeat(21)).success).toBe(false);
    expect(nicknameSchema.safeParse("   ").success).toBe(false);
  });

  it("RF-04: recorta los espacios y avisa en español", () => {
    expect(nicknameSchema.parse("  Ana ")).toBe("Ana");
    expect(nicknameSchema.safeParse("J").error?.issues[0]?.message).toBe(
      "El apodo debe tener entre 2 y 20 caracteres",
    );
  });
});

describe("roomIdSchema", () => {
  it("RF-03: acepta identificadores de 12 caracteres base64url", () => {
    expect(roomIdSchema.safeParse("Ab3_-xYz09Qw").success).toBe(true);
  });

  it("RF-07: rechaza identificadores con otra longitud o caracteres", () => {
    expect(roomIdSchema.safeParse("corto").success).toBe(false);
    expect(roomIdSchema.safeParse("Ab3_-xYz09Qw1").success).toBe(false);
    expect(roomIdSchema.safeParse("Ab3_-xYz09Q!").success).toBe(false);
  });
});

describe("entradas de las acciones", () => {
  it("RF-01: createRoomInput exige nombre de sala y apodo válidos", () => {
    expect(createRoomInput.safeParse({ roomName: "Sprint 12", nickname: "Ana" }).success).toBe(
      true,
    );
    expect(createRoomInput.safeParse({ roomName: "Sp", nickname: "Ana" }).success).toBe(false);
    expect(createRoomInput.safeParse({ roomName: "Sprint 12" }).success).toBe(false);
  });

  it("RF-04: joinRoomInput exige roomId y apodo válidos", () => {
    expect(joinRoomInput.safeParse({ roomId: "Ab3_-xYz09Qw", nickname: "Ana" }).success).toBe(true);
    expect(joinRoomInput.safeParse({ roomId: "x", nickname: "Ana" }).success).toBe(false);
  });
});

describe("presencePayloadSchema", () => {
  it("RF-08: acepta un payload válido", () => {
    const payload = { participantId: "p1", nickname: "Ana", role: "MODERATOR" };
    expect(presencePayloadSchema.safeParse(payload).success).toBe(true);
  });

  it("RF-08: rechaza payloads incompletos o con rol desconocido", () => {
    expect(presencePayloadSchema.safeParse({ participantId: "p1", nickname: "Ana" }).success).toBe(
      false,
    );
    expect(
      presencePayloadSchema.safeParse({ participantId: "p1", nickname: "Ana", role: "ADMIN" })
        .success,
    ).toBe(false);
    expect(
      presencePayloadSchema.safeParse({ participantId: "", nickname: "Ana", role: "PLAYER" })
        .success,
    ).toBe(false);
  });
});

describe("byePayloadSchema", () => {
  it("RF-10: exige un participantId no vacío", () => {
    expect(byePayloadSchema.safeParse({ participantId: "p1" }).success).toBe(true);
    expect(byePayloadSchema.safeParse({ participantId: "" }).success).toBe(false);
    expect(byePayloadSchema.safeParse({}).success).toBe(false);
  });
});
