import { randomBytes } from "node:crypto";
import { db } from "@/server/db";

// Cada ejecución de pruebas tiene su propio runId para no borrar datos de otras ejecuciones
// que compartan el proyecto de Supabase dev. La configuración de Vitest/Playwright lo fija
// en TEST_RUN_ID para que todos los procesos usen el mismo.
export function getRunId(): string {
  process.env.TEST_RUN_ID ??= randomBytes(4).toString("hex");
  return process.env.TEST_RUN_ID;
}

export function testRoomName(label: string): string {
  return `test-${getRunId()}-${label}`;
}

// Borra las salas cuyo nombre empieza por `prefix` (por defecto, todas las de esta ejecución).
// Los participantes se eliminan en cascada.
export async function cleanupTestData(prefix: string = `test-${getRunId()}-`): Promise<number> {
  const { count } = await db.room.deleteMany({ where: { name: { startsWith: prefix } } });
  return count;
}
