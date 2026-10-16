import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { cleanupTestData, testRoomName } from "../helpers/test-data";

const PREFIX = testRoomName("voting-db-");

afterAll(async () => {
  await cleanupTestData(PREFIX);
});

async function roomWithPlayer(label: string) {
  const id = randomBytes(9).toString("base64url");
  const room = await db.room.create({
    data: {
      id,
      name: `${PREFIX}${label}`,
      participants: {
        create: { nickname: "Ana", nicknameKey: "ana", role: "MODERATOR", tokenHash: `hash-${id}` },
      },
    },
    include: { participants: true },
  });
  const participant = room.participants[0];
  if (!participant) throw new Error("Sala sin participante");
  return { roomId: id, participantId: participant.id };
}

describe("modelo de votación", () => {
  it("guarda una tarea con su ronda abierta y un voto", async () => {
    const { roomId, participantId } = await roomWithPlayer("crear");
    const task = await db.task.create({
      data: { roomId, title: "Login con Google", detail: null },
    });
    const round = await db.round.create({ data: { roomId, taskId: task.id } });
    await db.vote.create({ data: { roundId: round.id, participantId, card: "5" } });

    const stored = await db.round.findUniqueOrThrow({
      where: { id: round.id },
      include: { votes: true, task: true },
    });
    expect(stored.status).toBe("OPEN");
    expect(stored.task.title).toBe("Login con Google");
    expect(stored.votes.map((v) => v.card)).toEqual(["5"]);
  });

  it("un participante no puede tener dos votos en la misma ronda", async () => {
    const { roomId, participantId } = await roomWithPlayer("unico");
    const task = await db.task.create({ data: { roomId, title: "Tarea" } });
    const round = await db.round.create({ data: { roomId, taskId: task.id } });
    await db.vote.create({ data: { roundId: round.id, participantId, card: "5" } });
    await expect(
      db.vote.create({ data: { roundId: round.id, participantId, card: "8" } }),
    ).rejects.toThrow();
  });

  it("borrar la sala borra tareas, rondas y votos en cascada", async () => {
    const { roomId, participantId } = await roomWithPlayer("cascada");
    const task = await db.task.create({ data: { roomId, title: "Tarea" } });
    const round = await db.round.create({ data: { roomId, taskId: task.id } });
    await db.vote.create({ data: { roundId: round.id, participantId, card: "?" } });

    await db.room.delete({ where: { id: roomId } });
    expect(await db.task.count({ where: { roomId } })).toBe(0);
    expect(await db.round.count({ where: { roomId } })).toBe(0);
    expect(await db.vote.count({ where: { roundId: round.id } })).toBe(0);
  });
});
