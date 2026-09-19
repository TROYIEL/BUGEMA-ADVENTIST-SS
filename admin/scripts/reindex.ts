// Must be first: loads the repository-root .env before anything reads it.
import "@/lib/db/env-load";

import { reindexAll } from "@/lib/search";
import { createPrismaClient } from "@/lib/db/client";

/**
 * Rebuilds the site search index from published content.
 *
 * Run after a bulk import, or any time the index is suspected to be stale.
 * Individual edits keep the index current through the admin mutations.
 */
async function main() {
  const count = await reindexAll();
  console.log(`Indexed ${count} documents.`);
}

const db = createPrismaClient({ direct: true });

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
