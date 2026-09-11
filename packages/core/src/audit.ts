import "server-only";

import type { Prisma } from "@bass/db/types";
import { db } from "@bass/db";
import { getClientIp } from "@bass/auth/session";

/**
 * Administrative audit log.
 *
 * Records who changed what, when. Application-specific history lives separately
 * in `application_events`, which additionally drives the applicant-facing
 * timeline; this table covers everything else in the admin area.
 */

export type AuditAction =
  | "created"
  | "updated"
  | "deleted"
  | "published"
  | "unpublished"
  | "signed_in"
  | "signed_in_failed"
  | "signed_out"
  | "role_changed"
  | "password_changed"
  | "account_disabled"
  | "account_enabled"
  | "exported";

export type RecordAuditInput = {
  actorUserId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  oldValue?: Prisma.InputJsonValue | null;
  newValue?: Prisma.InputJsonValue | null;
  note?: string;
};

/**
 * Writes an audit entry. Deliberately swallows its own errors: a logging
 * failure must not roll back the operation the user actually asked for. The
 * failure is reported to the server log instead.
 */
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        oldValue: input.oldValue ?? undefined,
        newValue: input.newValue ?? undefined,
        note: input.note,
        ipAddress: await getClientIp(),
      },
    });
  } catch (error) {
    console.error("[audit] failed to record entry", {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      error,
    });
  }
}

/**
 * Reduces a record to the fields that changed, so the audit log stores a
 * readable diff rather than two full copies of the row.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
  fields: readonly (keyof T)[],
): { old: Record<string, unknown>; new: Record<string, unknown> } | null {
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};
  let changed = false;

  for (const field of fields) {
    if (!(field in after)) continue;

    const previous = before[field];
    const next = after[field];
    if (Object.is(previous, next)) continue;
    if (
      previous instanceof Date &&
      next instanceof Date &&
      previous.getTime() === next.getTime()
    ) {
      continue;
    }

    oldValues[field as string] = serialise(previous);
    newValues[field as string] = serialise(next);
    changed = true;
  }

  return changed ? { old: oldValues, new: newValues } : null;
}

function serialise(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value === undefined) return null;
  return value;
}
