import "server-only";

import { createPrismaClient, type AppPrismaClient } from "./client";

// `next dev` re-evaluates modules on every hot reload. Without this guard each
// reload opens a fresh connection pool and Postgres runs out of connections
// within a few edits.
const globalForPrisma = globalThis as unknown as {
  prisma?: AppPrismaClient;
};

export const db: AppPrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
