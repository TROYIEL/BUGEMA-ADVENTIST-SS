import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

/**
 * Absolute path to the repository root, derived from this file's own location
 * rather than from `process.cwd()`.
 *
 * This matters more than it looks. CLI scripts run with their working
 * directory set to packages/db, the web app runs from apps/web and the admin
 * app from apps/admin. Anything resolved against the CWD therefore points at a
 * different place in each — which is how the seed silently skipped every
 * photograph, and how the two apps would otherwise have ended up writing
 * uploads into two separate directories.
 */
export const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

/** Loads the root .env, then any package-local overrides. */
export function loadRootEnv(): void {
  loadEnv({ path: path.join(repoRoot, ".env") });
  loadEnv({ path: path.join(repoRoot, "packages/db/.env"), override: true });
}

/** Resolves a possibly-relative path against the repository root. */
export function fromRepoRoot(target: string): string {
  return path.isAbsolute(target) ? target : path.join(repoRoot, target);
}
