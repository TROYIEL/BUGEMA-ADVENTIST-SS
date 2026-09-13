"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  clearDraftCookie,
  getDraftToken,
  grantPortalAccess,
  setDraftCookie,
} from "@bass/auth/applicant";
import { getClientIp } from "@bass/auth/session";
import { ApplicationStep } from "@bass/db/enums";
import type { Prisma } from "@bass/db/types";
import { sendDraftResumeLink } from "@bass/core/application-mail";
import {
  academicSchema,
  applicantSchema,
  buildAnswersSchema,
  declarationSchema,
  guardianSchema,
  readAnswerFromForm,
  stepDefinition,
  type FormFieldDefinition,
} from "@bass/core/application-schemas";
import {
  createDraft,
  documentTypesFor,
  fieldsForStep,
  findDraft,
  furthestStep,
  getAdmissionsWindow,
  getApplicationConfig,
  readAnswers,
  removeDraftDocument,
  stepAfter,
  storeDocument,
  submitApplication,
  updateDraft,
  visibleSteps,
  type DraftApplication,
} from "@bass/core/applications";
import { RATE_LIMITS, rateLimit } from "@bass/core/rate-limit";

/**
 * Server Actions behind the application wizard.
 *
 * Each one re-reads the draft from the cookie and the configuration from the
 * database: nothing about which application is being edited, or what the form
 * should contain, is taken from the request body. The body only carries
 * answers.
 */

export type StepFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Echoed back so a rejected save does not lose what was typed. */
  values?: Record<string, string | string[] | boolean>;
};

function stepPath(slug: string): `/admissions/apply/${string}` {
  return `/admissions/apply/${slug}`;
}

/** The draft behind the visitor's cookie, or a redirect to the start page. */
async function requireDraft(): Promise<DraftApplication> {
  const token = await getDraftToken();
  const draft = token ? await findDraft(token) : null;
  if (!draft) redirect("/admissions/apply");
  return draft;
}

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "");
}

function firstIssues(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !(key in errors)) errors[key] = issue.message;
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

export async function startApplication(): Promise<void> {
  const window = await getAdmissionsWindow();
  if (!window.isOpen || !window.year) redirect("/admissions/apply");

  // A visitor who already has a draft is taken back to it, not given a second one.
  const existingToken = await getDraftToken();
  const existing = existingToken ? await findDraft(existingToken) : null;
  if (existing) {
    const config = await getApplicationConfig();
    const steps = visibleSteps(config, existing);
    redirect(stepPath(furthestStep(steps, existing.currentStep).slug));
  }

  const ip = (await getClientIp()) ?? "unknown";
  const limit = await rateLimit({ key: `application-start:${ip}`, ...RATE_LIMITS.applicationStart });
  if (!limit.ok) redirect("/admissions/apply?error=busy");

  const draft = await createDraft(window.year.id);
  await setDraftCookie(draft.token);
  redirect(stepPath(stepDefinition(ApplicationStep.APPLICANT).slug));
}

// ---------------------------------------------------------------------------
// Saving a step
// ---------------------------------------------------------------------------

/** Reads and validates the school's extra questions for a step. */
function parseAnswers(
  fields: FormFieldDefinition[],
  formData: FormData,
):
  | { ok: true; answers: Record<string, unknown> }
  | { ok: false; fieldErrors: Record<string, string>; raw: Record<string, string | string[] | boolean> } {
  const raw: Record<string, string | string[] | boolean> = {};
  for (const field of fields) {
    raw[`answer:${field.key}`] = readAnswerFromForm(formData, field) as
      | string
      | string[]
      | boolean;
  }

  const input: Record<string, unknown> = {};
  for (const field of fields) input[field.key] = raw[`answer:${field.key}`];

  const parsed = buildAnswersSchema(fields).safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const [key, message] of Object.entries(firstIssues(parsed.error))) {
      fieldErrors[`answer:${key}`] = message;
    }
    return { ok: false, fieldErrors, raw };
  }
  return { ok: true, answers: parsed.data };
}

export async function saveStep(
  step: ApplicationStep,
  _previous: StepFormState,
  formData: FormData,
): Promise<StepFormState> {
  const [draft, config] = await Promise.all([requireDraft(), getApplicationConfig()]);

  const fields = fieldsForStep(config, step);
  const answersResult = parseAnswers(fields, formData);

  let data: Prisma.ApplicationUpdateInput = {};
  let values: Record<string, string> = {};
  let fieldErrors: Record<string, string> = answersResult.ok ? {} : answersResult.fieldErrors;
  let classLevel = draft.applicationClass?.level ?? null;

  switch (step) {
    case ApplicationStep.APPLICANT: {
      values = {
        applicationClassId: text(formData, "applicationClassId"),
        boardingPreference: text(formData, "boardingPreference"),
        firstName: text(formData, "firstName"),
        middleName: text(formData, "middleName"),
        lastName: text(formData, "lastName"),
        dateOfBirth: text(formData, "dateOfBirth"),
        gender: text(formData, "gender"),
        nationality: text(formData, "nationality"),
        homeDistrict: text(formData, "homeDistrict"),
        homeAddress: text(formData, "homeAddress"),
      };
      const parsed = applicantSchema.safeParse(values);
      if (!parsed.success) {
        fieldErrors = { ...firstIssues(parsed.error), ...fieldErrors };
        break;
      }
      const chosenClass = config.classes.find((entry) => entry.id === parsed.data.applicationClassId);
      if (!chosenClass) {
        fieldErrors.applicationClassId = "Choose one of the classes offered.";
        break;
      }
      classLevel = chosenClass.level;
      const { applicationClassId, ...rest } = parsed.data;
      data = { ...rest, applicationClass: { connect: { id: applicationClassId } } };
      break;
    }

    case ApplicationStep.GUARDIAN: {
      values = {
        guardianName: text(formData, "guardianName"),
        guardianRelationship: text(formData, "guardianRelationship"),
        guardianPhone: text(formData, "guardianPhone"),
        guardianAltPhone: text(formData, "guardianAltPhone"),
        guardianEmail: text(formData, "guardianEmail"),
        guardianOccupation: text(formData, "guardianOccupation"),
        guardianAddress: text(formData, "guardianAddress"),
      };
      const parsed = guardianSchema.safeParse(values);
      if (!parsed.success) {
        fieldErrors = { ...firstIssues(parsed.error), ...fieldErrors };
        break;
      }
      data = {
        ...parsed.data,
        // The guardian is who we talk to. Kept in separate columns so staff
        // can later redirect correspondence without editing the guardian.
        contactEmail: parsed.data.guardianEmail,
        contactPhone: parsed.data.guardianPhone,
      };
      break;
    }

    case ApplicationStep.ACADEMIC: {
      values = {
        previousSchool: text(formData, "previousSchool"),
        previousClass: text(formData, "previousClass"),
        yearCompleted: text(formData, "yearCompleted"),
        examIndexNumber: text(formData, "examIndexNumber"),
        examResults: text(formData, "examResults"),
      };
      const parsed = academicSchema.safeParse(values);
      if (!parsed.success) {
        fieldErrors = { ...firstIssues(parsed.error), ...fieldErrors };
        break;
      }
      data = parsed.data;
      break;
    }

    case ApplicationStep.ADDITIONAL:
      break;

    default:
      return { status: "error", message: "This step cannot be saved here." };
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors,
      values: { ...values, ...(answersResult.ok ? {} : answersResult.raw) },
    };
  }

  if (answersResult.ok && fields.length > 0) {
    data.answers = {
      ...readAnswers(draft),
      ...answersResult.answers,
    } as Prisma.InputJsonValue;
  }

  // The class chosen on the first step decides which documents are asked for,
  // so the step list is worked out from the level just saved, not the old one.
  const steps = visibleSteps(config, {
    applicationClass: classLevel ? { level: classLevel } : null,
  });
  const next = stepAfter(steps, step) ?? stepDefinition(ApplicationStep.REVIEW);

  await updateDraft(draft, data, next.step);
  redirect(stepPath(next.slug));
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export async function uploadDocument(
  _previous: StepFormState,
  formData: FormData,
): Promise<StepFormState> {
  const [draft, config] = await Promise.all([requireDraft(), getApplicationConfig()]);

  // The type id only selects among the types this application may use; it
  // cannot name one outside that list.
  const documentTypeId = text(formData, "documentTypeId");
  const documentType = documentTypesFor(config, draft.applicationClass?.level ?? null).find(
    (type) => type.id === documentTypeId,
  );
  if (!documentType) {
    return { status: "error", message: "This document is not part of the application." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose a file to upload." };
  }

  const ip = (await getClientIp()) ?? "unknown";
  const limit = await rateLimit({ key: `document-upload:${ip}`, ...RATE_LIMITS.documentUpload });
  if (!limit.ok) {
    return {
      status: "error",
      message: "Too many uploads in a short time. Please wait a little and try again.",
    };
  }

  const result = await storeDocument({ application: draft, documentType, file });
  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  refresh();
  return { status: "success", message: `${documentType.name} uploaded.` };
}

export async function removeDocument(formData: FormData): Promise<void> {
  const draft = await requireDraft();
  await removeDraftDocument(draft.id, text(formData, "documentId"));
  refresh();
}

/** Fewer parameters than useActionState passes, which TypeScript permits; neither is needed. */
export async function completeDocuments(): Promise<StepFormState> {
  const [draft, config] = await Promise.all([requireDraft(), getApplicationConfig()]);

  const missing = documentTypesFor(config, draft.applicationClass?.level ?? null).filter(
    (type) => type.isRequired && !draft.documents.some((doc) => doc.documentTypeId === type.id),
  );
  if (missing.length > 0) {
    return {
      status: "error",
      message: `Please upload: ${missing.map((type) => type.name).join(", ")}.`,
    };
  }

  await updateDraft(draft, {}, ApplicationStep.REVIEW);
  redirect(stepPath(stepDefinition(ApplicationStep.REVIEW).slug));
}

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------

export type SubmitFormState = StepFormState & {
  /** Where to send the applicant to fix the problem, when there is one. */
  fixStep?: { slug: string; title: string };
};

export async function submit(
  _previous: SubmitFormState,
  formData: FormData,
): Promise<SubmitFormState> {
  const [draft, config] = await Promise.all([requireDraft(), getApplicationConfig()]);

  const declaration = declarationSchema.safeParse({ declaration: text(formData, "declaration") });
  if (!declaration.success) {
    return {
      status: "error",
      fieldErrors: firstIssues(declaration.error),
      message: "Please confirm the declaration.",
    };
  }

  const ip = (await getClientIp()) ?? "unknown";
  const limit = await rateLimit({ key: `application-submit:${ip}`, ...RATE_LIMITS.applicationSubmit });
  if (!limit.ok) {
    return {
      status: "error",
      message: "Several applications have been submitted from this connection recently. Please try again later.",
    };
  }

  const result = await submitApplication(draft, config);
  if (!result.ok) {
    const fix = result.problem ? stepDefinition(result.problem.step) : null;
    return {
      status: "error",
      message: result.message,
      fixStep: fix ? { slug: fix.slug, title: fix.title } : undefined,
    };
  }

  // The draft cookie has done its job; the portal cookie takes over.
  await clearDraftCookie();
  await grantPortalAccess(result.id);
  redirect("/admissions/application-status?submitted=1");
}

// ---------------------------------------------------------------------------
// Continue later
// ---------------------------------------------------------------------------

export async function emailResumeLink(): Promise<StepFormState> {
  const draft = await requireDraft();
  const token = await getDraftToken();

  if (!draft.guardianEmail || !token) {
    return {
      status: "error",
      message: "Add an email address on the parent or guardian step first.",
    };
  }

  const limit = await rateLimit({
    key: `application-resume:${draft.id}`,
    ...RATE_LIMITS.applicationResumeLink,
  });
  if (!limit.ok) {
    return { status: "error", message: "A link was sent recently. Check your inbox, including spam." };
  }

  await sendDraftResumeLink({
    to: draft.guardianEmail,
    toName: draft.guardianName,
    draftToken: token,
    applicationId: draft.id,
  });

  return {
    status: "success",
    message: `A link to continue has been sent to ${draft.guardianEmail}.`,
  };
}
