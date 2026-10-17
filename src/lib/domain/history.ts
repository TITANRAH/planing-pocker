import type { HistoryItem } from "@/lib/schemas/history";

// Funciones puras del historial (spec 004): resumen, fechas en hora local, CSV y nombre del archivo

export function historySummary(items: readonly HistoryItem[]): { count: number; points: number } {
  return {
    count: items.length,
    points: items.reduce((sum, item) => sum + Number(item.estimate), 0),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

const localDay = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// "14:32" (RF-01)
export function formatHistoryTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// "2026-10-17 14:32" (RF-05)
export function formatHistoryDate(date: Date): string {
  return `${localDay(date)} ${formatHistoryTime(date)}`;
}

// Excel en español espera ";" y necesita el BOM para leer bien el UTF-8 (RF-05)
const BOM = "﻿";
const HEADER = ["Tarea", "Detalle", "Estimación", "Fecha", "Rondas"];

function csvField(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function buildHistoryCsv(items: readonly HistoryItem[]): string {
  const rows = items.map((item) => [
    item.title,
    item.detail ?? "",
    item.estimate,
    formatHistoryDate(item.estimatedAt),
    String(item.rounds.length),
  ]);
  return BOM + [HEADER, ...rows].map((row) => row.map(csvField).join(";")).join("\r\n");
}

// planning-poker-<sala>-<AAAA-MM-DD>.csv, con la sala en minúsculas, sin tildes y con guiones
export function historyFileName(roomName: string, date: Date): string {
  const slug = roomName
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `planning-poker-${slug || "sala"}-${localDay(date)}.csv`;
}
