import "server-only";

import {
  ApplicationStatus,
  DocumentVerificationStatus,
  EmailStatus,
  EnquiryStatus,
  type UserRole,
} from "@/generated/prisma/enums";
import { hasPermission } from "@/lib/auth/rbac";
import { db } from "@/lib/db";

/**
 * The small numbers next to sidebar entries: things waiting for a person.
 *
 * Keyed by the entry's href so the sidebar can look them up without knowing
 * what each one means. Only the modules the role may open are counted, for
 * the same reason the entries themselves are filtered — a content editor
 * must not be told how many applications are waiting.
 */
export type NavCounts = Partial<Record<"/applications" | "/documents" | "/enquiries" | "/outbox", number>>;

export async function getNavCounts(role: UserRole): Promise<NavCounts> {
  const counts: NavCounts = {};
  const jobs: Promise<void>[] = [];

  if (hasPermission(role, "applications:read")) {
    jobs.push(
      db.application
        .count({ where: { status: ApplicationStatus.SUBMITTED } })
        .then((n) => void (counts["/applications"] = n)),
    );
  }
  if (hasPermission(role, "documents:review")) {
    jobs.push(
      db.applicationDocument
        .count({
          where: {
            status: DocumentVerificationStatus.PENDING,
            application: { status: { not: ApplicationStatus.DRAFT } },
          },
        })
        .then((n) => void (counts["/documents"] = n)),
    );
  }
  if (hasPermission(role, "messages:read")) {
    jobs.push(
      db.contactEnquiry
        .count({ where: { status: EnquiryStatus.UNREAD } })
        .then((n) => void (counts["/enquiries"] = n)),
    );
  }
  if (hasPermission(role, "settings:write")) {
    jobs.push(
      db.emailOutbox
        .count({ where: { status: EmailStatus.FAILED } })
        .then((n) => void (counts["/outbox"] = n)),
    );
  }

  await Promise.all(jobs);
  return counts;
}
