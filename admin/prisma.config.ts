import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Resolve .env from this file's own location so the CLI works however it is
// invoked, not only from the project root.
loadEnv({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), ".env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // `--conditions=react-server` resolves the `server-only` guard to its empty
    // build, so modules meant for RSC can be reused by this CLI script.
    seed: "node --conditions=react-server --import tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations, studio and the seed talk to the database directly. Through
    // a connection pooler (Neon's "-pooler" host, PgBouncer) the advisory lock
    // Prisma Migrate takes and the shadow database it creates do not work, so
    // a hosted setup provides the direct address as DATABASE_URL_UNPOOLED.
    url: process.env.DATABASE_URL_UNPOOLED ? env("DATABASE_URL_UNPOOLED") : env("DATABASE_URL"),
  },
});
