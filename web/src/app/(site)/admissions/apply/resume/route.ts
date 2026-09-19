import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { setDraftCookie } from "@/lib/auth/applicant";
import { getClientIp } from "@/lib/auth/session";
import { findDraft } from "@/lib/applications";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Lands the "continue your application" email link.
 *
 * The token is exchanged for the draft cookie and the visitor is sent on to
 * the form, so the secret leaves the address bar at once rather than sitting
 * in browser history. A token that matches nothing — expired, already
 * submitted, or mistyped — goes to the start page, which explains itself.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";

  const limit = await rateLimit({
    key: `token-exchange:${(await getClientIp()) ?? "unknown"}`,
    ...RATE_LIMITS.tokenExchange,
  });
  if (!limit.ok) redirect("/admissions/apply");

  const draft = await findDraft(token);

  if (draft) {
    await setDraftCookie(token);
  }

  redirect("/admissions/apply");
}
