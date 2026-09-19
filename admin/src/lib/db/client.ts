import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

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
export function createPrismaClient(options: { direct?: boolean } = {}) {
  // CLI scripts ask for the direct address when there is one: a seed or a
  // reindex holds a connection open for a while and gains nothing from a
  // pooler. The apps take DATABASE_URL, pooled or not.
  const connectionString =
    (options.direct ? process.env.DATABASE_URL_UNPOOLED : undefined) ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and either start Postgres with `npm run db:up` or paste a hosted connection string.",
    );
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: pinSslMode(connectionString) }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

/**
 * Hosted providers hand out `sslmode=require`. The pg driver treats that as
 * `verify-full` today — certificate checked against the system store — and
 * warns that its next major will weaken it to libpq's meaning, where the
 * certificate is not checked at all. Spelling out `verify-full` keeps the
 * stronger behaviour whichever pg is installed, and quietens the warning
 * without editing a connection string a CLI (`neon env pull`) may rewrite.
 */
export function pinSslMode(connectionString: string): string {
  return connectionString.replace(/([?&])sslmode=require(?=&|$)/, "$1sslmode=verify-full");
}

export type AppPrismaClient = ReturnType<typeof createPrismaClient>;
