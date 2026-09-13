import { getPortalApplicationId } from "@bass/auth/applicant";
import { db } from "@bass/db";
import { storage } from "@bass/core/storage";

export const dynamic = "force-dynamic";

/**
 * Serves one of the applicant's own documents.
 *
 * Applicant documents are PRIVATE media, which the ordinary /media route
 * refuses. This route serves a document only to the holder of a portal cookie
 * for the application it belongs to, and answers 404 for anything else — a
 * document that exists but is someone else's looks exactly like one that
 * does not exist.
 */
export async function GET(_request: Request, context: RouteContext<"/admissions/application-status/documents/[id]">) {
  const { id } = await context.params;
  const applicationId = await getPortalApplicationId();
  if (!applicationId) {
    return new Response("Not found", { status: 404 });
  }

  const document = await db.applicationDocument.findFirst({
    where: { id, applicationId },
    select: {
      mediaAsset: { select: { storageKey: true, mimeType: true, originalName: true } },
    },
  });
  if (!document) {
    return new Response("Not found", { status: 404 });
  }

  let body: Buffer;
  try {
    body = await storage.get(document.mediaAsset.storageKey);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  // The display name is only ever shown, never used as a path; here it is
  // reduced to ASCII for the header and the original goes in filename*.
  const asciiName = document.mediaAsset.originalName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");
  const utf8Name = encodeURIComponent(document.mediaAsset.originalName);

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": document.mediaAsset.mimeType,
      "Content-Length": String(body.byteLength),
      "Content-Disposition": `inline; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
      // Personal documents: never cached by anything between here and the browser.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
