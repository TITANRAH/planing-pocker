import { describe, expect, it } from "vitest";
import {
  buildHistoryCsv,
  formatHistoryDate,
  formatHistoryTime,
  historyFileName,
  historySummary,
} from "@/lib/domain/history";
import type { HistoryItem } from "@/lib/schemas/history";

// Fechas construidas en hora local: el resultado no depende de la zona horaria del equipo
const at = (h: number, m: number) => new Date(2026, 9, 17, h, m);

function item(
  title: string,
  estimate: HistoryItem["estimate"],
  h: number,
  rounds = 1,
  detail: string | null = null,
) {
  return {
    taskId: title,
    title,
    detail,
    estimate,
    estimatedAt: at(h, 32),
    rounds: Array.from({ length: rounds }, (_, i) => ({
      roundId: `${title}-${i}`,
      revealedAt: at(h, i),
      entries: [],
    })),
  } satisfies HistoryItem;
}

describe("historySummary", () => {
  it("RF-02: cuenta las tareas y suma sus estimaciones", () => {
    expect(historySummary([item("A", "5", 10), item("B", "3", 11), item("C", "8", 12)])).toEqual({
      count: 3,
      points: 16,
    });
    expect(historySummary([])).toEqual({ count: 0, points: 0 });
  });
});

describe("fechas", () => {
  it("RF-01: la hora se muestra como '14:32'", () => {
    expect(formatHistoryTime(at(14, 32))).toBe("14:32");
    expect(formatHistoryTime(at(9, 5))).toBe("09:05");
  });

  it("RF-05: la fecha del CSV es '2026-10-17 14:32'", () => {
    expect(formatHistoryDate(at(14, 32))).toBe("2026-10-17 14:32");
  });
});

describe("buildHistoryCsv", () => {
  it("RF-05: BOM, cabecera exacta, ';' como separador y una fila por tarea en el orden recibido", () => {
    const csv = buildHistoryCsv([item("Logout", "3", 15), item("Login", "5", 14, 2, "PP-12")]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1).split("\r\n")).toEqual([
      "Tarea;Detalle;Estimación;Fecha;Rondas",
      "Logout;;3;2026-10-17 15:32;1",
      "Login;PP-12;5;2026-10-17 14:32;2",
    ]);
  });

  it("RF-05: entrecomilla los campos con ';', comillas o saltos de línea", () => {
    const csv = buildHistoryCsv([item('Login; "fase 1"', "5", 14, 1, "línea 1\nlínea 2")]);
    expect(csv.slice(1).split("\r\n")[1]).toBe(
      '"Login; ""fase 1""";"línea 1\nlínea 2";5;2026-10-17 14:32;1',
    );
  });
});

describe("historyFileName", () => {
  it("RF-05: planning-poker-<sala>-<AAAA-MM-DD>.csv, sin tildes ni caracteres especiales", () => {
    expect(historyFileName("Sprint 12 — Diseño", at(14, 32))).toBe(
      "planning-poker-sprint-12-diseno-2026-10-17.csv",
    );
    expect(historyFileName("¡¡!!", at(14, 32))).toBe("planning-poker-sala-2026-10-17.csv");
  });
});
