import "server-only";

import { cookies } from "next/headers";

import { signValue, verifySignedValue } from "./crypto";

/**
 * Applicant identity on the public website.
 *
 * Applicants have no account. Two cookies stand in for one:
 *
 *  - The DRAFT cookie holds the raw resume secret for an unfinished
 *    application. Only its hash is in the database, exactly as with admin
 *    sessions, so a database leak does not expose anyone's half-written form.
 *
 *  - The PORTAL cookie is a signed, expiring claim to one submitted
 *    application. It is issued after a successful reference-number lookup or
 *    an emailed access link, and is stateless: there is no applicant session
 *    table to keep, and rotating SESSION_SECRET signs every applicant out at
 *    once, which is the documented behaviour of that variable.
 *
 * Both are httpOnly and SameSite=Lax, so a cross-site POST cannot carry them.
 * Every function that writes a cookie must run in a Server Action or Route
 * Handler — cookies cannot be set once rendering has started streaming.
 */

export const DRAFT_COOKIE = "bass_application_draft";
export const PORTAL_COOKIE = "bass_applicant";

/** A draft that nobody has touched for a month is not coming back. */
const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Portal access is short: it is a shared family computer more often than not. */
const PORTAL_TTL_MS = 2 * 60 * 60 * 1000;

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set to at least 32 characters. Generate one with `openssl rand -base64 32`.",
    );
  }
  return value;
}

// ---------------------------------------------------------------------------
// Draft
// ---------------------------------------------------------------------------

export async function setDraftCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(DRAFT_COOKIE, token, cookieOptions(new Date(Date.now() + DRAFT_TTL_MS)));
}

export async function getDraftToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(DRAFT_COOKIE)?.value ?? null;
}

export async function clearDraftCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(DRAFT_COOKIE);
}

// ---------------------------------------------------------------------------
// Portal
// ---------------------------------------------------------------------------

/** Issues portal access to one application for the next two hours. */
export async function grantPortalAccess(applicationId: string): Promise<void> {
  const expiresAt = Date.now() + PORTAL_TTL_MS;
  const claim = signValue(`${applicationId}:${expiresAt}`, secret());

  const cookieStore = await cookies();
  cookieStore.set(PORTAL_COOKIE, claim, cookieOptions(new Date(expiresAt)));
}

/**
 * The application the current visitor may see, or null. A valid signature
 * with an elapsed expiry is treated the same as no cookie at all.
 */
export async function getPortalApplicationId(): Promise<string | null> {
  const cookieStore = await cookies();
  const claim = cookieStore.get(PORTAL_COOKIE)?.value;
  if (!claim) return null;

  const value = verifySignedValue(claim, secret());
  if (!value) return null;

  const separator = value.lastIndexOf(":");
  if (separator <= 0) return null;

  const applicationId = value.slice(0, separator);
  const expiresAt = Number(value.slice(separator + 1));
  if (!applicationId || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return null;
  }

  return applicationId;
}

export async function revokePortalAccess(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(PORTAL_COOKIE);
}
