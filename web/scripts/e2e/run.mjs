/**
 * End-to-end checks against a running dev server (default :3000; override
 * with E2E_BASE_URL).
 *
 *   npm run test:e2e            everything
 *   npm run test:e2e -- smoke   one suite
 *
 * Read-only: nothing here writes to the database.
 */
import { BASE } from "./lib/browser.mjs";
import { runSmoke } from "./smoke.mjs";
import { runA11y } from "./a11y.mjs";

// Say plainly that the server is missing rather than dying on the first fetch.
try {
  await fetch(BASE, { redirect: "manual", signal: AbortSignal.timeout(5000) });
} catch {
  console.error(`Nothing is answering at ${BASE}. Start the site with \`npm run dev\` first.`);
  process.exit(2);
}

const SUITES = { smoke: runSmoke, a11y: runA11y };
const requested = process.argv.slice(2).filter((name) => name in SUITES);
const names = requested.length > 0 ? requested : Object.keys(SUITES);

const failures = [];
for (const name of names) {
  console.log(`\n===== ${name} =====`);
  const result = await SUITES[name]();
  failures.push(...result.map((f) => `[${name}] ${f}`));
}

console.log(`\n${failures.length === 0 ? "ALL PASSED" : `${failures.length} FAILURE(S)`}`);
for (const failure of failures) console.log("  - " + failure);
process.exit(failures.length === 0 ? 0 : 1);
