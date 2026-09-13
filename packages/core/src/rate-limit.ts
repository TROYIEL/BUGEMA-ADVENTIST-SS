import "server-only";

import { db } from "@bass/db";

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export type RateLimitOptions = {
  /** Stable identifier, e.g. `contact:203.0.113.5`. */
  key: string;
  /** Maximum requests allowed inside the window. */
  limit: number;
  windowSeconds: number;
};

/**
 * Fixed-window rate limiter backed by Postgres.
 *
 * The counter is incremented and the window rolled in a single atomic upsert,
 * so two concurrent requests cannot both read a stale count and slip past the
 * limit. Postgres `now()` is the clock, which keeps it correct across multiple
 * app instances and across restarts.
 */
export async function rateLimit({
  key,
  limit,
  windowSeconds,
}: RateLimitOptions): Promise<RateLimitResult> {
  const rows = await db.$queryRaw<{ count: number; expiresAt: Date }[]>`
    INSERT INTO "rate_limits" ("key", "count", "windowStart", "expiresAt")
    VALUES (
      ${key},
      1,
      now(),
      now() + make_interval(secs => ${windowSeconds}::double precision)
    )
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "rate_limits"."expiresAt" <= now() THEN 1
        ELSE "rate_limits"."count" + 1
      END,
      "windowStart" = CASE
        WHEN "rate_limits"."expiresAt" <= now() THEN now()
        ELSE "rate_limits"."windowStart"
      END,
      "expiresAt" = CASE
        WHEN "rate_limits"."expiresAt" <= now()
        THEN now() + make_interval(secs => ${windowSeconds}::double precision)
        ELSE "rate_limits"."expiresAt"
      END
    RETURNING "count", "expiresAt"
  `;

  const row = rows[0];
  if (!row) {
    // Should be unreachable; fail closed rather than silently allowing.
    return { ok: false, remaining: 0, retryAfterSeconds: windowSeconds };
  }

  const count = Number(row.count);
  const retryAfterSeconds = Math.max(
    0,
    Math.ceil((row.expiresAt.getTime() - Date.now()) / 1000),
  );

  return {
    ok: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds,
  };
}

/** Housekeeping for expired windows; safe to call from a scheduled job. */
export async function purgeExpiredRateLimits(): Promise<number> {
  const { count } = await db.rateLimit.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}

/** Named limits, so the numbers live in one place rather than at call sites. */
export const RATE_LIMITS = {
  login: { limit: 8, windowSeconds: 15 * 60 },
  contactForm: { limit: 5, windowSeconds: 60 * 60 },
  applicationStart: { limit: 10, windowSeconds: 60 * 60 },
  applicationSubmit: { limit: 5, windowSeconds: 60 * 60 },
  applicationResumeLink: { limit: 3, windowSeconds: 60 * 60 },
  applicationStatusLookup: { limit: 10, windowSeconds: 15 * 60 },
  documentUpload: { limit: 30, windowSeconds: 60 * 60 },
} as const;
