import "server-only";

import { cookies, headers } from "next/headers";

import { generateToken, hashToken } from "./crypto";
import { db } from "@bass/db";

export const SESSION_COOKIE = "bass_session";

/** Admin sessions are deliberately short; staff share machines. */
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** Slide the expiry when a session is used inside this window of expiring. */
const SESSION_REFRESH_THRESHOLD_MS = 6 * 60 * 60 * 1000;

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

/** Best-effort client IP, for the audit log and rate limiting. */
export async function getClientIp(): Promise<string | undefined> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  return headerList.get("x-real-ip") ?? undefined;
}

/**
 * Issues a session. Only the SHA-256 of the token is stored, so the database
 * never holds a usable cookie value.
 *
 * Must be called from a Server Action or Route Handler — cookies cannot be set
 * once rendering has started streaming.
 */
export async function createSession(userId: string): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const headerList = await headers();

  await db.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      ipAddress: await getClientIp(),
      userAgent: headerList.get("user-agent")?.slice(0, 512) ?? undefined,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
}

export type SessionWithUser = NonNullable<
  Awaited<ReturnType<typeof lookupSession>>
>;

async function lookupSession(token: string) {
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      revokedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
        },
      },
    },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;
  if (!session.user.isActive) return null;

  return session;
}

/**
 * Resolves the current session from the cookie, validating against the
 * database on every call so that revoking a session takes effect immediately.
 */
export async function getSession(): Promise<SessionWithUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  return lookupSession(token);
}

/**
 * Extends a session that is close to expiring. Only callable from a Server
 * Action or Route Handler, because it writes a cookie.
 */
export async function refreshSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return;

  const session = await lookupSession(token);
  if (!session) return;

  const remaining = session.expiresAt.getTime() - Date.now();
  if (remaining > SESSION_REFRESH_THRESHOLD_MS) return;

  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.update({
    where: { id: session.id },
    data: { expiresAt },
  });
  cookieStore.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
}

/** Revokes the current session server-side and clears the cookie. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await db.session.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  cookieStore.delete(SESSION_COOKIE);
}

/** Revokes every session for a user — used when disabling or demoting an account. */
export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await db.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Revokes a user's other sessions but keeps the one making the request —
 * for a password change, which should sign out every other device.
 */
export async function revokeOtherSessions(userId: string): Promise<number> {
  const current = await getSession();
  const { count } = await db.session.updateMany({
    where: { userId, revokedAt: null, ...(current ? { id: { not: current.id } } : {}) },
    data: { revokedAt: new Date() },
  });
  return count;
}

/** Housekeeping for expired rows; safe to call from a scheduled job. */
export async function purgeExpiredSessions(): Promise<number> {
  const { count } = await db.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}
