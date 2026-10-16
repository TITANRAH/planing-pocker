import { db } from "@/server/db";
import { cleanupTestData } from "./test-data";

// Vitest: se ejecuta una vez al terminar todas las pruebas
export async function teardown(): Promise<void> {
  await cleanupTestData();
  await db.$disconnect();
}

// Playwright: exporta la función por defecto
export default teardown;
