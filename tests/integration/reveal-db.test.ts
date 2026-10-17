import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { cleanupTestData, testRoomName } from "../helpers/test-data";

const PREFIX = testRoomName("reveal-db-");

afterAll(async () => {
  await cleanupTestData(PREFIX);
});

// Sala con moderador (Ana) y un jugador (Beto), una tarea y su ronda
async function setup(label: string) {
  const id = randomBytes(9).toString("base64url");
  const room = await db.room.create({
    data: {
      id,
      name: `${PREFIX}${label}`,
      participants: {
        create: [
          { nickname: "Ana", nicknameKey: "ana", role: "MODERATOR", tokenHash: `hash-a-${id}` },
          { nickname: "Beto", nicknameKey: "beto", role: "PLAYER", tokenHash: `hash-b-${id}` },
        ],
      },
    },
    include: { participants: { orderBy: { nickname: "asc" } } },
  });
  const [ana, beto] = room.participants;
  if (!ana || !beto) throw new Error("Faltan participantes");
  const task = await db.task.create({ data: { roomId: id, title: "Login" } });
  const round = await db.round.create({ data: { roomId: id, taskId: task.id } });
  return { roomId: id, ana, beto, task, round };
}

describe("modelo de revelado", () => {
  it("guarda una ronda revelada con su foto (con y sin carta)", async () => {
    const { ana, beto, round } = await setup("foto");
    const revealedAt = new Date();
    await db.round.update({
      where: { id: round.id },
      data: {
        status: "REVEALED",
        revealedAt,
        entries: {
          create: [
            { participantId: ana.id, nickname: "Ana", card: "5" },
            { participantId: beto.id, nickname: "Beto", card: null },
          ],
        },
      },
    });

    const stored = await db.round.findUniqueOrThrow({
      where: { id: round.id },
      include: { entries: { orderBy: { nickname: "asc" } } },
    });
    expect(stored.status).toBe("REVEALED");
    expect(stored.revealedAt).toEqual(revealedAt);
    expect(stored.entries.map((e) => [e.nickname, e.card])).toEqual([
      ["Ana", "5"],
      ["Beto", null],
    ]);
  });

  it("una sola entrada por participante y ronda", async () => {
    const { ana, round } = await setup("unica");
    await db.revealEntry.create({
      data: { roundId: round.id, participantId: ana.id, nickname: "Ana", card: "5" },
    });
    await expect(
      db.revealEntry.create({
        data: { roundId: round.id, participantId: ana.id, nickname: "Ana", card: "8" },
      }),
    ).rejects.toThrow();
  });

  it("la tarea guarda la estimación final, quién la fijó y cuándo", async () => {
    const { ana, task } = await setup("estimacion");
    const estimatedAt = new Date();
    await db.task.update({
      where: { id: task.id },
      data: { estimate: "8", estimatedAt, estimatedById: ana.id },
    });
    const stored = await db.task.findUniqueOrThrow({
      where: { id: task.id },
      include: { estimatedBy: true },
    });
    expect(stored).toMatchObject({ estimate: "8", estimatedAt });
    expect(stored.estimatedBy?.nickname).toBe("Ana");
  });

  it("borrar la sala borra la foto en cascada", async () => {
    const { roomId, ana, round } = await setup("cascada");
    await db.revealEntry.create({
      data: { roundId: round.id, participantId: ana.id, nickname: "Ana", card: "?" },
    });
    await db.room.delete({ where: { id: roomId } });
    expect(await db.revealEntry.count({ where: { roundId: round.id } })).toBe(0);
  });
});
