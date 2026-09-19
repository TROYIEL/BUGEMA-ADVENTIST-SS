import "server-only";

import type { Route } from "next";
import { forbidden, redirect, unauthorized } from "next/navigation";
import { cache } from "react";

import type { UserRole } from "@/generated/prisma/enums";
import { getSession } from "./session";
import { hasPermission, type Permission } from "./rbac";

/**
 * Data Access Layer.
 *
 * Every read of the signed-in user goes through here. The bundled Next.js auth
 * guide is explicit that Proxy (proxy.ts) is optimistic UX only and that
 * "Server Functions are reachable via direct POST requests, not just through
 * your application's UI", so authorisation is enforced here, adjacent to the
 * data, in every Server Action and Route Handler.
 */

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

/** 401 — not signed in, or the session is expired/revoked. */
export class AuthenticationError extends Error {
  readonly status = 401;
  constructor(message = "Authentication required") {
    super(message);
    this.name = "AuthenticationError";
  }
}

/** 403 — signed in, but the role lacks the permission. */
export class AuthorizationError extends Error {
  readonly status = 403;
  constructor(readonly permission: Permission) {
    super(`Missing permission: ${permission}`);
    this.name = "AuthorizationError";
  }
}

/**
 * Memoised per request pass, so a page, its layout and its Server Actions
 * share one session lookup instead of hitting the database repeatedly.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  if (!session) return null;

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
  };
});

// ---------------------------------------------------------------------------
// Throwing guards — for Server Actions and Route Handlers.
// ---------------------------------------------------------------------------

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthenticationError();
  return user;
}

export async function requirePermission(
  permission: Permission,
): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasPermission(user.role, permission)) {
    throw new AuthorizationError(permission);
  }
  return user;
}

/** Non-throwing check for conditionally rendering UI affordances. */
export async function can(permission: Permission): Promise<boolean> {
  const user = await getCurrentUser();
  return user ? hasPermission(user.role, permission) : false;
}

// ---------------------------------------------------------------------------
// Page guards — convert the same checks into Next.js navigation interrupts.
// ---------------------------------------------------------------------------

/** Redirects to the login page, preserving where the user was heading. */
export async function requirePageUser(returnTo?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    // typedRoutes cannot statically analyse an interpolated href, so the
    // cast is required (see the Next.js typedRoutes reference).
    const target = (
      returnTo ? `/admin/login?next=${encodeURIComponent(returnTo)}` : "/admin/login"
    ) as Route;
    redirect(target);
  }
  return user;
}

/** Renders unauthorized.tsx (401) or forbidden.tsx (403). */
export async function requirePagePermission(
  permission: Permission,
): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) unauthorized();
  if (!hasPermission(user.role, permission)) forbidden();
  return user;
}

/**
 * Maps a guard failure onto an HTTP status for Route Handlers. Deliberately
 * returns a generic body: an unauthorised caller learns nothing about whether
 * the resource exists.
 */
export function authErrorResponse(error: unknown): Response | null {
  if (error instanceof AuthenticationError) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }
  if (error instanceof AuthorizationError) {
    return Response.json({ error: "Not permitted" }, { status: 403 });
  }
  return null;
}
