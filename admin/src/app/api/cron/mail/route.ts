import type { NextRequest } from "next/server";

import { safeEqual } from "@/lib/auth/crypto";
import { flushOutbox } from "@/lib/mail";

export const dynamic = "force-dynamic";

/**
 * Re-attempts queued and failed outbox mail. For hosted deploys with no shell
 * to run `npm run mail:flush` from — point a scheduler (Vercel Cron, GitHub
 * Actions, a monitoring ping) at it every few minutes.
 *
 * Authenticated with the CRON_SECRET bearer token rather than a session:
 * schedulers have no browser. Not served at all until the secret is set, so a
 * fresh deploy cannot be driven by anyone who guesses the path.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new Response("Not found", { status: 404 });
  }

  const presented = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!safeEqual(presented, secret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await flushOutbox();
  return Response.json(result);
}
