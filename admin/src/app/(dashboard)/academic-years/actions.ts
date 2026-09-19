"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import {
  deleteAcademicYear,
  saveAcademicYear,
  setActiveAcademicYear,
} from "@/lib/admissions-config";
import { recordAudit } from "@/lib/audit";
import { setSetting } from "@/lib/settings";

import type { ConfigState } from "../requirements/actions";

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function refresh() {
  revalidatePath("/academic-years");
}

/** A date input's "YYYY-MM-DD" as UTC midnight, or null when empty. */
const day = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === "") return null;
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date." });
      return z.NEVER;
    }
    return date;
  });

/** Closing dates are read as the end of that day in Kampala, so "closes 10 Dec" includes 10 Dec. */
const endOfDay = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === "") return null;
    const date = new Date(`${value}T23:59:59.999+03:00`);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date." });
      return z.NEVER;
    }
    return date;
  });

const startOfDay = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === "") return null;
    const date = new Date(`${value}T00:00:00.000+03:00`);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date." });
      return z.NEVER;
    }
    return date;
  });

const yearSchema = z
  .object({
    name: z.string().trim().min(4, "Name the year, for example 2027 or 2027/2028.").max(20),
    startDate: day,
    endDate: day,
    isAcceptingApplications: z.boolean(),
    applicationOpensAt: startOfDay,
    applicationClosesAt: endOfDay,
  })
  .refine((d) => !d.startDate || !d.endDate || d.startDate <= d.endDate, {
    message: "The year must end after it starts.",
    path: ["endDate"],
  })
  .refine(
    (d) => !d.applicationOpensAt || !d.applicationClosesAt || d.applicationOpensAt < d.applicationClosesAt,
    { message: "Applications must close after they open.", path: ["applicationClosesAt"] },
  );

export async function saveYearAction(
  id: string | null,
  _previous: ConfigState,
  formData: FormData,
): Promise<ConfigState> {
  const user = await requirePermission("admissions:configure");
  const values = {
    name: text(formData, "name"),
    startDate: text(formData, "startDate"),
    endDate: text(formData, "endDate"),
    isAcceptingApplications: formData.get("isAcceptingApplications") === "on",
    applicationOpensAt: text(formData, "applicationOpensAt"),
    applicationClosesAt: text(formData, "applicationClosesAt"),
  };
  const parsed = yearSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !(key in fieldErrors)) fieldErrors[key] = issue.message;
    }
    return { status: "error", fieldErrors, values };
  }

  const clash = await db.academicYear.findFirst({
    where: { name: parsed.data.name, NOT: id ? { id } : undefined },
    select: { id: true },
  });
  if (clash) return { status: "error", fieldErrors: { name: "A year with this name already exists." }, values };

  const saved = await saveAcademicYear(id, parsed.data);
  await recordAudit({
    actorUserId: user.id,
    action: id ? "updated" : "created",
    entityType: "academic_year",
    entityId: saved.id,
    note: parsed.data.name,
  });
  refresh();
  revalidatePath("/requirements");
  return { status: "idle" };
}

export async function activateYearAction(formData: FormData): Promise<void> {
  const user = await requirePermission("admissions:configure");
  const id = text(formData, "id");
  await setActiveAcademicYear(id);
  await recordAudit({ actorUserId: user.id, action: "updated", entityType: "academic_year", entityId: id, note: "Made the active year" });
  refresh();
}

export async function deleteYearAction(formData: FormData): Promise<void> {
  const user = await requirePermission("admissions:configure");
  const id = text(formData, "id");
  const result = await deleteAcademicYear(id);
  if (result.ok) {
    await recordAudit({ actorUserId: user.id, action: "deleted", entityType: "academic_year", entityId: id });
  }
  refresh();
}

/** The site-wide switch; both it and the active year's switch must be on. */
export async function setMasterSwitchAction(formData: FormData): Promise<void> {
  const user = await requirePermission("admissions:configure");
  const open = text(formData, "open") === "true";
  await setSetting("admissions.isOpen", open);
  await recordAudit({
    actorUserId: user.id,
    action: "updated",
    entityType: "site_setting",
    entityId: "admissions.isOpen",
    newValue: { value: open },
  });
  refresh();
}
