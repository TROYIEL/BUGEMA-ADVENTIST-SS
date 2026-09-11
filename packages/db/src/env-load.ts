import { loadRootEnv } from "./env";

/**
 * Side-effect module: importing it loads the repository-root .env.
 *
 * It exists as its own module because ES imports are hoisted and evaluated in
 * order. A `loadRootEnv()` call placed between import statements would run
 * *after* every module had already been evaluated, by which point anything
 * reading `process.env` at module scope has already seen an empty value.
 * Importing this first is what actually guarantees the ordering.
 */
loadRootEnv();
