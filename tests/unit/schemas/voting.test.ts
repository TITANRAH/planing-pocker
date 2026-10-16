import { describe, expect, it } from "vitest";
import {
  cardSchema,
  castVoteInput,
  DECK,
  editTaskInput,
  newTaskInput,
  taskDetailSchema,
  taskEventSchema,
  taskTitleSchema,
  voteEventSchema,
} from "@/lib/schemas/voting";

const ROOM = "Ab3_-xYz09Qw";

describe("baraja", () => {
  it("RF-03: la baraja es exactamente 0, 1, 2, 3, 5, 8, 13, 21, ? y ☕", () => {
    expect(DECK).toEqual(["0", "1", "2", "3", "5", "8", "13", "21", "?", "☕"]);
    for (const card of DECK) expect(cardSchema.safeParse(card).success).toBe(true);
  });

  it("RF-12: rechaza cualquier valor fuera de la baraja", () => {
    for (const card of ["4", "", "100", "XL", 5, null])
      expect(cardSchema.safeParse(card).success).toBe(false);
  });
});

describe("tarea", () => {
  it("RF-01: el título debe tener entre 3 y 100 caracteres, recortado", () => {
    expect(taskTitleSchema.parse("  Login con Google ")).toBe("Login con Google");
    expect(taskTitleSchema.safeParse("ab").success).toBe(false);
    expect(taskTitleSchema.safeParse("a".repeat(101)).success).toBe(false);
    expect(taskTitleSchema.safeParse("ab").error?.issues[0]?.message).toBe(
      "El título debe tener entre 3 y 100 caracteres",
    );
  });

  it("RF-01: el detalle es opcional, de hasta 300 caracteres; vacío equivale a no tenerlo", () => {
    expect(taskDetailSchema.parse(undefined)).toBeNull();
    expect(taskDetailSchema.parse("   ")).toBeNull();
    expect(taskDetailSchema.parse(" https://jira/PP-12 ")).toBe("https://jira/PP-12");
    expect(taskDetailSchema.safeParse("a".repeat(301)).success).toBe(false);
  });

  it("RF-01/RF-08: newTaskInput exige sala y título, y discardVotes es falso por defecto", () => {
    expect(newTaskInput.parse({ roomId: ROOM, title: "Login" })).toEqual({
      roomId: ROOM,
      title: "Login",
      detail: null,
      discardVotes: false,
    });
    expect(newTaskInput.safeParse({ roomId: "x", title: "Login" }).success).toBe(false);
  });

  it("RF-13: editTaskInput exige la tarea que se edita", () => {
    expect(editTaskInput.safeParse({ roomId: ROOM, taskId: "t1", title: "Login" }).success).toBe(
      true,
    );
    expect(editTaskInput.safeParse({ roomId: ROOM, title: "Login" }).success).toBe(false);
  });

  it("RF-12: castVoteInput exige ronda y una carta de la baraja", () => {
    expect(castVoteInput.safeParse({ roomId: ROOM, roundId: "r1", card: "13" }).success).toBe(true);
    expect(castVoteInput.safeParse({ roomId: ROOM, roundId: "r1", card: "4" }).success).toBe(false);
    expect(castVoteInput.safeParse({ roomId: ROOM, card: "13" }).success).toBe(false);
  });
});

describe("eventos de broadcast", () => {
  it("RF-02: taskEventSchema acepta la tarea de una ronda", () => {
    const event = { roundId: "r1", task: { id: "t1", title: "Login", detail: null } };
    expect(taskEventSchema.safeParse(event).success).toBe(true);
  });

  it("RF-05: voteEventSchema no admite el valor de la carta", () => {
    expect(
      voteEventSchema.safeParse({ roundId: "r1", participantId: "p1", voted: true }).success,
    ).toBe(true);
    expect(
      voteEventSchema.safeParse({ roundId: "r1", participantId: "p1", voted: true, card: "13" })
        .success,
    ).toBe(false);
  });
});
