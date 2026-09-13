import "server-only";

import { ContentStatus, StudyLevel, type ApplicationStep, type FormFieldType } from "@bass/db/enums";
import type { Prisma } from "@bass/db/types";
import { db } from "@bass/db";

import { MAX_DOCUMENT_BYTES } from "./applications";
import { parseFieldOptions, type FieldOption } from "./application-schemas";

export * from "./admissions-config-shared";

/**
 * What the admissions office configures: the academic years applications
 * are taken for, the classes that can be applied to, the documents asked
 * for, the published entry requirements and the extra questions on the form.
 *
 * Every change here is read live by the public wizard and the requirements
 * page, so the rules about what can be removed are conservative: anything an
 * application already refers to is switched off rather than deleted.
 */

// ---------------------------------------------------------------------------
// Academic years
// ---------------------------------------------------------------------------

const YEAR_SELECT = {
  id: true,
  name: true,
  startDate: true,
  endDate: true,
  isActive: true,
  isAcceptingApplications: true,
  applicationOpensAt: true,
  applicationClosesAt: true,
  _count: { select: { applications: true } },
} satisfies Prisma.AcademicYearSelect;

export type AcademicYearRow = Prisma.AcademicYearGetPayload<{ select: typeof YEAR_SELECT }>;

export async function listAcademicYears(): Promise<AcademicYearRow[]> {
  return db.academicYear.findMany({ orderBy: { name: "desc" }, select: YEAR_SELECT });
}

export type AcademicYearInput = {
  name: string;
  startDate: Date | null;
  endDate: Date | null;
  isAcceptingApplications: boolean;
  applicationOpensAt: Date | null;
  applicationClosesAt: Date | null;
};

export async function saveAcademicYear(
  id: string | null,
  input: AcademicYearInput,
): Promise<{ id: string }> {
  if (id) {
    await db.academicYear.update({ where: { id }, data: input });
    return { id };
  }
  return db.academicYear.create({ data: input, select: { id: true } });
}

/** Exactly one year is active: the one the wizard files applications under. */
export async function setActiveAcademicYear(id: string): Promise<void> {
  await db.$transaction([
    db.academicYear.updateMany({ where: { isActive: true }, data: { isActive: false } }),
    db.academicYear.update({ where: { id }, data: { isActive: true } }),
  ]);
}

/** A year with applications is history, not clutter; it stays. */
export async function deleteAcademicYear(id: string): Promise<{ ok: boolean; reason?: string }> {
  const year = await db.academicYear.findUnique({
    where: { id },
    select: { isActive: true, _count: { select: { applications: true } } },
  });
  if (!year) return { ok: true };
  if (year._count.applications > 0) {
    return { ok: false, reason: "This year has applications, so it cannot be deleted." };
  }
  if (year.isActive) {
    return { ok: false, reason: "Make another year active first." };
  }
  await db.academicYear.delete({ where: { id } });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Ordered lists share one reorder routine
// ---------------------------------------------------------------------------

type OrderedModel = "applicationClass" | "documentType" | "admissionRequirement" | "applicationFormField";

async function orderedIds(model: OrderedModel): Promise<string[]> {
  const orderBy = [{ order: "asc" as const }, { createdAt: "asc" as const }];
  switch (model) {
    case "applicationClass":
      // Classes have no createdAt; the id (cuid) is time-ordered enough.
      return (await db.applicationClass.findMany({ orderBy: [{ order: "asc" }, { id: "asc" }], select: { id: true } })).map((r) => r.id);
    case "documentType":
      return (await db.documentType.findMany({ orderBy, select: { id: true } })).map((r) => r.id);
    case "admissionRequirement":
      return (await db.admissionRequirement.findMany({ orderBy, select: { id: true } })).map((r) => r.id);
    case "applicationFormField":
      return (await db.applicationFormField.findMany({ orderBy, select: { id: true } })).map((r) => r.id);
  }
}

async function writeOrder(model: OrderedModel, ids: string[]): Promise<void> {
  const updates = ids.map((id, index) => {
    const data = { order: (index + 1) * 10 };
    switch (model) {
      case "applicationClass":
        return db.applicationClass.update({ where: { id }, data });
      case "documentType":
        return db.documentType.update({ where: { id }, data });
      case "admissionRequirement":
        return db.admissionRequirement.update({ where: { id }, data });
      case "applicationFormField":
        return db.applicationFormField.update({ where: { id }, data });
    }
  });
  await db.$transaction(updates);
}

/** Swaps a row with its neighbour after renumbering, so ties never stick. */
export async function moveOrdered(
  model: OrderedModel,
  id: string,
  direction: "up" | "down",
): Promise<void> {
  const ids = await orderedIds(model);
  const index = ids.indexOf(id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= ids.length) return;
  [ids[index], ids[target]] = [ids[target]!, ids[index]!];
  await writeOrder(model, ids);
}

async function nextOrder(model: OrderedModel): Promise<number> {
  const ids = await orderedIds(model);
  return (ids.length + 1) * 10;
}

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------

const CLASS_SELECT = {
  id: true,
  name: true,
  level: true,
  order: true,
  isActive: true,
  _count: { select: { applications: true } },
} satisfies Prisma.ApplicationClassSelect;

export type ClassRow = Prisma.ApplicationClassGetPayload<{ select: typeof CLASS_SELECT }>;

export async function listClasses(): Promise<ClassRow[]> {
  return db.applicationClass.findMany({ orderBy: [{ order: "asc" }, { id: "asc" }], select: CLASS_SELECT });
}

export type ClassInput = { name: string; level: StudyLevel; isActive: boolean };

export async function saveClass(id: string | null, input: ClassInput): Promise<{ id: string }> {
  if (id) {
    await db.applicationClass.update({ where: { id }, data: input });
    return { id };
  }
  return db.applicationClass.create({
    data: { ...input, order: await nextOrder("applicationClass") },
    select: { id: true },
  });
}

export async function deleteClass(id: string): Promise<{ ok: boolean; reason?: string }> {
  const row = await db.applicationClass.findUnique({
    where: { id },
    select: { _count: { select: { applications: true } } },
  });
  if (!row) return { ok: true };
  if (row._count.applications > 0) {
    return { ok: false, reason: "Applications refer to this class. Switch it off instead." };
  }
  await db.applicationClass.delete({ where: { id } });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Document types
// ---------------------------------------------------------------------------

const DOCUMENT_TYPE_SELECT = {
  id: true,
  name: true,
  description: true,
  level: true,
  isRequired: true,
  acceptedMimeTypes: true,
  maxSizeBytes: true,
  order: true,
  isActive: true,
  _count: { select: { documents: true } },
} satisfies Prisma.DocumentTypeSelect;

export type DocumentTypeRow = Prisma.DocumentTypeGetPayload<{ select: typeof DOCUMENT_TYPE_SELECT }>;

export async function listDocumentTypes(): Promise<DocumentTypeRow[]> {
  return db.documentType.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: DOCUMENT_TYPE_SELECT,
  });
}

export type DocumentTypeInput = {
  name: string;
  description: string | null;
  level: StudyLevel;
  isRequired: boolean;
  acceptedMimeTypes: string[];
  maxSizeBytes: number;
  isActive: boolean;
};

export async function saveDocumentType(
  id: string | null,
  input: DocumentTypeInput,
): Promise<{ id: string }> {
  const data = { ...input, maxSizeBytes: Math.min(input.maxSizeBytes, MAX_DOCUMENT_BYTES) };
  if (id) {
    await db.documentType.update({ where: { id }, data });
    return { id };
  }
  return db.documentType.create({
    data: { ...data, order: await nextOrder("documentType") },
    select: { id: true },
  });
}

export async function deleteDocumentType(id: string): Promise<{ ok: boolean; reason?: string }> {
  const row = await db.documentType.findUnique({
    where: { id },
    select: { _count: { select: { documents: true } } },
  });
  if (!row) return { ok: true };
  if (row._count.documents > 0) {
    return { ok: false, reason: "Uploaded documents are filed under this type. Switch it off instead." };
  }
  await db.documentType.delete({ where: { id } });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Entry requirements
// ---------------------------------------------------------------------------

const REQUIREMENT_SELECT = {
  id: true,
  title: true,
  description: true,
  level: true,
  order: true,
  status: true,
} satisfies Prisma.AdmissionRequirementSelect;

export type RequirementRow = Prisma.AdmissionRequirementGetPayload<{ select: typeof REQUIREMENT_SELECT }>;

export async function listRequirements(): Promise<RequirementRow[]> {
  return db.admissionRequirement.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: REQUIREMENT_SELECT,
  });
}

export type RequirementInput = {
  title: string;
  description: string | null;
  level: StudyLevel;
  status: ContentStatus;
};

export async function saveRequirement(
  id: string | null,
  input: RequirementInput,
): Promise<{ id: string }> {
  if (id) {
    await db.admissionRequirement.update({ where: { id }, data: input });
    return { id };
  }
  return db.admissionRequirement.create({
    data: { ...input, order: await nextOrder("admissionRequirement") },
    select: { id: true },
  });
}

export async function deleteRequirement(id: string): Promise<void> {
  await db.admissionRequirement.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Extra questions
// ---------------------------------------------------------------------------

const FIELD_SELECT = {
  id: true,
  step: true,
  key: true,
  label: true,
  helpText: true,
  fieldType: true,
  options: true,
  isRequired: true,
  order: true,
  isActive: true,
} satisfies Prisma.ApplicationFormFieldSelect;

export type FormFieldRow = Omit<
  Prisma.ApplicationFormFieldGetPayload<{ select: typeof FIELD_SELECT }>,
  "options"
> & { options: FieldOption[] };

export async function listFormFields(): Promise<FormFieldRow[]> {
  const rows = await db.applicationFormField.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: FIELD_SELECT,
  });
  return rows.map((row) => ({ ...row, options: parseFieldOptions(row.options) }));
}

export type FormFieldInput = {
  step: ApplicationStep;
  key: string;
  label: string;
  helpText: string | null;
  fieldType: FormFieldType;
  options: FieldOption[];
  isRequired: boolean;
  isActive: boolean;
};

export async function saveFormField(
  id: string | null,
  input: FormFieldInput,
): Promise<{ id: string } | { error: string }> {
  const data = { ...input, options: input.options as unknown as Prisma.InputJsonValue };
  if (id) {
    // The key is what stored answers are filed under; it never changes.
    const { key: _ignored, ...rest } = data;
    void _ignored;
    await db.applicationFormField.update({ where: { id }, data: rest });
    return { id };
  }
  const clash = await db.applicationFormField.count({ where: { key: input.key } });
  if (clash > 0) return { error: `A question with the key "${input.key}" already exists.` };
  return db.applicationFormField.create({
    data: { ...data, order: await nextOrder("applicationFormField") },
    select: { id: true },
  });
}

/** Answers already given stay in each application's JSON; only the question goes. */
export async function deleteFormField(id: string): Promise<void> {
  await db.applicationFormField.delete({ where: { id } });
}

