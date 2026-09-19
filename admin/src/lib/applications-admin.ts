import "server-only";

import {
  ActorType,
  ApplicationStatus,
  DocumentVerificationStatus,
} from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

import {
  sendApplicantMessageEmail,
  sendStatusUpdate,
} from "./application-mail";
import {
  APPLICATION_STATUS_COPY,
  BOARDING_LABELS,
  GENDER_LABELS,
  formatAnswer,
  toIsoDate,
  type FormFieldDefinition,
} from "./application-schemas";
import { readAnswers } from "./applications";
import { recordAudit } from "./audit";

/**
 * Admissions, from the staff side: listing, reviewing, deciding, and talking
 * to applicants. The applicant-facing rules live in `applications.ts`; this
 * module never issues tokens or cookies.
 */

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

/** Outcomes. Moving into or out of one is a decision, not a status update. */
export const DECISION_STATUSES: readonly ApplicationStatus[] = [
  ApplicationStatus.ACCEPTED,
  ApplicationStatus.CONDITIONALLY_ACCEPTED,
  ApplicationStatus.REJECTED,
];

/** Everything staff may set. Drafts are the applicant's alone. */
export const STAFF_STATUSES: readonly ApplicationStatus[] = [
  ApplicationStatus.SUBMITTED,
  ApplicationStatus.UNDER_REVIEW,
  ApplicationStatus.DOCUMENTS_REQUIRED,
  ApplicationStatus.SHORTLISTED,
  ApplicationStatus.ACCEPTED,
  ApplicationStatus.CONDITIONALLY_ACCEPTED,
  ApplicationStatus.REJECTED,
  ApplicationStatus.WITHDRAWN,
];

export function isDecision(status: ApplicationStatus): boolean {
  return DECISION_STATUSES.includes(status);
}

/** Whether changing from one status to another needs `applications:decide`. */
export function changeNeedsDecision(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return isDecision(from) || isDecision(to);
}

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

export type ApplicationFilters = {
  status?: ApplicationStatus;
  academicYearId?: string;
  applicationClassId?: string;
  /** Reference number or part of a name. */
  q?: string;
  sort?: "newest" | "oldest" | "name";
};

export const APPLICATIONS_PAGE_SIZE = 25;

function whereFor(filters: ApplicationFilters): Prisma.ApplicationWhereInput {
  const where: Prisma.ApplicationWhereInput = {
    status: filters.status ?? { not: ApplicationStatus.DRAFT },
  };
  if (filters.academicYearId) where.academicYearId = filters.academicYearId;
  if (filters.applicationClassId) where.applicationClassId = filters.applicationClassId;

  const q = filters.q?.trim();
  if (q) {
    const terms = q.split(/\s+/).filter(Boolean);
    // Each word must match somewhere, so "amina nakato" finds the applicant
    // whichever order the names were typed in.
    where.AND = terms.map((term) => ({
      OR: [
        { referenceNumber: { contains: term, mode: "insensitive" } },
        { firstName: { contains: term, mode: "insensitive" } },
        { middleName: { contains: term, mode: "insensitive" } },
        { lastName: { contains: term, mode: "insensitive" } },
        { guardianName: { contains: term, mode: "insensitive" } },
      ],
    }));
  }
  return where;
}

const LIST_SELECT = {
  id: true,
  referenceNumber: true,
  status: true,
  firstName: true,
  lastName: true,
  gender: true,
  submittedAt: true,
  decisionAt: true,
  lastSavedAt: true,
  academicYear: { select: { id: true, name: true } },
  applicationClass: { select: { id: true, name: true } },
  _count: { select: { documents: true, messages: true } },
  documents: {
    where: { status: DocumentVerificationStatus.PENDING },
    select: { id: true },
  },
} satisfies Prisma.ApplicationSelect;

export type ApplicationListRow = Prisma.ApplicationGetPayload<{ select: typeof LIST_SELECT }>;

export async function listApplications(
  filters: ApplicationFilters,
  page: number,
): Promise<{ rows: ApplicationListRow[]; total: number; totalPages: number }> {
  const where = whereFor(filters);
  const orderBy: Prisma.ApplicationOrderByWithRelationInput[] =
    filters.sort === "name"
      ? [{ lastName: "asc" }, { firstName: "asc" }]
      : filters.sort === "oldest"
        ? [{ submittedAt: "asc" }]
        : [{ submittedAt: "desc" }];

  const [rows, total] = await Promise.all([
    db.application.findMany({
      where,
      orderBy,
      skip: (page - 1) * APPLICATIONS_PAGE_SIZE,
      take: APPLICATIONS_PAGE_SIZE,
      select: LIST_SELECT,
    }),
    db.application.count({ where }),
  ]);

  return { rows, total, totalPages: Math.max(1, Math.ceil(total / APPLICATIONS_PAGE_SIZE)) };
}

/** Per-status counts for the filter chips, within the other filters. */
export async function countApplicationsByStatus(
  filters: Omit<ApplicationFilters, "status">,
): Promise<Record<ApplicationStatus, number>> {
  const groups = await db.application.groupBy({
    by: ["status"],
    where: whereFor({ ...filters, status: undefined }),
    _count: { _all: true },
  });
  const drafts = await db.application.count({
    where: { ...whereFor({ ...filters, status: undefined }), status: ApplicationStatus.DRAFT },
  });

  const counts = Object.fromEntries(
    Object.values(ApplicationStatus).map((status) => [status, 0]),
  ) as Record<ApplicationStatus, number>;
  for (const group of groups) counts[group.status] = group._count._all;
  counts[ApplicationStatus.DRAFT] = drafts;
  return counts;
}

export async function listFilterOptions(): Promise<{
  years: { id: string; name: string }[];
  classes: { id: string; name: string }[];
}> {
  const [years, classes] = await Promise.all([
    db.academicYear.findMany({
      orderBy: { name: "desc" },
      select: { id: true, name: true },
    }),
    db.applicationClass.findMany({
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return { years, classes };
}

// ---------------------------------------------------------------------------
// One application, in full
// ---------------------------------------------------------------------------

const STAFF_SELECT = {
  id: true,
  referenceNumber: true,
  status: true,
  currentStep: true,
  academicYearId: true,
  applicationClassId: true,
  boardingPreference: true,
  firstName: true,
  middleName: true,
  lastName: true,
  dateOfBirth: true,
  gender: true,
  nationality: true,
  homeDistrict: true,
  homeAddress: true,
  guardianName: true,
  guardianRelationship: true,
  guardianPhone: true,
  guardianAltPhone: true,
  guardianEmail: true,
  guardianAddress: true,
  guardianOccupation: true,
  previousSchool: true,
  previousClass: true,
  yearCompleted: true,
  examIndexNumber: true,
  examResults: true,
  answers: true,
  contactEmail: true,
  contactPhone: true,
  submittedAt: true,
  decisionAt: true,
  lastSavedAt: true,
  createdAt: true,
  academicYear: { select: { id: true, name: true } },
  applicationClass: { select: { id: true, name: true, level: true } },
  decidedBy: { select: { id: true, name: true } },
  documents: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      status: true,
      note: true,
      reviewedAt: true,
      createdAt: true,
      documentType: { select: { id: true, name: true } },
      reviewedBy: { select: { name: true } },
      mediaAsset: {
        select: { id: true, originalName: true, size: true, mimeType: true, storageKey: true },
      },
    },
  },
  events: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      action: true,
      actorType: true,
      oldValue: true,
      newValue: true,
      note: true,
      isVisibleToApplicant: true,
      createdAt: true,
      actor: { select: { name: true } },
    },
  },
  notes: {
    orderBy: { createdAt: "desc" },
    select: { id: true, body: true, createdAt: true, author: { select: { name: true } } },
  },
  messages: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      subject: true,
      body: true,
      readAt: true,
      createdAt: true,
      sentBy: { select: { name: true } },
    },
  },
} satisfies Prisma.ApplicationSelect;

export type StaffApplication = Prisma.ApplicationGetPayload<{ select: typeof STAFF_SELECT }>;

/** Drafts are not shown to staff: they are unfinished and unsubmitted. */
export async function getApplicationForStaff(id: string): Promise<StaffApplication | null> {
  return db.application.findFirst({
    where: { id, status: { not: ApplicationStatus.DRAFT } },
    select: STAFF_SELECT,
  });
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type Actor = { id: string; name: string };

export type ChangeStatusInput = {
  application: Pick<
    StaffApplication,
    "id" | "status" | "referenceNumber" | "firstName" | "lastName" | "contactEmail" | "guardianName"
  >;
  status: ApplicationStatus;
  /** Shown to the applicant in their portal and, if they have email, sent to them. */
  applicantNote: string | null;
  /** Kept for staff only. */
  internalNote: string | null;
  actor: Actor;
};

/**
 * Records the change, the decision fields where it is one, and tells the
 * applicant. The caller has already checked the permission for a decision.
 */
export async function changeApplicationStatus(input: ChangeStatusInput): Promise<void> {
  const { application, status, actor } = input;
  if (status === application.status) return;
  if (!STAFF_STATUSES.includes(status)) {
    throw new Error(`Staff cannot set status ${status}`);
  }

  const now = new Date();
  const decisionFields: Prisma.ApplicationUpdateInput = isDecision(status)
    ? { decisionAt: now, decidedBy: { connect: { id: actor.id } } }
    : { decisionAt: null, decidedBy: { disconnect: true } };

  await db.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: application.id },
      data: { status, ...decisionFields },
    });
    await tx.applicationEvent.create({
      data: {
        applicationId: application.id,
        action: "status_changed",
        actorType: ActorType.STAFF,
        actorUserId: actor.id,
        oldValue: application.status,
        newValue: status,
        note: input.applicantNote,
        isVisibleToApplicant: true,
      },
    });
    if (input.internalNote) {
      await tx.applicationNote.create({
        data: { applicationId: application.id, authorId: actor.id, body: input.internalNote },
      });
    }
  });

  await recordAudit({
    actorUserId: actor.id,
    action: "updated",
    entityType: "application",
    entityId: application.id,
    oldValue: { status: application.status },
    newValue: { status },
    note: application.referenceNumber ?? undefined,
  });

  if (application.contactEmail && application.referenceNumber) {
    const copy = APPLICATION_STATUS_COPY[status];
    await sendStatusUpdate({
      to: application.contactEmail,
      toName: application.guardianName,
      applicantName: [application.firstName, application.lastName].filter(Boolean).join(" "),
      referenceNumber: application.referenceNumber,
      statusLabel: copy.label,
      explanation: copy.explanation,
      note: input.applicantNote,
      applicationId: application.id,
    });
  }
}

export async function addInternalNote(
  applicationId: string,
  body: string,
  actor: Actor,
): Promise<void> {
  await db.applicationNote.create({
    data: { applicationId, authorId: actor.id, body },
  });
}

export type SendMessageInput = {
  application: Pick<
    StaffApplication,
    "id" | "referenceNumber" | "contactEmail" | "guardianName"
  >;
  subject: string;
  body: string;
  actor: Actor;
};

/** A message lands in the portal always, and in the inbox when there is one. */
export async function sendApplicantMessage(input: SendMessageInput): Promise<{ emailed: boolean }> {
  const { application, actor } = input;

  await db.$transaction(async (tx) => {
    await tx.applicationMessage.create({
      data: {
        applicationId: application.id,
        subject: input.subject,
        body: input.body,
        sentById: actor.id,
      },
    });
    await tx.applicationEvent.create({
      data: {
        applicationId: application.id,
        action: "message_sent",
        actorType: ActorType.STAFF,
        actorUserId: actor.id,
        newValue: input.subject,
        isVisibleToApplicant: true,
      },
    });
  });

  if (!application.contactEmail || !application.referenceNumber) {
    return { emailed: false };
  }
  await sendApplicantMessageEmail({
    to: application.contactEmail,
    toName: application.guardianName,
    referenceNumber: application.referenceNumber,
    subject: input.subject,
    body: input.body,
    applicationId: application.id,
  });
  return { emailed: true };
}

export type ReviewDocumentInput = {
  document: { id: string; applicationId: string; typeName: string };
  status: DocumentVerificationStatus;
  note: string | null;
  actor: Actor;
};

const DOCUMENT_EVENT: Record<DocumentVerificationStatus, string> = {
  [DocumentVerificationStatus.VERIFIED]: "document_verified",
  [DocumentVerificationStatus.REJECTED]: "document_rejected",
  [DocumentVerificationStatus.REPLACEMENT_REQUIRED]: "replacement_requested",
  [DocumentVerificationStatus.PENDING]: "document_reopened",
};

/**
 * Marks a document. Asking for a replacement, or rejecting one, also moves an
 * application that is merely submitted or under review to "documents needed",
 * so the applicant's portal opens the upload and the list shows why it is
 * waiting. Staff move it on again by hand once the new file is in.
 */
export async function reviewDocument(input: ReviewDocumentInput): Promise<void> {
  const { document, status, actor } = input;
  const needsReplacement =
    status === DocumentVerificationStatus.REJECTED ||
    status === DocumentVerificationStatus.REPLACEMENT_REQUIRED;

  await db.$transaction(async (tx) => {
    await tx.applicationDocument.update({
      where: { id: document.id },
      data: {
        status,
        note: input.note,
        reviewedAt: new Date(),
        reviewedById: actor.id,
      },
    });
    await tx.applicationEvent.create({
      data: {
        applicationId: document.applicationId,
        action: DOCUMENT_EVENT[status],
        actorType: ActorType.STAFF,
        actorUserId: actor.id,
        newValue: document.typeName,
        note: input.note,
        isVisibleToApplicant: true,
      },
    });

    if (needsReplacement) {
      const moved = await tx.application.updateMany({
        where: {
          id: document.applicationId,
          status: { in: [ApplicationStatus.SUBMITTED, ApplicationStatus.UNDER_REVIEW] },
        },
        data: { status: ApplicationStatus.DOCUMENTS_REQUIRED },
      });
      if (moved.count === 1) {
        await tx.applicationEvent.create({
          data: {
            applicationId: document.applicationId,
            action: "status_changed",
            actorType: ActorType.SYSTEM,
            newValue: ApplicationStatus.DOCUMENTS_REQUIRED,
            isVisibleToApplicant: true,
          },
        });
      }
    }
  });

  await recordAudit({
    actorUserId: actor.id,
    action: "updated",
    entityType: "application_document",
    entityId: document.id,
    newValue: { status },
    note: document.typeName,
  });
}

// ---------------------------------------------------------------------------
// Review queue
// ---------------------------------------------------------------------------

const QUEUE_SELECT = {
  id: true,
  status: true,
  createdAt: true,
  documentType: { select: { name: true } },
  mediaAsset: { select: { originalName: true, size: true, mimeType: true } },
  application: {
    select: {
      id: true,
      referenceNumber: true,
      firstName: true,
      lastName: true,
      status: true,
      applicationClass: { select: { name: true } },
    },
  },
} satisfies Prisma.ApplicationDocumentSelect;

export type QueuedDocument = Prisma.ApplicationDocumentGetPayload<{ select: typeof QUEUE_SELECT }>;

/** Documents nobody has looked at yet, oldest first, across every open application. */
export async function listPendingDocuments(limit = 100): Promise<QueuedDocument[]> {
  return db.applicationDocument.findMany({
    where: {
      status: DocumentVerificationStatus.PENDING,
      application: { status: { not: ApplicationStatus.DRAFT } },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: QUEUE_SELECT,
  });
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  // Quote when needed; double any quotes inside. A leading =, +, - or @ is
  // prefixed so a spreadsheet does not run it as a formula.
  const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

/** The current filter as CSV. Streams nothing: the intake is hundreds, not millions. */
export async function exportApplicationsCsv(
  filters: ApplicationFilters,
  fields: FormFieldDefinition[],
): Promise<string> {
  const rows = await db.application.findMany({
    where: whereFor(filters),
    orderBy: [{ submittedAt: "asc" }],
    select: {
      ...STAFF_SELECT,
      events: false,
      notes: false,
      messages: false,
    },
  });

  const header = [
    "Reference",
    "Status",
    "Submitted",
    "Decided",
    "Decided by",
    "Academic year",
    "Class",
    "Day or boarding",
    "First name",
    "Middle name",
    "Surname",
    "Date of birth",
    "Gender",
    "Nationality",
    "District",
    "Home address",
    "Guardian",
    "Relationship",
    "Guardian phone",
    "Guardian alt phone",
    "Guardian email",
    "Guardian occupation",
    "Guardian address",
    "Previous school",
    "Previous class",
    "Year completed",
    "Exam index number",
    "Exam results",
    "Documents",
    "Documents verified",
    ...fields.map((field) => field.label),
  ];

  const lines = [header.map(csvCell).join(",")];
  for (const row of rows) {
    const answers = readAnswers(row);
    lines.push(
      [
        row.referenceNumber,
        APPLICATION_STATUS_COPY[row.status].label,
        row.submittedAt,
        row.decisionAt,
        row.decidedBy?.name,
        row.academicYear.name,
        row.applicationClass?.name,
        row.boardingPreference ? BOARDING_LABELS[row.boardingPreference] : "",
        row.firstName,
        row.middleName,
        row.lastName,
        toIsoDate(row.dateOfBirth),
        row.gender ? GENDER_LABELS[row.gender] : "",
        row.nationality,
        row.homeDistrict,
        row.homeAddress,
        row.guardianName,
        row.guardianRelationship,
        row.guardianPhone,
        row.guardianAltPhone,
        row.guardianEmail,
        row.guardianOccupation,
        row.guardianAddress,
        row.previousSchool,
        row.previousClass,
        row.yearCompleted,
        row.examIndexNumber,
        row.examResults,
        row.documents.length,
        row.documents.filter((doc) => doc.status === DocumentVerificationStatus.VERIFIED).length,
        ...fields.map((field) => formatAnswer(field, answers[field.key])),
      ]
        .map(csvCell)
        .join(","),
    );
  }

  // A byte-order mark, so spreadsheets open the file as UTF-8 and names keep their accents.
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
