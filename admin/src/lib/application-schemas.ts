import { z } from "zod";

import {
  ApplicationStatus,
  ApplicationStep,
  BoardingPreference,
  DocumentVerificationStatus,
  FormFieldType,
  Gender,
  StudyLevel,
} from "@/generated/prisma/enums";

/**
 * Application form: the shape of each step and the words on the screen.
 *
 * Deliberately free of `server-only` so client components can share the
 * labels and the step list. Nothing here touches the database.
 */

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

export type StepDefinition = {
  step: ApplicationStep;
  slug: string;
  title: string;
  /** One line under the title, in the applicant's terms. */
  description: string;
};

/** Canonical order. Which of these a given application actually shows is decided in `applications.ts`. */
export const APPLY_STEPS: readonly StepDefinition[] = [
  {
    step: ApplicationStep.APPLICANT,
    slug: "applicant",
    title: "The applicant",
    description: "Who is applying, and for which class.",
  },
  {
    step: ApplicationStep.GUARDIAN,
    slug: "guardian",
    title: "Parent or guardian",
    description: "Who we should contact about this application.",
  },
  {
    step: ApplicationStep.ACADEMIC,
    slug: "academic",
    title: "Schooling so far",
    description: "The applicant's current or most recent school.",
  },
  {
    step: ApplicationStep.ADDITIONAL,
    slug: "additional",
    title: "A few more questions",
    description: "Questions the school has asked every applicant to answer.",
  },
  {
    step: ApplicationStep.DOCUMENTS,
    slug: "documents",
    title: "Documents",
    description: "Upload the papers that support the application.",
  },
  {
    step: ApplicationStep.REVIEW,
    slug: "review",
    title: "Review and submit",
    description: "Check everything, then send the application to the school.",
  },
] as const;

export function stepFromSlug(slug: string): StepDefinition | null {
  return APPLY_STEPS.find((entry) => entry.slug === slug) ?? null;
}

export function stepDefinition(step: ApplicationStep): StepDefinition {
  const found = APPLY_STEPS.find((entry) => entry.step === step);
  if (!found) throw new Error(`Unknown application step: ${step}`);
  return found;
}

/** Position in the canonical order, for "has the applicant got this far yet". */
export function stepOrder(step: ApplicationStep): number {
  return APPLY_STEPS.findIndex((entry) => entry.step === step);
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export const GENDER_LABELS: Record<Gender, string> = {
  [Gender.MALE]: "Male",
  [Gender.FEMALE]: "Female",
};

export const BOARDING_LABELS: Record<BoardingPreference, string> = {
  [BoardingPreference.BOARDING]: "Boarding",
  [BoardingPreference.DAY]: "Day",
  [BoardingPreference.UNDECIDED]: "Not yet decided",
};

export const LEVEL_LABELS: Record<StudyLevel, string> = {
  [StudyLevel.O_LEVEL]: "O-level",
  [StudyLevel.A_LEVEL]: "A-level",
  [StudyLevel.BOTH]: "All levels",
};

/** Offered as a select so the admissions office gets consistent values to sort by. */
export const RELATIONSHIP_OPTIONS = [
  "Mother",
  "Father",
  "Guardian",
  "Grandparent",
  "Aunt or uncle",
  "Older sibling",
  "Sponsor",
  "Other",
] as const;

export type ApplicantStatusCopy = {
  label: string;
  /** What it means for the applicant, in plain words. */
  explanation: string;
  tone: "neutral" | "info" | "warning" | "success" | "danger";
};

export const APPLICATION_STATUS_COPY: Record<ApplicationStatus, ApplicantStatusCopy> = {
  [ApplicationStatus.DRAFT]: {
    label: "Not yet submitted",
    explanation: "This application has been started but not sent to the school.",
    tone: "neutral",
  },
  [ApplicationStatus.SUBMITTED]: {
    label: "Submitted",
    explanation:
      "The school has received the application. It is waiting for the admissions office to look at it.",
    tone: "info",
  },
  [ApplicationStatus.UNDER_REVIEW]: {
    label: "Under review",
    explanation: "The admissions office is reviewing the application.",
    tone: "info",
  },
  [ApplicationStatus.DOCUMENTS_REQUIRED]: {
    label: "Documents needed",
    explanation:
      "The school needs one or more documents before it can go further. See the documents section below.",
    tone: "warning",
  },
  [ApplicationStatus.SHORTLISTED]: {
    label: "Shortlisted",
    explanation:
      "The application has been shortlisted. The school will be in touch about what happens next.",
    tone: "success",
  },
  [ApplicationStatus.ACCEPTED]: {
    label: "Accepted",
    explanation: "Congratulations — the applicant has been offered a place.",
    tone: "success",
  },
  [ApplicationStatus.CONDITIONALLY_ACCEPTED]: {
    label: "Accepted with conditions",
    explanation:
      "A place has been offered subject to conditions. The school will explain what they are.",
    tone: "success",
  },
  [ApplicationStatus.REJECTED]: {
    label: "Not successful",
    explanation: "We are sorry — the application was not successful on this occasion.",
    tone: "danger",
  },
  [ApplicationStatus.WITHDRAWN]: {
    label: "Withdrawn",
    explanation: "This application has been withdrawn.",
    tone: "neutral",
  },
};

export const DOCUMENT_STATUS_COPY: Record<
  DocumentVerificationStatus,
  { label: string; tone: "neutral" | "info" | "warning" | "success" | "danger" }
> = {
  [DocumentVerificationStatus.PENDING]: { label: "Awaiting review", tone: "neutral" },
  [DocumentVerificationStatus.VERIFIED]: { label: "Verified", tone: "success" },
  [DocumentVerificationStatus.REJECTED]: { label: "Not accepted", tone: "danger" },
  [DocumentVerificationStatus.REPLACEMENT_REQUIRED]: {
    label: "Replacement needed",
    tone: "warning",
  },
};

// ---------------------------------------------------------------------------
// Reference numbers
// ---------------------------------------------------------------------------

export const REFERENCE_PREFIX = "BASS";

/** BASS-2026-000123 */
export function formatReferenceNumber(year: number, sequence: number): string {
  return `${REFERENCE_PREFIX}-${year}-${String(sequence).padStart(6, "0")}`;
}

/**
 * Tolerates the ways people actually type a reference back to us: spaces,
 * slashes, long dashes, or no separators at all.
 */
export function normaliseReferenceNumber(input: string): string {
  const compact = input.trim().toUpperCase().replace(/[\s\-–—_/]+/g, "");
  const match = compact.match(/^([A-Z]+)(\d{4})(\d{6})$/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : compact;
}

export const REFERENCE_PATTERN = new RegExp(`^${REFERENCE_PREFIX}-\\d{4}-\\d{6}$`);

// ---------------------------------------------------------------------------
// Field primitives
// ---------------------------------------------------------------------------

/** Form fields always arrive as strings; an empty one means "not answered". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .transform((value) => (value === "" ? null : value));

const requiredText = (message: string, max: number, min = 2) =>
  z.string().trim().min(min, message).max(max, `Keep this under ${max} characters.`);

const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{6,29}$/;

const phone = (message: string) =>
  z.string().trim().regex(PHONE_PATTERN, message);

const optionalPhone = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .refine((value) => value === null || PHONE_PATTERN.test(value), {
    message: "Enter a valid telephone number.",
  });

const optionalEmail = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .refine((value) => value === null || z.email().safeParse(value).success, {
    message: "Enter a valid email address.",
  });

/** "YYYY-MM-DD" from a date input, into a UTC-midnight Date. */
export function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  // Reject 2026-02-31 and friends, which the Date constructor silently rolls over.
  if (date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

export function toIsoDate(date: Date | null | undefined): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

const dateOfBirth = z
  .string()
  .trim()
  .min(1, "Enter the applicant's date of birth.")
  .transform((value, ctx) => {
    const date = parseIsoDate(value);
    if (!date) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date." });
      return z.NEVER;
    }
    return date;
  })
  .refine((date) => date.getTime() < Date.now(), {
    message: "The date of birth must be in the past.",
  })
  .refine(
    (date) => {
      // Secondary-school applicants: generous bounds that still catch a typo
      // in the year, which is by far the most common mistake.
      const years = (Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      return years >= 6 && years <= 60;
    },
    { message: "Check the year of birth." },
  );

// ---------------------------------------------------------------------------
// Step schemas
// ---------------------------------------------------------------------------

export const applicantSchema = z.object({
  applicationClassId: z.string().trim().min(1, "Choose the class you are applying for."),
  boardingPreference: z.enum(BoardingPreference, {
    error: "Choose day or boarding, or say you have not decided.",
  }),
  firstName: requiredText("Enter the applicant's first name.", 80),
  middleName: optionalText(80),
  lastName: requiredText("Enter the applicant's surname.", 80),
  dateOfBirth,
  gender: z.enum(Gender, { error: "Choose an option." }),
  nationality: requiredText("Enter the applicant's nationality.", 80),
  homeDistrict: optionalText(80),
  homeAddress: optionalText(300),
});

export type ApplicantInput = z.infer<typeof applicantSchema>;

export const guardianSchema = z.object({
  guardianName: requiredText("Enter the parent or guardian's full name.", 120),
  guardianRelationship: z.enum(RELATIONSHIP_OPTIONS, {
    error: "Choose the relationship to the applicant.",
  }),
  guardianPhone: phone("Enter a telephone number we can reach you on."),
  guardianAltPhone: optionalPhone,
  guardianEmail: optionalEmail,
  guardianOccupation: optionalText(120),
  guardianAddress: optionalText(300),
});

export type GuardianInput = z.infer<typeof guardianSchema>;

const CURRENT_YEAR = new Date().getFullYear();

export const academicSchema = z.object({
  previousSchool: requiredText("Enter the name of the current or most recent school.", 160),
  previousClass: requiredText("Enter the class completed or being completed.", 60, 1),
  yearCompleted: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : Number(value)))
    .refine(
      (value) =>
        value === null ||
        (Number.isInteger(value) && value >= 1990 && value <= CURRENT_YEAR + 1),
      { message: "Enter a four-digit year." },
    ),
  examIndexNumber: optionalText(40),
  examResults: optionalText(2000),
});

export type AcademicInput = z.infer<typeof academicSchema>;

export const declarationSchema = z.object({
  declaration: z.literal("on", {
    error: "Please confirm the declaration before submitting.",
  }),
});

export const lookupSchema = z.object({
  referenceNumber: z
    .string()
    .trim()
    .min(1, "Enter the application reference.")
    .transform(normaliseReferenceNumber)
    .refine((value) => REFERENCE_PATTERN.test(value), {
      message: "The reference looks like BASS-2026-000123.",
    }),
  lastName: requiredText("Enter the applicant's surname.", 80),
  dateOfBirth,
});

export type LookupInput = z.infer<typeof lookupSchema>;

// ---------------------------------------------------------------------------
// Admin-configured questions
// ---------------------------------------------------------------------------

export type FieldOption = { value: string; label: string };

export type FormFieldDefinition = {
  id: string;
  key: string;
  label: string;
  helpText: string | null;
  fieldType: FormFieldType;
  options: FieldOption[];
  isRequired: boolean;
  step: ApplicationStep;
};

/** What an answer can be once validated. Stored as JSON on the application. */
export type AnswerValue = string | number | boolean | string[] | null;

/**
 * Options are stored as JSON and may have been entered as either plain strings
 * or {value,label} objects. Anything else is ignored rather than crashing the
 * form for every applicant.
 */
export function parseFieldOptions(raw: unknown): FieldOption[] {
  if (!Array.isArray(raw)) return [];

  const options: FieldOption[] = [];
  for (const entry of raw) {
    if (typeof entry === "string") {
      const value = entry.trim();
      if (value) options.push({ value, label: value });
    } else if (entry && typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      const value = typeof record.value === "string" ? record.value.trim() : "";
      const label =
        typeof record.label === "string" && record.label.trim() ? record.label.trim() : value;
      if (value) options.push({ value, label });
    }
  }
  return options;
}

const HAS_OPTIONS: readonly FormFieldType[] = [
  FormFieldType.SELECT,
  FormFieldType.MULTISELECT,
  FormFieldType.RADIO,
];

export function fieldHasOptions(type: FormFieldType): boolean {
  return HAS_OPTIONS.includes(type);
}

/** Pulls a field's raw answer out of a submitted form, in the shape its schema expects. */
export function readAnswerFromForm(formData: FormData, field: FormFieldDefinition): unknown {
  const name = `answer:${field.key}`;
  switch (field.fieldType) {
    case FormFieldType.MULTISELECT:
      return formData.getAll(name).map(String);
    case FormFieldType.CHECKBOX:
      return formData.get(name) === "on";
    default:
      return String(formData.get(name) ?? "");
  }
}

function answerSchema(field: FormFieldDefinition): z.ZodType<AnswerValue> {
  const required = field.isRequired;
  const missing = "This question needs an answer.";
  const optionValues = field.options.map((option) => option.value);
  const mustBeOption = "Choose one of the options.";

  switch (field.fieldType) {
    case FormFieldType.CHECKBOX:
      return required
        ? z.boolean().refine((value) => value === true, { message: "Please tick this box." })
        : z.boolean();

    case FormFieldType.MULTISELECT: {
      const base = z
        .array(z.string())
        .refine((values) => values.every((value) => optionValues.includes(value)), {
          message: mustBeOption,
        });
      return required ? base.min(1, "Choose at least one option.") : base;
    }

    case FormFieldType.SELECT:
    case FormFieldType.RADIO: {
      const base = z.string().trim();
      if (required) {
        return base
          .min(1, missing)
          .refine((value) => optionValues.includes(value), { message: mustBeOption });
      }
      return base
        .refine((value) => value === "" || optionValues.includes(value), {
          message: mustBeOption,
        })
        .transform((value) => (value === "" ? null : value));
    }

    case FormFieldType.NUMBER: {
      return z
        .string()
        .trim()
        .transform((value, ctx) => {
          if (value === "") {
            if (required) ctx.addIssue({ code: "custom", message: missing });
            return null;
          }
          const number = Number(value);
          if (!Number.isFinite(number)) {
            ctx.addIssue({ code: "custom", message: "Enter a number." });
            return z.NEVER;
          }
          return number;
        });
    }

    case FormFieldType.DATE: {
      return z
        .string()
        .trim()
        .transform((value, ctx) => {
          if (value === "") {
            if (required) ctx.addIssue({ code: "custom", message: missing });
            return null;
          }
          if (!parseIsoDate(value)) {
            ctx.addIssue({ code: "custom", message: "Enter a valid date." });
            return z.NEVER;
          }
          return value;
        });
    }

    case FormFieldType.EMAIL: {
      return z
        .string()
        .trim()
        .transform((value, ctx) => {
          if (value === "") {
            if (required) ctx.addIssue({ code: "custom", message: missing });
            return null;
          }
          if (!z.email().safeParse(value).success) {
            ctx.addIssue({ code: "custom", message: "Enter a valid email address." });
            return z.NEVER;
          }
          return value;
        });
    }

    case FormFieldType.PHONE: {
      return z
        .string()
        .trim()
        .transform((value, ctx) => {
          if (value === "") {
            if (required) ctx.addIssue({ code: "custom", message: missing });
            return null;
          }
          if (!PHONE_PATTERN.test(value)) {
            ctx.addIssue({ code: "custom", message: "Enter a valid telephone number." });
            return z.NEVER;
          }
          return value;
        });
    }

    case FormFieldType.TEXTAREA:
    case FormFieldType.TEXT:
    default: {
      const max = field.fieldType === FormFieldType.TEXTAREA ? 4000 : 500;
      return z
        .string()
        .trim()
        .max(max, `Keep this under ${max} characters.`)
        .transform((value, ctx) => {
          if (value === "") {
            if (required) ctx.addIssue({ code: "custom", message: missing });
            return null;
          }
          return value;
        });
    }
  }
}

/** One schema covering every question on a step, keyed by field key. */
export function buildAnswersSchema(fields: readonly FormFieldDefinition[]) {
  const shape: Record<string, z.ZodType<AnswerValue>> = {};
  for (const field of fields) {
    shape[field.key] = answerSchema(field);
  }
  return z.object(shape);
}

/** Renders a stored answer for the review page and the admin view. */
export function formatAnswer(field: FormFieldDefinition, value: unknown): string {
  if (value === null || value === undefined || value === "") return "";

  if (field.fieldType === FormFieldType.CHECKBOX) {
    return value === true ? "Yes" : "No";
  }

  const labelFor = (raw: string) =>
    field.options.find((option) => option.value === raw)?.label ?? raw;

  if (Array.isArray(value)) {
    return value.map((entry) => labelFor(String(entry))).join(", ");
  }

  if (fieldHasOptions(field.fieldType)) {
    return labelFor(String(value));
  }

  return String(value);
}
