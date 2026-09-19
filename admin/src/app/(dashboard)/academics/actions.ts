"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/dal";
import { ContentStatus, StudyLevel } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { slugify } from "@/lib/content-admin";
import {
  deleteDepartment,
  deleteProgram,
  deleteSubject,
  getDepartment,
  getProgram,
  moveSchoolRow,
  saveDepartment,
  saveProgram,
  saveSubject,
} from "@/lib/school-admin";

import { firstIssues, flag, text, type FormState } from "@/lib/forms";

const optional = (max: number) =>
  z.string().trim().max(max, `Keep this under ${max} characters.`).transform((v) => (v === "" ? null : v));
const body = z.string().transform((v) => (v.replace(/<[^>]+>/g, "").trim() === "" ? null : v));
const status = z.enum(ContentStatus, { error: "Choose whether it is published." });
const level = z.enum(StudyLevel, { error: "Choose a level." });

async function canPublish(): Promise<boolean> {
  return Boolean(await requirePermission("content:publish").catch(() => null));
}

function refresh() {
  revalidatePath("/academics");
}

// ---- Programmes -----------------------------------------------------------

const programSchema = z.object({
  title: z.string().trim().min(2, "Give the programme a title.").max(160),
  slug: z.string().trim().max(120),
  level,
  summary: optional(400),
  body,
  imageId: optional(40),
  status,
});

export async function saveProgramAction(id: string | null, _previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission("academics:write");
  const values = {
    title: text(formData, "title"),
    slug: text(formData, "slug"),
    level: text(formData, "level") || StudyLevel.BOTH,
    summary: text(formData, "summary"),
    body: String(formData.get("body") ?? ""),
    imageId: text(formData, "imageId"),
    status: text(formData, "status") || ContentStatus.DRAFT,
  };
  const parsed = programSchema.safeParse(values);
  if (!parsed.success) return { status: "error", message: "Please check the highlighted fields.", fieldErrors: firstIssues(parsed.error), values };
  if (parsed.data.status === ContentStatus.PUBLISHED && !(await canPublish())) {
    return { status: "error", message: "Your role can edit programmes but not publish them. Save it as a draft.", values };
  }
  const saved = await saveProgram(id, { ...parsed.data, slug: slugify(parsed.data.slug || parsed.data.title) || "programme" });
  await recordAudit({ actorUserId: user.id, action: id ? "updated" : "created", entityType: "academic_program", entityId: saved.id, note: parsed.data.title });
  refresh();
  redirect(`/academics/programmes/${saved.id}?saved=1`);
}

export async function deleteProgramAction(formData: FormData): Promise<void> {
  const user = await requirePermission("academics:write");
  const id = text(formData, "id");
  const row = await getProgram(id);
  if (!row) redirect("/academics");
  await deleteProgram(id);
  await recordAudit({ actorUserId: user.id, action: "deleted", entityType: "academic_program", entityId: id, note: row.title });
  refresh();
  redirect("/academics?deleted=programme");
}

// ---- Departments ----------------------------------------------------------

const departmentSchema = z.object({
  title: z.string().trim().min(2, "Give the department a name.").max(120),
  slug: z.string().trim().max(120),
  description: optional(400),
  body,
  imageId: optional(40),
  headId: optional(40),
  status,
});

export async function saveDepartmentAction(id: string | null, _previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission("academics:write");
  // The shared title/address fields post the name as "title".
  const values = {
    title: text(formData, "title"),
    slug: text(formData, "slug"),
    description: text(formData, "description"),
    body: String(formData.get("body") ?? ""),
    imageId: text(formData, "imageId"),
    headId: text(formData, "headId"),
    status: text(formData, "status") || ContentStatus.DRAFT,
  };
  const parsed = departmentSchema.safeParse(values);
  if (!parsed.success) return { status: "error", message: "Please check the highlighted fields.", fieldErrors: firstIssues(parsed.error), values };
  if (parsed.data.status === ContentStatus.PUBLISHED && !(await canPublish())) {
    return { status: "error", message: "Your role can edit departments but not publish them. Save it as a draft.", values };
  }
  if (parsed.data.headId && !(await db.staffProfile.count({ where: { id: parsed.data.headId } }))) {
    return { status: "error", fieldErrors: { headId: "That person is no longer on the staff list." }, values };
  }
  const { title, ...rest } = parsed.data;
  const saved = await saveDepartment(id, { ...rest, name: title, slug: slugify(parsed.data.slug || title) || "department" });
  await recordAudit({ actorUserId: user.id, action: id ? "updated" : "created", entityType: "academic_department", entityId: saved.id, note: title });
  refresh();
  redirect(`/academics/departments/${saved.id}?saved=1`);
}

export async function deleteDepartmentAction(formData: FormData): Promise<void> {
  const user = await requirePermission("academics:write");
  const id = text(formData, "id");
  const row = await getDepartment(id);
  if (!row) redirect("/academics");
  await deleteDepartment(id);
  await recordAudit({ actorUserId: user.id, action: "deleted", entityType: "academic_department", entityId: id, note: row.name });
  refresh();
  redirect("/academics?deleted=department");
}

// ---- Subjects -------------------------------------------------------------

const subjectSchema = z.object({
  name: z.string().trim().min(2, "Give the subject a name.").max(120),
  description: optional(400),
  departmentId: optional(40),
  teacherId: optional(40),
  level,
  isCore: z.boolean(),
  status,
});

export async function saveSubjectAction(id: string | null, _previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission("academics:write");
  const values = {
    name: text(formData, "name"),
    description: text(formData, "description"),
    departmentId: text(formData, "departmentId"),
    teacherId: text(formData, "teacherId"),
    level: text(formData, "level") || StudyLevel.BOTH,
    isCore: flag(formData, "isCore"),
    status: text(formData, "status") || ContentStatus.PUBLISHED,
  };
  const parsed = subjectSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: firstIssues(parsed.error), values };
  if (parsed.data.status === ContentStatus.PUBLISHED && !(await canPublish())) {
    return { status: "error", message: "Your role can edit subjects but not publish them.", values };
  }
  const saved = await saveSubject(id, parsed.data, slugify(parsed.data.name) || "subject");
  await recordAudit({ actorUserId: user.id, action: id ? "updated" : "created", entityType: "subject", entityId: saved.id, note: parsed.data.name });
  refresh();
  return { status: "idle" };
}

export async function deleteSubjectAction(formData: FormData): Promise<void> {
  const user = await requirePermission("academics:write");
  const id = text(formData, "id");
  await deleteSubject(id);
  await recordAudit({ actorUserId: user.id, action: "deleted", entityType: "subject", entityId: id });
  refresh();
}

// ---- Order ----------------------------------------------------------------

const MODELS = { programme: "academicProgram", department: "academicDepartment", subject: "subject" } as const;

export async function moveAcademicAction(formData: FormData): Promise<void> {
  await requirePermission("academics:write");
  const kind = text(formData, "kind") as keyof typeof MODELS;
  const direction = text(formData, "direction");
  if (!(kind in MODELS) || (direction !== "up" && direction !== "down")) return;
  await moveSchoolRow(MODELS[kind], text(formData, "id"), direction);
  refresh();
}
