import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { cleanupTestData, getRunId, testRoomName } from "../helpers/test-data";

const newId = () => randomBytes(9).toString("base64url");
const ownRoomId = newId();
const foreignRoomId = newId();

describe("limpieza de datos de prueba", () => {
  afterAll(async () => {
    await db.room.deleteMany({ where: { id: { in: [ownRoomId, foreignRoomId] } } });
  });

  it("los nombres de prueba llevan el prefijo de esta ejecución", () => {
    expect(testRoomName("x")).toBe(`test-${getRunId()}-x`);
  });

  it("borra solo las salas de esta ejecución, con sus participantes", async () => {
    await db.room.create({
      data: {
        id: ownRoomId,
        name: testRoomName("limpieza"),
        participants: {
          create: {
            nickname: "Ana",
            nicknameKey: "ana",
            role: "MODERATOR",
            tokenHash: `hash-${ownRoomId}`,
          },
        },
      },
    });
    await db.room.create({
      data: { id: foreignRoomId, name: `test-otra-ejecucion-${foreignRoomId}` },
    });

    await cleanupTestData(testRoomName("limpieza"));

    expect(await db.room.findUnique({ where: { id: ownRoomId } })).toBeNull();
    expect(await db.participant.count({ where: { roomId: ownRoomId } })).toBe(0);
    expect(await db.room.findUnique({ where: { id: foreignRoomId } })).not.toBeNull();
  });
});
