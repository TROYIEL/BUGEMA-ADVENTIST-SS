import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Resolve .env from this file's own location so the CLI works however it is
// invoked, not only from the project root.
loadEnv({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), ".env") });

// This project only generates a client. The migrations and the seed live in
// the administration project, which owns the database.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL_UNPOOLED ? env("DATABASE_URL_UNPOOLED") : env("DATABASE_URL"),
  },
});
