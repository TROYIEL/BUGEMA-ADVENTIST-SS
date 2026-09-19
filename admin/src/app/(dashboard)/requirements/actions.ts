"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/dal";
import { ApplicationStep, ContentStatus, FormFieldType, StudyLevel } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import {
  DOCUMENT_FORMATS,
  deleteClass,
  deleteDocumentType,
  deleteFormField,
  deleteRequirement,
  keyFromLabel,
  moveOrdered,
  parseOptionsText,
  saveClass,
  saveDocumentType,
  saveFormField,
  saveRequirement,
} from "@/lib/admissions-config";
import { MAX_DOCUMENT_BYTES } from "@/lib/applications";
import { recordAudit } from "@/lib/audit";

/**
 * Staff actions on the admissions configuration. The public wizard reads all
 * of this live, so every action revalidates the page and the applicant
 * simply sees the next version on their next step.
 */

export type ConfigState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Echoed back on a rejected save: React resets a form after any action. */
  values?: Record<string, string | boolean | string[]>;
};

const OK: ConfigState = { status: "idle" };

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function flag(formData: FormData, name: string): boolean {
  return formData.get(name) === "on";
}

function firstIssues(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !(key in errors)) errors[key] = issue.message;
  }
  return errors;
}

function refresh() {
  revalidatePath("/requirements");
}

const optional = (max: number) =>
  z.string().trim().max(max, `Keep this under ${max} characters.`).transform((v) => (v === "" ? null : v));

async function audit(userId: string, action: "created" | "updated" | "deleted", entityType: string, entityId: string, note: string) {
  await recordAudit({ actorUserId: userId, action, entityType, entityId, note });
}

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------

const classSchema = z.object({
  name: z.string().trim().min(1, "Give the class a name.").max(60),
  level: z.enum(StudyLevel, { error: "Choose a level." }),
  isActive: z.boolean(),
});

export async function saveClassAction(
  id: string | null,
  _previous: ConfigState,
  formData: FormData,
): Promise<ConfigState> {
  const user = await requirePermission("admissions:configure");
  const values = { name: text(formData, "name"), level: text(formData, "level"), isActive: flag(formData, "isActive") };
  const parsed = classSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: firstIssues(parsed.error), values };

  const clash = await db.applicationClass.findFirst({
    where: { name: parsed.data.name, NOT: id ? { id } : undefined },
    select: { id: true },
  });
  if (clash) return { status: "error", fieldErrors: { name: "A class with this name already exists." }, values };

  const saved = await saveClass(id, parsed.data);
  await audit(user.id, id ? "updated" : "created", "application_class", saved.id, parsed.data.name);
  refresh();
  return OK;
}

export async function deleteClassAction(formData: FormData): Promise<void> {
  const user = await requirePermission("admissions:configure");
  const id = text(formData, "id");
  const result = await deleteClass(id);
  if (result.ok) await audit(user.id, "deleted", "application_class", id, "");
  refresh();
}

// ---------------------------------------------------------------------------
// Document types
// ---------------------------------------------------------------------------

const documentTypeSchema = z.object({
  name: z.string().trim().min(2, "Give the document a name.").max(80),
  description: optional(300),
  level: z.enum(StudyLevel, { error: "Choose a level." }),
  isRequired: z.boolean(),
  acceptedMimeTypes: z
    .array(z.enum(DOCUMENT_FORMATS.map((f) => f.value) as [string, ...string[]]))
    .min(1, "Accept at least one format."),
  maxSizeMb: z
    .string()
    .trim()
    .transform((value, ctx) => {
      const number = Number(value);
      if (!Number.isFinite(number) || number < 1 || number > MAX_DOCUMENT_BYTES / (1024 * 1024)) {
        ctx.addIssue({ code: "custom", message: `Between 1 and ${MAX_DOCUMENT_BYTES / (1024 * 1024)} MB.` });
        return z.NEVER;
      }
      return number;
    }),
  isActive: z.boolean(),
});

export async function saveDocumentTypeAction(
  id: string | null,
  _previous: ConfigState,
  formData: FormData,
): Promise<ConfigState> {
  const user = await requirePermission("admissions:configure");
  const values = {
    name: text(formData, "name"),
    description: text(formData, "description"),
    level: text(formData, "level"),
    isRequired: flag(formData, "isRequired"),
    acceptedMimeTypes: formData.getAll("acceptedMimeTypes").map(String),
    maxSizeMb: text(formData, "maxSizeMb") || "5",
    isActive: flag(formData, "isActive"),
  };
  const parsed = documentTypeSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: firstIssues(parsed.error), values };

  const clash = await db.documentType.findFirst({
    where: { name: parsed.data.name, NOT: id ? { id } : undefined },
    select: { id: true },
  });
  if (clash) return { status: "error", fieldErrors: { name: "A document type with this name already exists." }, values };

  const { maxSizeMb, ...rest } = parsed.data;
  const saved = await saveDocumentType(id, { ...rest, maxSizeBytes: Math.round(maxSizeMb * 1024 * 1024) });
  await audit(user.id, id ? "updated" : "created", "document_type", saved.id, parsed.data.name);
  refresh();
  return OK;
}

export async function deleteDocumentTypeAction(formData: FormData): Promise<void> {
  const user = await requirePermission("admissions:configure");
  const id = text(formData, "id");
  const result = await deleteDocumentType(id);
  if (result.ok) await audit(user.id, "deleted", "document_type", id, "");
  refresh();
}

// ---------------------------------------------------------------------------
// Entry requirements
// ---------------------------------------------------------------------------

const requirementSchema = z.object({
  title: z.string().trim().min(2, "Give the requirement a title.").max(160),
  description: optional(1000),
  level: z.enum(StudyLevel, { error: "Choose a level." }),
  status: z.enum(ContentStatus, { error: "Choose whether it is published." }),
});

export async function saveRequirementAction(
  id: string | null,
  _previous: ConfigState,
  formData: FormData,
): Promise<ConfigState> {
  const user = await requirePermission("admissions:configure");
  const values = {
    title: text(formData, "title"),
    description: text(formData, "description"),
    level: text(formData, "level"),
    status: text(formData, "status") || ContentStatus.DRAFT,
  };
  const parsed = requirementSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: firstIssues(parsed.error), values };

  const saved = await saveRequirement(id, parsed.data);
  await audit(user.id, id ? "updated" : "created", "admission_requirement", saved.id, parsed.data.title);
  refresh();
  return OK;
}

export async function deleteRequirementAction(formData: FormData): Promise<void> {
  const user = await requirePermission("admissions:configure");
  const id = text(formData, "id");
  await deleteRequirement(id);
  await audit(user.id, "deleted", "admission_requirement", id, "");
  refresh();
}

// ---------------------------------------------------------------------------
// Extra questions
// ---------------------------------------------------------------------------

const NEEDS_OPTIONS: FormFieldType[] = [
  FormFieldType.SELECT,
  FormFieldType.RADIO,
  FormFieldType.MULTISELECT,
];

const fieldSchema = z
  .object({
    step: z.enum(ApplicationStep, { error: "Choose where the question appears." }),
    key: z
      .string()
      .trim()
      .regex(/^[a-z0-9_]{2,60}$/, "Lowercase letters, digits and underscores only."),
    label: z.string().trim().min(2, "Write the question.").max(200),
    helpText: optional(300),
    fieldType: z.enum(FormFieldType, { error: "Choose an answer type." }),
    optionsText: z.string(),
    isRequired: z.boolean(),
    isActive: z.boolean(),
  })
  .refine(
    (data) => !NEEDS_OPTIONS.includes(data.fieldType) || parseOptionsText(data.optionsText).length >= 2,
    { message: "Give at least two options, one per line.", path: ["optionsText"] },
  );

export async function saveFormFieldAction(
  id: string | null,
  _previous: ConfigState,
  formData: FormData,
): Promise<ConfigState> {
  const user = await requirePermission("admissions:configure");
  const label = text(formData, "label");
  const values = {
    step: text(formData, "step"),
    key: text(formData, "key") || keyFromLabel(label),
    label,
    helpText: text(formData, "helpText"),
    fieldType: text(formData, "fieldType"),
    optionsText: text(formData, "optionsText"),
    isRequired: flag(formData, "isRequired"),
    isActive: flag(formData, "isActive"),
  };
  const parsed = fieldSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: firstIssues(parsed.error), values };

  const { optionsText, ...rest } = parsed.data;
  const result = await saveFormField(id, {
    ...rest,
    options: NEEDS_OPTIONS.includes(rest.fieldType) ? parseOptionsText(optionsText) : [],
  });
  if ("error" in result) return { status: "error", fieldErrors: { key: result.error }, values };

  await audit(user.id, id ? "updated" : "created", "application_form_field", result.id, parsed.data.label);
  refresh();
  return OK;
}

export async function deleteFormFieldAction(formData: FormData): Promise<void> {
  const user = await requirePermission("admissions:configure");
  const id = text(formData, "id");
  await deleteFormField(id);
  await audit(user.id, "deleted", "application_form_field", id, "");
  refresh();
}

// ---------------------------------------------------------------------------
// Ordering, shared
// ---------------------------------------------------------------------------

const MODELS = {
  class: "applicationClass",
  documentType: "documentType",
  requirement: "admissionRequirement",
  field: "applicationFormField",
} as const;

export async function moveAction(formData: FormData): Promise<void> {
  await requirePermission("admissions:configure");
  const kind = text(formData, "kind") as keyof typeof MODELS;
  const direction = text(formData, "direction");
  if (!(kind in MODELS) || (direction !== "up" && direction !== "down")) return;
  await moveOrdered(MODELS[kind], text(formData, "id"), direction);
  refresh();
}
