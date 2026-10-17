import { describe, expect, it } from "vitest";
import { formatAverage, summarizeRound } from "@/lib/domain/reveal";

describe("summarizeRound", () => {
  it("RF-04/RF-05: promedio, mínimo y máximo solo de las cartas numéricas", () => {
    const summary = summarizeRound(["3", "5", "8", "?"]);
    expect(summary.average).toBeCloseTo(16 / 3);
    expect(summary).toMatchObject({ min: "3", max: "8", voteCount: 4 });
  });

  it("RF-04: los 'No votó' no cuentan", () => {
    expect(summarizeRound(["5", null, "8", null])).toMatchObject({ average: 6.5, voteCount: 2 });
  });

  it("RF-04/RF-07: solo '?' y '☕' → sin promedio, sin mínimo ni máximo y sin sugerencia", () => {
    expect(summarizeRound(["?", "☕", null])).toMatchObject({
      average: null,
      min: null,
      max: null,
      suggestion: null,
      consensus: false,
    });
  });

  it("RF-06: hay consenso si todos votaron la misma carta numérica", () => {
    expect(summarizeRound(["8", "8", null]).consensus).toBe(true);
  });

  it("RF-06: un '?' o un '☕' rompe el consenso", () => {
    expect(summarizeRound(["8", "?"]).consensus).toBe(false);
    expect(summarizeRound(["8", "☕"]).consensus).toBe(false);
    expect(summarizeRound(["?", "?"]).consensus).toBe(false);
  });

  it("RF-06: con un solo voto no hay consenso", () => {
    expect(summarizeRound(["8", null])).toMatchObject({ consensus: false, voteCount: 1 });
  });

  it("RF-07: sugiere la carta numérica más cercana al promedio", () => {
    expect(summarizeRound(["3", "5", "8", "?"]).suggestion).toBe("5"); // 5,33
    expect(summarizeRound(["13", "21"]).suggestion).toBe("21"); // 17: 13 a 4, 21 a 4 → empate
    expect(summarizeRound(["0", "1"]).suggestion).toBe("1"); // 0,5: empate → la mayor
  });

  it("RF-07: si empatan dos cartas, sugiere la mayor", () => {
    expect(summarizeRound(["5", "8"]).suggestion).toBe("8"); // 6,5
  });
});

describe("formatAverage", () => {
  it("RF-04: coma decimal y siempre un decimal", () => {
    expect(formatAverage(16 / 3)).toBe("5,3");
    expect(formatAverage(5)).toBe("5,0");
    expect(formatAverage(6.5)).toBe("6,5");
    expect(formatAverage(13.25)).toBe("13,3");
  });
});
