import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

/**
 * Absolute path to the project root (the directory holding package.json),
 * derived from this file's own location rather than from `process.cwd()`.
 *
 * `next dev`, the Prisma CLI, the test runner and the scripts are all started
 * from the project root in practice, but nothing here depends on that: a
 * script run from anywhere still finds the same .env and the same storage
 * directory.
 */
export const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

/** Loads the project's .env without overriding variables already set. */
export function loadProjectEnv(): void {
  loadEnv({ path: path.join(projectRoot, ".env") });
}

/** Resolves a possibly-relative path against the project root. */
export function fromProjectRoot(target: string): string {
  return path.isAbsolute(target) ? target : path.join(projectRoot, target);
}
