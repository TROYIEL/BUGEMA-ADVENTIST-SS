import { redirect } from "next/navigation";

import { grantPortalAccess } from "@bass/auth/applicant";
import { findSubmittedByAccessToken } from "@bass/core/applications";

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
  const application = await findSubmittedByAccessToken(token);

  if (application) {
    await grantPortalAccess(application.id);
  }

  redirect("/admissions/application-status");
}
