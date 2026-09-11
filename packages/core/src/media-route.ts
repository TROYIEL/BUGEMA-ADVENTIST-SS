import "server-only";

import { MediaVisibility } from "@bass/db/enums";
import { db } from "@bass/db";

import { storage } from "./storage";

/**
 * Serves a public media asset.
 *
 * Shared by both applications rather than duplicated, so the visibility rule
 * below can only ever be written once.
 *
 * Files live outside `public/` precisely so that visibility is a decision this
 * function makes, not a consequence of where a file was written. Only assets
 * explicitly marked PUBLIC are served; applicant documents are PRIVATE and are
 * served by a separate, authorised route in the administration app.
 *
 * A missing asset and a private asset both return 404, so this endpoint cannot
 * be used to probe which document keys exist.
 */
export async function serveMedia(storageKey: string): Promise<Response> {
  if (!storageKey) {
    return new Response("Not found", { status: 404 });
  }

  const asset = await db.mediaAsset.findUnique({
    where: { storageKey },
    select: { mimeType: true, visibility: true },
  });

  if (!asset || asset.visibility !== MediaVisibility.PUBLIC) {
    return new Response("Not found", { status: 404 });
  }

  let body: Buffer;
  try {
    body = await storage.get(storageKey);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(body.byteLength),
      // Storage keys are unique per upload: replacing an image creates a new
      // key, so this can be cached hard and for a long time.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      // Belt and braces: even if a non-image slipped past validation, this
      // stops a browser rendering it inline on our origin.
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
