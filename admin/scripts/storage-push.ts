// Must be first: loads the project's .env before anything reads it.
import "@/lib/db/env-load";

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { fromProjectRoot } from "@/lib/db/env";
import { createStorageAdapter } from "@/lib/storage";

/**
 * Copies every file under the local storage directory into the S3 bucket,
 * keeping the same keys, so a database that already references files keeps
 * working after STORAGE_DRIVER is switched from "local" to "s3".
 *
 * Idempotent: a key that already exists in the bucket with the same size is
 * skipped, so an interrupted run can simply be repeated. Nothing is deleted
 * from either side. Reads the S3 settings from .env exactly as the app does.
 *
 *   npm run storage:push              # from STORAGE_LOCAL_DIR (default: storage/)
 *   npm run storage:push -- /some/dir # from another directory
 */
const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
};

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && !entry.name.startsWith(".")) yield full;
  }
}

async function main() {
  const root = path.resolve(process.argv[2] ?? fromProjectRoot(process.env.STORAGE_LOCAL_DIR ?? "storage"));
  const remote = createStorageAdapter("s3");
  console.log(`Pushing ${root} -> s3 bucket "${process.env.STORAGE_S3_BUCKET}"`);

  let copied = 0;
  let skipped = 0;
  let bytes = 0;
  for await (const file of walk(root)) {
    // Keys are always POSIX-style, whatever the local separator is.
    const key = path.relative(root, file).split(path.sep).join("/");
    const { size } = await stat(file);

    if ((await remote.exists(key)) && (await remote.size(key)) === size) {
      skipped += 1;
      continue;
    }

    const contentType = CONTENT_TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";
    await remote.put(key, await readFile(file), contentType);
    copied += 1;
    bytes += size;
    console.log(`  ${key} (${(size / 1024).toFixed(0)} KB)`);
  }

  console.log(`Done: ${copied} copied (${(bytes / 1024 / 1024).toFixed(1)} MB), ${skipped} already present.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
