import { redirect } from "next/navigation";

import { grantPortalAccess } from "@/lib/auth/applicant";
import { getClientIp } from "@/lib/auth/session";
import { findSubmittedByAccessToken } from "@/lib/applications";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Lands the link in the confirmation email.
 *
 * The token is swapped for a short-lived portal cookie and the visitor is
 * redirected, so the secret never sits in a page URL where it would be logged
 * by proxies and kept in history. An unknown token simply lands on the lookup
 * form; there is nothing to learn from the difference.
 */
export async function GET(_request: Request, context: RouteContext<"/admissions/application-status/access/[token]">) {
  const { token } = await context.params;

  // Same destination whether the limit is hit or the token is unknown: the
  // lookup form, which explains itself. Nothing is learned from the response.
  const limit = await rateLimit({
    key: `token-exchange:${(await getClientIp()) ?? "unknown"}`,
    ...RATE_LIMITS.tokenExchange,
  });
  if (!limit.ok) redirect("/admissions/application-status");

  const application = await findSubmittedByAccessToken(token);

  if (application) {
    await grantPortalAccess(application.id);
  }

  redirect("/admissions/application-status");
}
