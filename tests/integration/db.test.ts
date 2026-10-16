import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { testRoomName } from "../helpers/test-data";

const roomId = randomBytes(9).toString("base64url");

describe("base de datos", () => {
  afterAll(async () => {
    await db.room.deleteMany({ where: { id: roomId } });
    await db.$disconnect();
  });

  it("crea y lee una sala con su moderador", async () => {
    await db.room.create({
      data: {
        id: roomId,
        name: testRoomName(`db-${roomId}`),
        participants: {
          create: {
            nickname: "Ana",
            nicknameKey: "ana",
            role: "MODERATOR",
            tokenHash: `hash-${roomId}`,
          },
        },
      },
    });

    const room = await db.room.findUnique({
      where: { id: roomId },
      include: { participants: true },
    });

    expect(room?.name).toBe(testRoomName(`db-${roomId}`));
    expect(room?.participants).toHaveLength(1);
    expect(room?.participants[0]?.role).toBe("MODERATOR");
  });
});
