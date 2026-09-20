import "server-only";

import { EmailStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

import { flushOutbox, type FlushOutboxResult } from "./mail";

/**
 * The outbox as staff see it: what was queued, what went out, what failed
 * and why — and a way to try again by hand.
 *
 * Read-only apart from re-sending. Messages are never edited or deleted from
 * here: the outbox is the record of what the system tried to tell people.
 */

export const OUTBOX_PAGE_SIZE = 50;

export type OutboxFilters = {
  status?: EmailStatus;
  /** Matches the subject or the address, case-insensitively. */
  q?: string;
};

export type OutboxRow = {
  id: string;
  toAddress: string;
  toName: string | null;
  subject: string;
  status: EmailStatus;
  attempts: number;
  lastError: string | null;
  relatedType: string | null;
  relatedId: string | null;
  sentAt: Date | null;
  createdAt: Date;
};

export type OutboxMessage = OutboxRow & { html: string; text: string | null };

export type OutboxCounts = Record<EmailStatus, number> & { all: number };

function whereFor(filters: OutboxFilters): Prisma.EmailOutboxWhereInput {
  const where: Prisma.EmailOutboxWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.q) {
    where.OR = [
      { subject: { contains: filters.q, mode: "insensitive" } },
      { toAddress: { contains: filters.q, mode: "insensitive" } },
      { toName: { contains: filters.q, mode: "insensitive" } },
    ];
  }
  return where;
}

const ROW_SELECT = {
  id: true,
  toAddress: true,
  toName: true,
  subject: true,
  status: true,
  attempts: true,
  lastError: true,
  relatedType: true,
  relatedId: true,
  sentAt: true,
  createdAt: true,
} satisfies Prisma.EmailOutboxSelect;

export async function listOutbox(
  filters: OutboxFilters,
  page: number,
): Promise<{ rows: OutboxRow[]; total: number; pages: number; page: number }> {
  const where = whereFor(filters);
  const total = await db.emailOutbox.count({ where });
  const pages = Math.max(1, Math.ceil(total / OUTBOX_PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pages);
  const rows = await db.emailOutbox.findMany({
    where,
    select: ROW_SELECT,
    orderBy: { createdAt: "desc" },
    skip: (current - 1) * OUTBOX_PAGE_SIZE,
    take: OUTBOX_PAGE_SIZE,
  });
  return { rows, total, pages, page: current };
}

export async function countOutbox(): Promise<OutboxCounts> {
  const grouped = await db.emailOutbox.groupBy({ by: ["status"], _count: { _all: true } });
  const counts: OutboxCounts = { QUEUED: 0, SENT: 0, FAILED: 0, all: 0 };
  for (const row of grouped) {
    counts[row.status] = row._count._all;
    counts.all += row._count._all;
  }
  return counts;
}

export async function getOutboxMessage(id: string): Promise<OutboxMessage | null> {
  return db.emailOutbox.findUnique({ where: { id }, select: { ...ROW_SELECT, html: true, text: true } });
}

/** Whether a message is one that can be tried again. */
export function isResendable(status: EmailStatus): boolean {
  return status === EmailStatus.QUEUED || status === EmailStatus.FAILED;
}

/**
 * Tries one message again, ignoring the automatic attempt cap: a person
 * asking for a retry has presumably fixed whatever was wrong.
 */
export async function resendOutboxMessage(id: string): Promise<FlushOutboxResult> {
  return flushOutbox({ ids: [id], limit: 1, maxAttempts: Number.MAX_SAFE_INTEGER });
}

/** Tries every queued and failed message again, oldest first. */
export async function resendAllOutbox(): Promise<FlushOutboxResult> {
  return flushOutbox({ limit: 200, maxAttempts: Number.MAX_SAFE_INTEGER });
}

/** Where in the admin app the thing a message is about can be opened. */
export function relatedPath(relatedType: string | null, relatedId: string | null): string | null {
  if (!relatedId) return null;
  switch (relatedType) {
    case "application":
      return `/applications/${relatedId}`;
    case "contact_enquiry":
    case "enquiry":
      return `/enquiries/${relatedId}`;
    default:
      return null;
  }
}
