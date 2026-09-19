// Must be first: loads the repository-root .env before anything reads it.
import "@/lib/db/env-load";

import { flushOutbox } from "@/lib/mail";
import { createPrismaClient } from "@/lib/db/client";

/**
 * Re-attempts delivery of queued and failed outbox mail.
 *
 * Run from cron on a VPS (`npm run mail:flush`); hosted deploys hit the admin
 * app's /api/cron/mail endpoint instead. Either way this is what turns an
 * SMTP outage into a delay rather than a lost confirmation email.
 */
async function main() {
  const result = await flushOutbox({ limit: Number(process.env.MAIL_FLUSH_LIMIT ?? 50) });
  if (result.reason) {
    console.log(`Nothing attempted: ${result.reason}`);
    return;
  }
  console.log(
    `Attempted ${result.attempted}: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped.`,
  );
  if (result.failed > 0) process.exitCode = 1;
}

const db = createPrismaClient({ direct: true });

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
