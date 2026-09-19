import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

import type { AuditAction } from "./audit";

/**
 * Reading the audit log. Entries are never edited or deleted from here —
 * a log that can be tidied is not a log.
 */

export const AUDIT_PAGE_SIZE = 50;

const ENTRY_SELECT = {
  id: true,
  action: true,
  entityType: true,
  entityId: true,
  oldValue: true,
  newValue: true,
  note: true,
  ipAddress: true,
  createdAt: true,
  actor: { select: { id: true, name: true, email: true } },
} satisfies Prisma.AuditLogSelect;

export type AuditEntry = Prisma.AuditLogGetPayload<{ select: typeof ENTRY_SELECT }>;

export type AuditFilters = {
  action?: string;
  entityType?: string;
  actorId?: string;
  /** Free text, matched against the note and the entity id. */
  q?: string;
  from?: Date | null;
  to?: Date | null;
};

export async function listAuditEntries(filters: AuditFilters, page: number): Promise<{ rows: AuditEntry[]; total: number; page: number; pages: number }> {
  const q = filters.q?.trim();
  const where: Prisma.AuditLogWhereInput = {
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(filters.actorId ? { actorUserId: filters.actorId } : {}),
    ...(filters.from || filters.to
      ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
      : {}),
    ...(q ? { OR: [{ note: { contains: q, mode: "insensitive" } }, { entityId: q }] } : {}),
  };
  const total = await db.auditLog.count({ where });
  const pages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pages);
  const rows = await db.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (current - 1) * AUDIT_PAGE_SIZE,
    take: AUDIT_PAGE_SIZE,
    select: ENTRY_SELECT,
  });
  return { rows, total, page: current, pages };
}

/** The values the filters can take: what has actually been logged. */
export async function listAuditFacets(): Promise<{ actions: string[]; entityTypes: string[]; actors: { id: string; name: string }[] }> {
  const [actions, entityTypes, actors] = await Promise.all([
    db.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
    db.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
    db.user.findMany({ where: { auditLogs: { some: {} } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return {
    actions: actions.map((row) => row.action),
    entityTypes: entityTypes.map((row) => row.entityType),
    actors,
  };
}

/** Everything logged about one record, newest first — for a record's own page. */
export async function listAuditForEntity(entityType: string, entityId: string, take = 20): Promise<AuditEntry[]> {
  return db.auditLog.findMany({ where: { entityType, entityId }, orderBy: { createdAt: "desc" }, take, select: ENTRY_SELECT });
}

export const ACTION_WORDS: Record<AuditAction, string> = {
  created: "Created",
  updated: "Updated",
  deleted: "Deleted",
  published: "Published",
  unpublished: "Unpublished",
  signed_in: "Signed in",
  signed_in_failed: "Sign-in failed",
  signed_out: "Signed out",
  role_changed: "Role changed",
  password_changed: "Password changed",
  account_disabled: "Account disabled",
  account_enabled: "Account enabled",
  exported: "Exported",
};

/** "application_document" → "Application document". */
export function entityWords(entityType: string): string {
  const words = entityType.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Where in the admin app a logged record can be opened, if anywhere. */
export function entityPath(entityType: string, entityId: string | null): string | null {
  if (!entityId) return null;
  switch (entityType) {
    case "application":
      return `/applications/${entityId}`;
    case "page":
      return `/pages/${entityId}`;
    case "news_article":
      return `/news/${entityId}`;
    case "event":
      return `/events/${entityId}`;
    case "gallery_album":
      return `/gallery/${entityId}`;
    case "hero_slide":
      return `/hero-slides/${entityId}`;
    case "media_asset":
      return `/media-library/${entityId}`;
    case "academic_program":
      return `/academics/programmes/${entityId}`;
    case "academic_department":
      return `/academics/departments/${entityId}`;
    case "staff_profile":
      return `/staff/${entityId}`;
    case "contact_enquiry":
      return `/enquiries/${entityId}`;
    case "user":
      return `/users/${entityId}`;
    case "subject":
      return "/academics#subjects";
    case "announcement":
      return "/announcements";
    case "academic_year":
      return "/academic-years";
    case "application_class":
    case "document_type":
    case "admission_requirement":
    case "application_form_field":
      return "/requirements";
    case "navigation_item":
      return "/navigation";
    case "site_setting":
      return "/settings";
    default:
      return null;
  }
}
