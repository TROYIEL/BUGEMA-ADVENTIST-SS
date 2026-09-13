import "server-only";

import { randomUUID } from "node:crypto";

import { checksum, generateToken, hashToken } from "@bass/auth/crypto";
import {
  ActorType,
  ApplicationStatus,
  ApplicationStep,
  DocumentVerificationStatus,
  MediaVisibility,
  StudyLevel,
} from "@bass/db/enums";
import type { Prisma } from "@bass/db/types";
import { db } from "@bass/db";

import {
  APPLICATION_STATUS_COPY,
  APPLY_STEPS,
  academicSchema,
  applicantSchema,
  buildAnswersSchema,
  formatReferenceNumber,
  guardianSchema,
  parseFieldOptions,
  stepOrder,
  toIsoDate,
  type AnswerValue,
  type FormFieldDefinition,
  type LookupInput,
  type StepDefinition,
} from "./application-schemas";
import {
  sendAdminNewApplicationNotice,
  sendSubmissionConfirmation,
} from "./application-mail";
import { processUploadedDocument } from "./media";
import { validateUpload } from "./mime";
import { getSiteSettings, readBooleanSetting } from "./settings";
import { buildStorageKey, storage } from "./storage";

/**
 * Admissions: drafts, documents, submission, reference numbers and the
 * applicant portal.
 *
 * Shared by the public website (which writes applications) and the
 * administration system (which reads and decides on them), so the rules about
 * what an applicant may do to an application are written once, here.
 */

/**
 * Hard ceiling regardless of what an administrator sets on a document type.
 * The web app's Server Action body limit is sized to accommodate this.
 */
export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;

// ---------------------------------------------------------------------------
// The admissions window
// ---------------------------------------------------------------------------

export type AdmissionsWindow = {
  isOpen: boolean;
  year: { id: string; name: string; applicationClosesAt: Date | null } | null;
};

/**
 * Applications are gated on two switches that must BOTH be on: the site-wide
 * `admissions.isOpen` setting, and the active academic year accepting
 * applications — plus that year's optional opening and closing dates.
 * Either switch can be turned off independently: closing the intake for one
 * year should not require changing a global setting.
 */
export async function getAdmissionsWindow(): Promise<AdmissionsWindow> {
  const [settings, year] = await Promise.all([
    getSiteSettings(),
    db.academicYear.findFirst({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        isAcceptingApplications: true,
        applicationOpensAt: true,
        applicationClosesAt: true,
      },
    }),
  ]);

  if (!year) return { isOpen: false, year: null };

  const now = Date.now();
  let isOpen = readBooleanSetting(settings, "admissions.isOpen") && year.isAcceptingApplications;
  if (isOpen && year.applicationOpensAt && year.applicationOpensAt.getTime() > now) isOpen = false;
  if (isOpen && year.applicationClosesAt && year.applicationClosesAt.getTime() < now) isOpen = false;

  return {
    isOpen,
    year: { id: year.id, name: year.name, applicationClosesAt: year.applicationClosesAt },
  };
}

// ---------------------------------------------------------------------------
// Configuration the form is built from
// ---------------------------------------------------------------------------

export type ClassOption = { id: string; name: string; level: StudyLevel };

export type DocumentTypeConfig = {
  id: string;
  name: string;
  description: string | null;
  level: StudyLevel;
  isRequired: boolean;
  acceptedMimeTypes: string[];
  maxSizeBytes: number;
};

export type ApplicationConfig = {
  classes: ClassOption[];
  documentTypes: DocumentTypeConfig[];
  fields: FormFieldDefinition[];
};

export async function getApplicationConfig(): Promise<ApplicationConfig> {
  const [classes, documentTypes, fields] = await Promise.all([
    db.applicationClass.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      select: { id: true, name: true, level: true },
    }),
    db.documentType.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        level: true,
        isRequired: true,
        acceptedMimeTypes: true,
        maxSizeBytes: true,
      },
    }),
    db.applicationFormField.findMany({
      where: { isActive: true },
      orderBy: [{ step: "asc" }, { order: "asc" }],
      select: {
        id: true,
        key: true,
        label: true,
        helpText: true,
        fieldType: true,
        options: true,
        isRequired: true,
        step: true,
      },
    }),
  ]);

  return {
    classes,
    documentTypes: documentTypes.map((type) => ({
      ...type,
      maxSizeBytes: Math.min(type.maxSizeBytes, MAX_DOCUMENT_BYTES),
    })),
    fields: fields.map((field) => ({ ...field, options: parseFieldOptions(field.options) })),
  };
}

/** Document types that apply to the level being applied for. */
export function documentTypesFor(
  config: ApplicationConfig,
  level: StudyLevel | null,
): DocumentTypeConfig[] {
  return config.documentTypes.filter(
    (type) => type.level === StudyLevel.BOTH || level === null || type.level === level,
  );
}

/**
 * Extra questions belong to the step an administrator assigned them to.
 * Questions assigned to the documents or review steps are folded into the
 * "additional" step: those two screens are not question forms.
 */
export function fieldsForStep(
  config: ApplicationConfig,
  step: ApplicationStep,
): FormFieldDefinition[] {
  if (step === ApplicationStep.ADDITIONAL) {
    return config.fields.filter(
      (field) =>
        field.step === ApplicationStep.ADDITIONAL ||
        field.step === ApplicationStep.DOCUMENTS ||
        field.step === ApplicationStep.REVIEW,
    );
  }
  return config.fields.filter((field) => field.step === step);
}

/** The steps this application actually shows, in order. */
export function visibleSteps(
  config: ApplicationConfig,
  application: { applicationClass: { level: StudyLevel } | null },
): StepDefinition[] {
  const level = application.applicationClass?.level ?? null;
  return APPLY_STEPS.filter((entry) => {
    if (entry.step === ApplicationStep.ADDITIONAL) {
      return fieldsForStep(config, ApplicationStep.ADDITIONAL).length > 0;
    }
    if (entry.step === ApplicationStep.DOCUMENTS) {
      return documentTypesFor(config, level).length > 0;
    }
    return true;
  });
}

/**
 * The furthest visible step the applicant has reached. `currentStep` may name
 * a step that is no longer shown (an administrator removed every extra
 * question), so this walks back to the nearest one that is.
 */
export function furthestStep(
  steps: StepDefinition[],
  currentStep: ApplicationStep,
): StepDefinition {
  const reached = stepOrder(currentStep);
  const candidates = steps.filter((entry) => stepOrder(entry.step) <= reached);
  return candidates[candidates.length - 1] ?? steps[0]!;
}

export function stepAfter(steps: StepDefinition[], step: ApplicationStep): StepDefinition | null {
  const index = steps.findIndex((entry) => entry.step === step);
  return index === -1 ? null : (steps[index + 1] ?? null);
}

export function stepBefore(steps: StepDefinition[], step: ApplicationStep): StepDefinition | null {
  const index = steps.findIndex((entry) => entry.step === step);
  return index <= 0 ? null : (steps[index - 1] ?? null);
}

// ---------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------

const DOCUMENT_SELECT = {
  id: true,
  documentTypeId: true,
  status: true,
  note: true,
  createdAt: true,
  mediaAsset: {
    select: { id: true, originalName: true, size: true, mimeType: true, storageKey: true },
  },
} satisfies Prisma.ApplicationDocumentSelect;

const DRAFT_SELECT = {
  id: true,
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
  lastSavedAt: true,
  academicYear: { select: { id: true, name: true } },
  applicationClass: { select: { id: true, name: true, level: true } },
  documents: { select: DOCUMENT_SELECT, orderBy: { createdAt: "asc" } },
} satisfies Prisma.ApplicationSelect;

export type DraftApplication = Prisma.ApplicationGetPayload<{ select: typeof DRAFT_SELECT }>;
export type ApplicationDocumentRow = DraftApplication["documents"][number];

/** Starts an empty draft. The raw token goes into the applicant's cookie; only its hash is stored. */
export async function createDraft(academicYearId: string): Promise<{ id: string; token: string }> {
  const token = generateToken();
  const draft = await db.application.create({
    data: { academicYearId, draftTokenHash: hashToken(token) },
    select: { id: true },
  });
  return { id: draft.id, token };
}

/** The draft behind a resume token, or null once it has been submitted. */
export async function findDraft(token: string): Promise<DraftApplication | null> {
  if (!token) return null;
  return db.application.findFirst({
    where: { draftTokenHash: hashToken(token), status: ApplicationStatus.DRAFT },
    select: DRAFT_SELECT,
  });
}

/**
 * Writes one step's fields and moves the progress marker forward — never
 * backward, so revisiting an early step does not lock the later ones.
 */
export async function updateDraft(
  application: Pick<DraftApplication, "id" | "currentStep">,
  data: Prisma.ApplicationUpdateInput,
  reached: ApplicationStep,
): Promise<void> {
  const advance = stepOrder(reached) > stepOrder(application.currentStep);
  await db.application.update({
    where: { id: application.id, status: ApplicationStatus.DRAFT },
    data: {
      ...data,
      ...(advance ? { currentStep: reached } : {}),
      lastSavedAt: new Date(),
    },
  });
}

/** Stored answers, as a plain record. The column is JSON and could hold anything. */
export function readAnswers(application: { answers: unknown }): Record<string, AnswerValue> {
  const raw = application.answers;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, AnswerValue>;
}

// ---------------------------------------------------------------------------
// Form values: database row -> what the inputs show
// ---------------------------------------------------------------------------

export type FormValues = Record<string, string>;

export function applicantValues(application: DraftApplication): FormValues {
  return {
    applicationClassId: application.applicationClassId ?? "",
    boardingPreference: application.boardingPreference ?? "",
    firstName: application.firstName ?? "",
    middleName: application.middleName ?? "",
    lastName: application.lastName ?? "",
    dateOfBirth: toIsoDate(application.dateOfBirth),
    gender: application.gender ?? "",
    nationality: application.nationality ?? "",
    homeDistrict: application.homeDistrict ?? "",
    homeAddress: application.homeAddress ?? "",
  };
}

export function guardianValues(application: DraftApplication): FormValues {
  return {
    guardianName: application.guardianName ?? "",
    guardianRelationship: application.guardianRelationship ?? "",
    guardianPhone: application.guardianPhone ?? "",
    guardianAltPhone: application.guardianAltPhone ?? "",
    guardianEmail: application.guardianEmail ?? "",
    guardianOccupation: application.guardianOccupation ?? "",
    guardianAddress: application.guardianAddress ?? "",
  };
}

export function academicValues(application: DraftApplication): FormValues {
  return {
    previousSchool: application.previousSchool ?? "",
    previousClass: application.previousClass ?? "",
    yearCompleted: application.yearCompleted ? String(application.yearCompleted) : "",
    examIndexNumber: application.examIndexNumber ?? "",
    examResults: application.examResults ?? "",
  };
}

/**
 * A stored answer, back in the shape the form would have posted it — so the
 * same schema validates both a fresh submission and a stored one.
 */
export function answerToFormValue(field: FormFieldDefinition, stored: unknown): unknown {
  switch (field.fieldType) {
    case "MULTISELECT":
      return Array.isArray(stored) ? stored.map(String) : [];
    case "CHECKBOX":
      return stored === true;
    default:
      return stored === null || stored === undefined ? "" : String(stored);
  }
}

export function answersToFormValues(
  fields: readonly FormFieldDefinition[],
  answers: Record<string, AnswerValue>,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of fields) {
    values[field.key] = answerToFormValue(field, answers[field.key]);
  }
  return values;
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export type StoreDocumentResult = { ok: true } | { ok: false; message: string };

/** Filenames are shown back to the applicant and to staff, never used on disk. */
function displayName(name: string): string {
  // Control characters have no place in a name that will be rendered, and the
  // path separators go so a display name can never look like a path.
  const cleaned = name.replace(/[\u0000-\u001f\u007f\\/]/g, "").trim();
  return (cleaned || "document").slice(0, 200);
}

/**
 * Validates, sanitises and stores one uploaded document, replacing any earlier
 * upload of the same type. The file is written before the rows are created
 * and removed again if they fail, so storage never ends up with an orphan that
 * the database does not know about — or the reverse.
 */
export async function storeDocument({
  application,
  documentType,
  file,
  actorType = ActorType.APPLICANT,
}: {
  application: { id: string; status: ApplicationStatus };
  documentType: DocumentTypeConfig;
  file: File;
  actorType?: ActorType;
}): Promise<StoreDocumentResult> {
  if (file.size === 0) {
    return { ok: false, message: "Choose a file to upload." };
  }
  if (file.size > documentType.maxSizeBytes) {
    const limitMb = (documentType.maxSizeBytes / (1024 * 1024)).toFixed(0);
    return { ok: false, message: `The file is larger than the ${limitMb} MB limit.` };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const validation = validateUpload({
    buffer,
    allowedMimeTypes: documentType.acceptedMimeTypes,
    maxSizeBytes: documentType.maxSizeBytes,
    declaredMimeType: file.type,
  });
  if (!validation.ok) {
    return { ok: false, message: validation.reason };
  }

  let processed: Awaited<ReturnType<typeof processUploadedDocument>>;
  try {
    processed = await processUploadedDocument(buffer, validation.detected.mimeType);
  } catch {
    return { ok: false, message: "The file could not be read. Try saving it again, or choose a different file." };
  }

  const id = randomUUID();
  const extension = validation.detected.extension;
  const storageKey = buildStorageKey({ folder: "applications", id, extension });

  await storage.put(storageKey, processed.buffer, validation.detected.mimeType);

  let replacedKey: string | null = null;
  try {
    replacedKey = await db.$transaction(async (tx) => {
      const existing = await tx.applicationDocument.findFirst({
        where: { applicationId: application.id, documentTypeId: documentType.id },
        select: { mediaAsset: { select: { id: true, storageKey: true } } },
      });

      const asset = await tx.mediaAsset.create({
        data: {
          storageKey,
          filename: `${id}.${extension}`,
          originalName: displayName(file.name),
          mimeType: validation.detected.mimeType,
          size: processed.buffer.byteLength,
          width: processed.width,
          height: processed.height,
          folder: "applications",
          visibility: MediaVisibility.PRIVATE,
          checksum: checksum(processed.buffer),
        },
        select: { id: true },
      });

      await tx.applicationDocument.create({
        data: {
          applicationId: application.id,
          documentTypeId: documentType.id,
          mediaAssetId: asset.id,
        },
      });

      // Removing the asset cascades to its application_documents row.
      if (existing) {
        await tx.mediaAsset.delete({ where: { id: existing.mediaAsset.id } });
      }

      await tx.application.update({
        where: { id: application.id },
        data: { lastSavedAt: new Date() },
      });

      // Uploads while drafting are not events; the applicant is still filling
      // in the form. After submission they are, because staff asked for them.
      if (application.status !== ApplicationStatus.DRAFT) {
        await tx.applicationEvent.create({
          data: {
            applicationId: application.id,
            action: existing ? "document_replaced" : "document_uploaded",
            actorType,
            newValue: documentType.name,
            isVisibleToApplicant: true,
          },
        });
      }

      return existing?.mediaAsset.storageKey ?? null;
    });
  } catch (error) {
    await storage.delete(storageKey).catch(() => undefined);
    throw error;
  }

  if (replacedKey) {
    await storage.delete(replacedKey).catch(() => undefined);
  }

  return { ok: true };
}

/** Removes a document the applicant uploaded. Only drafts may shed documents. */
export async function removeDraftDocument(
  applicationId: string,
  documentId: string,
): Promise<void> {
  const document = await db.applicationDocument.findFirst({
    where: {
      id: documentId,
      applicationId,
      application: { status: ApplicationStatus.DRAFT },
    },
    select: { mediaAsset: { select: { id: true, storageKey: true } } },
  });
  if (!document) return;

  await db.mediaAsset.delete({ where: { id: document.mediaAsset.id } });
  await storage.delete(document.mediaAsset.storageKey).catch(() => undefined);
}

/**
 * Whether the applicant may upload (or replace) a document of this type on a
 * submitted application. Staff decide what is missing; the applicant can only
 * fill a gap or answer a request for a replacement. A conditional offer keeps
 * uploads open, since "a clearer photograph" is a typical condition; a final
 * acceptance, rejection or withdrawal closes them.
 */
export function canApplicantUpload(
  application: { status: ApplicationStatus },
  existing: { status: DocumentVerificationStatus } | null,
): boolean {
  const openStatuses: ApplicationStatus[] = [
    ApplicationStatus.SUBMITTED,
    ApplicationStatus.UNDER_REVIEW,
    ApplicationStatus.DOCUMENTS_REQUIRED,
    ApplicationStatus.SHORTLISTED,
    ApplicationStatus.CONDITIONALLY_ACCEPTED,
  ];
  if (!openStatuses.includes(application.status)) return false;
  if (!existing) return true;
  return (
    existing.status === DocumentVerificationStatus.REJECTED ||
    existing.status === DocumentVerificationStatus.REPLACEMENT_REQUIRED
  );
}

// ---------------------------------------------------------------------------
// Submission
// ---------------------------------------------------------------------------

export type SubmissionProblem = { step: ApplicationStep; message: string };

/**
 * Every step is re-validated from the stored row, not from anything the
 * client sent with the submit request. A row that passed each step as it was
 * saved can still fail here: an administrator may have added a required
 * question or document since.
 */
export function validateForSubmission(
  application: DraftApplication,
  config: ApplicationConfig,
): SubmissionProblem | null {
  const applicant = applicantSchema.safeParse(applicantValues(application));
  if (!applicant.success) {
    return { step: ApplicationStep.APPLICANT, message: "The applicant's details are incomplete." };
  }
  if (!config.classes.some((entry) => entry.id === applicant.data.applicationClassId)) {
    return {
      step: ApplicationStep.APPLICANT,
      message: "The class applied for is no longer available. Please choose another.",
    };
  }

  if (!guardianSchema.safeParse(guardianValues(application)).success) {
    return { step: ApplicationStep.GUARDIAN, message: "The parent or guardian's details are incomplete." };
  }

  if (!academicSchema.safeParse(academicValues(application)).success) {
    return { step: ApplicationStep.ACADEMIC, message: "The schooling details are incomplete." };
  }

  const answers = readAnswers(application);
  for (const step of [
    ApplicationStep.APPLICANT,
    ApplicationStep.GUARDIAN,
    ApplicationStep.ACADEMIC,
    ApplicationStep.ADDITIONAL,
  ]) {
    const fields = fieldsForStep(config, step);
    if (fields.length === 0) continue;
    const parsed = buildAnswersSchema(fields).safeParse(answersToFormValues(fields, answers));
    if (!parsed.success) {
      return { step, message: "One or more of the school's questions still needs an answer." };
    }
  }

  const level = application.applicationClass?.level ?? null;
  const missing = documentTypesFor(config, level).filter(
    (type) =>
      type.isRequired && !application.documents.some((doc) => doc.documentTypeId === type.id),
  );
  if (missing.length > 0) {
    return {
      step: ApplicationStep.DOCUMENTS,
      message: `Please upload: ${missing.map((type) => type.name).join(", ")}.`,
    };
  }

  return null;
}

export type SubmitResult =
  | { ok: true; id: string; referenceNumber: string; accessToken: string }
  | { ok: false; problem: SubmissionProblem | null; message: string };

/**
 * The next number in a year's sequence, as a formatted reference.
 *
 * One upsert, so two applicants submitting in the same instant get
 * consecutive numbers rather than the same one: the conflicting UPDATE waits
 * for the other transaction's row lock. Must run inside the caller's
 * transaction so the number is rolled back with everything else if the
 * submission fails.
 */
export async function allocateReferenceNumber(
  tx: Prisma.TransactionClient,
  year: number,
): Promise<string> {
  const rows = await tx.$queryRaw<{ lastNumber: number }[]>`
    INSERT INTO "application_counters" ("year", "lastNumber", "updatedAt")
    VALUES (${year}, 1, now())
    ON CONFLICT ("year") DO UPDATE
      SET "lastNumber" = "application_counters"."lastNumber" + 1,
          "updatedAt" = now()
    RETURNING "lastNumber"
  `;
  const sequence = rows[0]?.lastNumber;
  if (!sequence) throw new Error("Reference counter returned no row.");
  return formatReferenceNumber(year, Number(sequence));
}

/**
 * Assigns the reference number, marks the application submitted and issues the
 * portal access token, all in one transaction. The status guard on the update
 * means a double-click cannot submit twice.
 */
export async function submitApplication(
  application: DraftApplication,
  config: ApplicationConfig,
): Promise<SubmitResult> {
  const problem = validateForSubmission(application, config);
  if (problem) {
    return { ok: false, problem, message: problem.message };
  }

  const window = await getAdmissionsWindow();
  if (!window.isOpen || window.year?.id !== application.academicYearId) {
    return {
      ok: false,
      problem: null,
      message:
        "Applications have closed since you started this one. Your answers have been kept; please contact the school office.",
    };
  }

  const accessToken = generateToken();
  const year = new Date().getFullYear();

  let referenceNumber: string;
  try {
    referenceNumber = await db.$transaction(async (tx) => {
      const reference = await allocateReferenceNumber(tx, year);
      const now = new Date();

      const updated = await tx.application.updateMany({
        where: { id: application.id, status: ApplicationStatus.DRAFT },
        data: {
          status: ApplicationStatus.SUBMITTED,
          currentStep: ApplicationStep.REVIEW,
          referenceNumber: reference,
          accessTokenHash: hashToken(accessToken),
          contactEmail: application.guardianEmail,
          contactPhone: application.guardianPhone,
          submittedAt: now,
          lastSavedAt: now,
        },
      });
      if (updated.count !== 1) {
        throw new AlreadySubmittedError();
      }

      await tx.applicationEvent.create({
        data: {
          applicationId: application.id,
          action: "submitted",
          actorType: ActorType.APPLICANT,
          newValue: ApplicationStatus.SUBMITTED,
          isVisibleToApplicant: true,
        },
      });

      return reference;
    });
  } catch (error) {
    if (error instanceof AlreadySubmittedError) {
      return {
        ok: false,
        problem: null,
        message: "This application has already been submitted.",
      };
    }
    throw error;
  }

  // The application is safely submitted. Mail is queued afterwards so an
  // outage at the mail server cannot undo a submission.
  const applicantName = [application.firstName, application.lastName].filter(Boolean).join(" ");
  if (application.guardianEmail) {
    await sendSubmissionConfirmation({
      to: application.guardianEmail,
      toName: application.guardianName,
      applicantName,
      referenceNumber,
      accessToken,
      applicationId: application.id,
    });
  }
  await sendAdminNewApplicationNotice({
    applicantName,
    referenceNumber,
    className: application.applicationClass?.name ?? null,
    applicationId: application.id,
  });

  return { ok: true, id: application.id, referenceNumber, accessToken };
}

class AlreadySubmittedError extends Error {
  constructor() {
    super("Application already submitted");
    this.name = "AlreadySubmittedError";
  }
}

// ---------------------------------------------------------------------------
// Portal
// ---------------------------------------------------------------------------

/**
 * Reference number plus two facts only the family knows. Each is checked in
 * the query, and the surname comparison is case-insensitive because that is
 * how people type their own names.
 */
export async function findSubmittedByLookup(input: LookupInput): Promise<{ id: string } | null> {
  return db.application.findFirst({
    where: {
      referenceNumber: input.referenceNumber,
      status: { not: ApplicationStatus.DRAFT },
      lastName: { equals: input.lastName, mode: "insensitive" },
      dateOfBirth: input.dateOfBirth,
    },
    select: { id: true },
  });
}

export async function findSubmittedByAccessToken(token: string): Promise<{ id: string } | null> {
  if (!token) return null;
  return db.application.findFirst({
    where: { accessTokenHash: hashToken(token), status: { not: ApplicationStatus.DRAFT } },
    select: { id: true },
  });
}

const PORTAL_SELECT = {
  id: true,
  referenceNumber: true,
  status: true,
  firstName: true,
  lastName: true,
  submittedAt: true,
  decisionAt: true,
  academicYear: { select: { name: true } },
  applicationClass: { select: { name: true, level: true } },
  documents: {
    select: {
      ...DOCUMENT_SELECT,
      documentType: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  },
  events: {
    where: { isVisibleToApplicant: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, action: true, newValue: true, note: true, createdAt: true },
  },
  messages: {
    orderBy: { createdAt: "desc" },
    select: { id: true, subject: true, body: true, createdAt: true, readAt: true },
  },
} satisfies Prisma.ApplicationSelect;

export type PortalApplication = Prisma.ApplicationGetPayload<{ select: typeof PORTAL_SELECT }>;

export async function getPortalApplication(id: string): Promise<PortalApplication | null> {
  return db.application.findFirst({
    where: { id, status: { not: ApplicationStatus.DRAFT } },
    select: PORTAL_SELECT,
  });
}

/** Marks every unread message as read now that the applicant has seen the portal. */
export async function markMessagesRead(applicationId: string): Promise<void> {
  await db.applicationMessage.updateMany({
    where: { applicationId, readAt: null },
    data: { readAt: new Date() },
  });
}

/** Plain-language timeline entries for the applicant, built from event rows. */
export function describeEvent(event: {
  action: string;
  newValue: string | null;
  note: string | null;
}): string {
  switch (event.action) {
    case "submitted":
      return "Application submitted.";
    case "status_changed":
      return event.newValue
        ? `Status changed to "${statusLabel(event.newValue)}".`
        : "Status changed.";
    case "note":
      return event.note ?? "Note from the school.";
    case "document_uploaded":
      return event.newValue ? `Uploaded: ${event.newValue}.` : "Document uploaded.";
    case "document_replaced":
      return event.newValue ? `Replaced: ${event.newValue}.` : "Document replaced.";
    case "document_verified":
      return event.newValue ? `${event.newValue} verified.` : "Document verified.";
    case "document_rejected":
      return event.newValue ? `${event.newValue} not accepted.` : "Document not accepted.";
    case "replacement_requested":
      return event.newValue
        ? `Replacement requested: ${event.newValue}.`
        : "Replacement document requested.";
    case "document_reopened":
      return event.newValue
        ? `${event.newValue} put back for review.`
        : "Document put back for review.";
    case "message_sent":
      return "The school sent you a message.";
    default:
      return event.note ?? event.action.replace(/_/g, " ");
  }
}

function statusLabel(value: string): string {
  if (value in APPLICATION_STATUS_COPY) {
    return APPLICATION_STATUS_COPY[value as ApplicationStatus].label;
  }
  return value.toLowerCase().replace(/_/g, " ");
}
