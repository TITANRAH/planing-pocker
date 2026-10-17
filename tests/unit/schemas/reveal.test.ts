import { describe, expect, it } from "vitest";
import {
  estimateEventSchema,
  estimateSchema,
  NUMERIC_CARDS,
  revealEventSchema,
  revealInput,
  revoteInput,
  setEstimateInput,
} from "@/lib/schemas/reveal";

const ROOM = "Ab3_-xYz09Qw";

describe("esquemas de revelado", () => {
  it("RF-07: la estimación solo admite cartas numéricas de la baraja", () => {
    expect(NUMERIC_CARDS).toEqual(["0", "1", "2", "3", "5", "8", "13", "21"]);
    for (const card of NUMERIC_CARDS) expect(estimateSchema.safeParse(card).success).toBe(true);
    for (const card of ["?", "☕", "4", ""])
      expect(estimateSchema.safeParse(card).success).toBe(false);
  });

  it("RF-12: las entradas exigen sala y ronda", () => {
    expect(revealInput.safeParse({ roomId: ROOM, roundId: "r1" }).success).toBe(true);
    expect(revealInput.safeParse({ roomId: ROOM }).success).toBe(false);
    expect(setEstimateInput.safeParse({ roomId: ROOM, roundId: "r1", card: "8" }).success).toBe(
      true,
    );
    expect(setEstimateInput.safeParse({ roomId: ROOM, roundId: "r1", card: "?" }).success).toBe(
      false,
    );
  });

  it("RF-08: volver a votar no confirma por defecto", () => {
    expect(revoteInput.parse({ roomId: ROOM, roundId: "r1" }).confirm).toBe(false);
  });

  it("RF-03: el evento reveal admite cartas y 'No votó' (null), y rechaza cartas fuera de la baraja", () => {
    const entries = [
      { participantId: "a", nickname: "Ana", card: "5" },
      { participantId: "b", nickname: "Beto", card: null },
    ];
    expect(revealEventSchema.safeParse({ roundId: "r1", entries }).success).toBe(true);
    expect(
      revealEventSchema.safeParse({
        roundId: "r1",
        entries: [{ participantId: "a", nickname: "Ana", card: "4" }],
      }).success,
    ).toBe(false);
  });

  it("RF-07/RF-08: el evento estimate admite una carta numérica o null (borrada)", () => {
    expect(
      estimateEventSchema.safeParse({ taskId: "t1", roundId: "r1", estimate: "8" }).success,
    ).toBe(true);
    expect(
      estimateEventSchema.safeParse({ taskId: "t1", roundId: "r1", estimate: null }).success,
    ).toBe(true);
    expect(
      estimateEventSchema.safeParse({ taskId: "t1", roundId: "r1", estimate: "?" }).success,
    ).toBe(false);
  });
});
