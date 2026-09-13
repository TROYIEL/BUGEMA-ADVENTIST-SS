import { authErrorResponse, requirePermission } from "@bass/auth/dal";
import { ApplicationStatus } from "@bass/db/enums";
import { db } from "@bass/db";
import { storage } from "@bass/core/storage";

export const dynamic = "force-dynamic";

/**
 * Serves an applicant's document to staff.
 *
 * These are PRIVATE media, which the shared /media route refuses on purpose.
 * Reading an application includes reading what was attached to it, so the
 * permission is the same as the page's; nothing is cached anywhere between
 * here and the browser.
 */
export async function GET(
  _request: Request,
  context: RouteContext<"/applications/documents/[id]">,
) {
  try {
    await requirePermission("applications:read");
  } catch (error) {
    return authErrorResponse(error) ?? new Response("Error", { status: 500 });
  }

  const { id } = await context.params;
  const document = await db.applicationDocument.findFirst({
    where: { id, application: { status: { not: ApplicationStatus.DRAFT } } },
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

  const asciiName = document.mediaAsset.originalName
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/"/g, "'");
  const utf8Name = encodeURIComponent(document.mediaAsset.originalName);

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": document.mediaAsset.mimeType,
      "Content-Length": String(body.byteLength),
      "Content-Disposition": `inline; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
