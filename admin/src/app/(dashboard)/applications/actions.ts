"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/rbac";
import { ApplicationStatus, DocumentVerificationStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import {
  STAFF_STATUSES,
  addInternalNote,
  changeApplicationStatus,
  changeNeedsDecision,
  reviewDocument,
  sendApplicantMessage,
} from "@/lib/applications-admin";

/**
 * Staff actions on one application. Each one takes the application (or
 * document) id and the change, and re-reads everything else from the
 * database under the signed-in user's permissions — a form cannot hand us a
 * status it is not allowed to set, or a row it is not allowed to touch.
 */

export type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function firstIssues(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !(key in errors)) errors[key] = issue.message;
  }
  return errors;
}

function refresh(applicationId: string) {
  revalidatePath(`/applications/${applicationId}`);
  revalidatePath("/applications");
  revalidatePath("/documents");
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

const statusSchema = z.object({
  status: z.enum(ApplicationStatus, { error: "Choose a status." }),
  note: z.string().trim().max(4000, "Keep the note under 4000 characters."),
  noteAudience: z.enum(["applicant", "internal"]),
});

export async function changeStatus(
  applicationId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission("applications:write");

  const parsed = statusSchema.safeParse({
    status: text(formData, "status"),
    note: text(formData, "note"),
    noteAudience: text(formData, "noteAudience") || "applicant",
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: firstIssues(parsed.error) };
  }
  if (!STAFF_STATUSES.includes(parsed.data.status)) {
    return { status: "error", message: "That status cannot be set by staff." };
  }

  const application = await db.application.findFirst({
    where: { id: applicationId, status: { not: ApplicationStatus.DRAFT } },
    select: {
      id: true,
      status: true,
      referenceNumber: true,
      firstName: true,
      lastName: true,
      contactEmail: true,
      guardianName: true,
    },
  });
  if (!application) {
    return { status: "error", message: "This application no longer exists." };
  }
  if (application.status === parsed.data.status) {
    return { status: "error", message: "The application is already in that status." };
  }

  // Outcomes are a separate permission from day-to-day status changes.
  if (
    changeNeedsDecision(application.status, parsed.data.status) &&
    !hasPermission(user.role, "applications:decide")
  ) {
    return {
      status: "error",
      message: "Your role can review applications but not record or change a decision.",
    };
  }

  const note = parsed.data.note || null;
  await changeApplicationStatus({
    application,
    status: parsed.data.status,
    applicantNote: parsed.data.noteAudience === "applicant" ? note : null,
    internalNote: parsed.data.noteAudience === "internal" ? note : null,
    actor: { id: user.id, name: user.name },
  });

  refresh(applicationId);
  return {
    status: "success",
    message: application.contactEmail
      ? "Status updated. The applicant has been emailed."
      : "Status updated. The applicant has no email address on file, so they will see this when they next check their application.",
  };
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export async function addNote(
  applicationId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission("applications:write");

  const body = text(formData, "body");
  if (body.length < 2) {
    return { status: "error", fieldErrors: { body: "Write a note first." } };
  }
  if (body.length > 4000) {
    return { status: "error", fieldErrors: { body: "Keep the note under 4000 characters." } };
  }

  const exists = await db.application.count({
    where: { id: applicationId, status: { not: ApplicationStatus.DRAFT } },
  });
  if (!exists) return { status: "error", message: "This application no longer exists." };

  await addInternalNote(applicationId, body, { id: user.id, name: user.name });
  refresh(applicationId);
  return { status: "success", message: "Note added." };
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

const messageSchema = z.object({
  subject: z.string().trim().min(3, "Give the message a subject.").max(160),
  body: z.string().trim().min(10, "Write the message first.").max(6000),
});

export async function sendMessage(
  applicationId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission("messages:write");

  const parsed = messageSchema.safeParse({
    subject: text(formData, "subject"),
    body: text(formData, "body"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: firstIssues(parsed.error) };
  }

  const application = await db.application.findFirst({
    where: { id: applicationId, status: { not: ApplicationStatus.DRAFT } },
    select: { id: true, referenceNumber: true, contactEmail: true, guardianName: true },
  });
  if (!application) return { status: "error", message: "This application no longer exists." };

  const { emailed } = await sendApplicantMessage({
    application,
    subject: parsed.data.subject,
    body: parsed.data.body,
    actor: { id: user.id, name: user.name },
  });

  refresh(applicationId);
  return {
    status: "success",
    message: emailed
      ? "Message sent and emailed to the applicant."
      : "Message saved. The applicant has no email address, so they will see it in their portal.",
  };
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

const reviewSchema = z.object({
  decision: z.enum(DocumentVerificationStatus, { error: "Choose an outcome." }),
  note: z.string().trim().max(1000, "Keep the note under 1000 characters."),
});

export async function review(
  documentId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission("documents:review");

  const parsed = reviewSchema.safeParse({
    decision: text(formData, "decision"),
    note: text(formData, "note"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: firstIssues(parsed.error) };
  }

  const needsNote =
    parsed.data.decision === DocumentVerificationStatus.REJECTED ||
    parsed.data.decision === DocumentVerificationStatus.REPLACEMENT_REQUIRED;
  if (needsNote && parsed.data.note.length < 5) {
    return {
      status: "error",
      fieldErrors: { note: "Tell the applicant what is wrong and what to send instead." },
    };
  }

  const document = await db.applicationDocument.findFirst({
    where: { id: documentId, application: { status: { not: ApplicationStatus.DRAFT } } },
    select: {
      id: true,
      applicationId: true,
      documentType: { select: { name: true } },
    },
  });
  if (!document) return { status: "error", message: "This document no longer exists." };

  await reviewDocument({
    document: {
      id: document.id,
      applicationId: document.applicationId,
      typeName: document.documentType?.name ?? "Document",
    },
    status: parsed.data.decision,
    note: parsed.data.note || null,
    actor: { id: user.id, name: user.name },
  });

  refresh(document.applicationId);
  return { status: "success", message: "Document updated." };
}
