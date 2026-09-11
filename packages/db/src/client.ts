import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";

/**
 * Builds a Prisma Client.
 *
 * Prisma 7 requires a driver adapter: `new PrismaClient()` with no arguments
 * throws, and `datasourceUrl` no longer exists.
 *
 * This module deliberately does NOT import `server-only`, so that CLI scripts
 * (seeding, creating the first administrator) can reuse it. Application code
 * should import the shared singleton from `@/lib/db` instead of calling this.
 */
export function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and start Postgres with `docker compose up -d db`.",
    );
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export type AppPrismaClient = ReturnType<typeof createPrismaClient>;
