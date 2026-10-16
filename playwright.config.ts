import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
// Un runId por ejecución; los workers lo heredan del proceso principal
process.env.TEST_RUN_ID ??= randomBytes(4).toString("hex");

const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  globalTeardown: "./tests/helpers/global-teardown.ts",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
