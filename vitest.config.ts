import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

const env = config({ path: ".env.local", quiet: true }).parsed ?? {};
// Un runId por ejecución, compartido por los workers y el teardown (tests/helpers/test-data.ts)
const TEST_RUN_ID = (process.env.TEST_RUN_ID ??= randomBytes(4).toString("hex"));
Object.assign(process.env, env);

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
    // La BD de pruebas está en Supabase (remota): cada consulta es un viaje de red
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // Cada prueba crea su propia sala, así que pueden ir en paralelo dentro de un archivo
    sequence: { concurrent: true },
    // Carga .env.local para las pruebas de integración contra Supabase dev
    env: { ...env, TEST_RUN_ID },
    globalSetup: ["tests/helpers/global-teardown.ts"],
  },
});
