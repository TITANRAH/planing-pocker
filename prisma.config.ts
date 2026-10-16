import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Las migraciones usan la conexión directa; la app usa el pooler (DATABASE_URL)
  datasource: { url: env("DIRECT_URL") },
});
