import { describe, expect, it } from "vitest";
import { historyItemSchema } from "@/lib/schemas/history";

const item = {
  taskId: "t1",
  title: "Login",
  detail: null,
  estimate: "5",
  estimatedAt: new Date("2026-10-17T14:32:00Z"),
  rounds: [
    {
      roundId: "r1",
      revealedAt: new Date("2026-10-17T14:30:00Z"),
      entries: [
        { participantId: "a", nickname: "Ana", card: "5" },
        { participantId: "b", nickname: "Beto", card: null },
      ],
    },
  ],
};

describe("historyItemSchema", () => {
  it("RF-09: el historial vuelve a validar tras pasar por JSON y conserva sus fechas", () => {
    const parsed = historyItemSchema.safeParse(JSON.parse(JSON.stringify(item)));
    expect(parsed.success).toBe(true);
    expect(parsed.data?.estimatedAt).toEqual(item.estimatedAt);
    expect(parsed.data?.rounds[0]?.revealedAt).toEqual(item.rounds[0]?.revealedAt);
  });

  it("RF-01/RF-04: acepta una tarea con estimación numérica y rondas con su foto", () => {
    expect(historyItemSchema.safeParse(item).success).toBe(true);
  });

  it("RF-05: la estimación debe ser una carta numérica", () => {
    expect(historyItemSchema.safeParse({ ...item, estimate: "?" }).success).toBe(false);
    expect(historyItemSchema.safeParse({ ...item, estimate: null }).success).toBe(false);
  });

  it("RF-04: las cartas de la foto deben ser de la baraja", () => {
    const bad = {
      ...item,
      rounds: [
        { ...item.rounds[0], entries: [{ participantId: "a", nickname: "Ana", card: "4" }] },
      ],
    };
    expect(historyItemSchema.safeParse(bad).success).toBe(false);
  });
});
