"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";

import { recordAudit } from "@bass/core/audit";
import { createSession, destroySession, getClientIp } from "@bass/auth/session";
import { verifyPassword } from "@bass/auth/crypto";
import { db } from "@bass/db";
import { RATE_LIMITS, rateLimit } from "@bass/core/rate-limit";

const loginSchema = z.object({
  email: z.email("Enter a valid email address.").max(254),
  password: z.string().min(1, "Enter your password."),
  next: z.string().optional(),
});

export type LoginState = {
  error?: string;
  fieldErrors?: { email?: string; password?: string };
};

/**
 * Only internal admin paths are accepted as a post-login destination, so a
 * crafted `?next=https://evil.example` cannot turn the login form into an open
 * redirect.
 */
function safeRedirectTarget(next: string | undefined): Route {
  // This is a separate application, so every legitimate destination is a
  // path on this origin. Anything that is not a plain absolute path — a
  // protocol-relative "//evil.example", a backslash trick, an absolute URL —
  // is discarded rather than sanitised, so the login form can never be turned
  // into an open redirect.
  if (!next) return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//") || next.includes("\\")) return "/";
  // Validated above; typedRoutes cannot verify a runtime string.
  return next as Route;
}

export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error);
    return {
      fieldErrors: {
        email: flattened.fieldErrors.email?.[0],
        password: flattened.fieldErrors.password?.[0],
      },
    };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const ip = (await getClientIp()) ?? "unknown";

  // Limited per address AND per account, so neither a single host nor a
  // distributed attempt against one account can brute force a password.
  for (const key of [`login:ip:${ip}`, `login:email:${email}`]) {
    const limit = await rateLimit({ key, ...RATE_LIMITS.login });
    if (!limit.ok) {
      return {
        error: `Too many sign-in attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`,
      };
    }
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, isActive: true },
  });

  // A wrong password, an unknown address and a disabled account all produce
  // the same message, so the form cannot be used to enumerate staff accounts.
  const genericFailure: LoginState = {
    error: "Those details were not recognised.",
  };

  if (!user) {
    // Burn comparable time on an unknown address so response timing does not
    // reveal whether the account exists.
    await verifyPassword(parsed.data.password, "scrypt$32768$8$1$AAAA$AAAA");
    return genericFailure;
  }

  const passwordMatches = await verifyPassword(
    parsed.data.password,
    user.passwordHash,
  );

  if (!passwordMatches || !user.isActive) {
    await recordAudit({
      actorUserId: user.id,
      action: "signed_in_failed",
      entityType: "user",
      entityId: user.id,
      note: user.isActive ? "Incorrect password" : "Account is disabled",
    });
    return genericFailure;
  }

  await createSession(user.id);
  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await recordAudit({
    actorUserId: user.id,
    action: "signed_in",
    entityType: "user",
    entityId: user.id,
  });

  // redirect() throws to unwind, so it must sit outside any try/catch.
  redirect(safeRedirectTarget(parsed.data.next));
}

export async function logoutAction(): Promise<void> {
  const { getCurrentUser } = await import("@bass/auth/dal");
  const user = await getCurrentUser();

  if (user) {
    await recordAudit({
      actorUserId: user.id,
      action: "signed_out",
      entityType: "user",
      entityId: user.id,
    });
  }

  await destroySession();
  redirect("/login");
}
