import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// The Prisma CLI runs with its working directory set to this package, so a
// bare `dotenv/config` would look for packages/db/.env and miss the one at the
// repository root. Resolving from this file's own location keeps it working
// however the command is invoked.
const packageDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(packageDir, "../../.env") });
loadEnv({ path: path.join(packageDir, ".env"), override: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // `--conditions=react-server` resolves the `server-only` guard to its empty
    // build, so modules meant for RSC can be reused by this CLI script.
    seed: "node --conditions=react-server --import tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
