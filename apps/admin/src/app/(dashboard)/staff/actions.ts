"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requirePermission } from "@bass/auth/dal";
import { recordAudit } from "@bass/core/audit";
import { deleteStaff, getStaff, moveSchoolRow, saveStaff } from "@bass/core/school-admin";

import { firstIssues, flag, text, type FormState } from "@/lib/forms";

const optional = (max: number) =>
  z.string().trim().max(max, `Keep this under ${max} characters.`).transform((v) => (v === "" ? null : v));

const schema = z.object({
  name: z.string().trim().min(2, "Enter the person's name.").max(120),
  position: z.string().trim().min(2, "Enter their position, for example Head Teacher.").max(120),
  department: optional(120),
  bio: optional(2000),
  email: optional(254).refine((v) => v === null || z.email().safeParse(v).success, { message: "Enter a valid email address." }),
  phone: optional(40),
  photoId: optional(40),
  isVisible: z.boolean(),
  isLeadership: z.boolean(),
});

export async function saveStaffAction(id: string | null, _previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission("staff:write");
  const values = {
    name: text(formData, "name"),
    position: text(formData, "position"),
    department: text(formData, "department"),
    bio: text(formData, "bio"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    photoId: text(formData, "photoId"),
    isVisible: flag(formData, "isVisible"),
    isLeadership: flag(formData, "isLeadership"),
  };
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { status: "error", message: "Please check the highlighted fields.", fieldErrors: firstIssues(parsed.error), values };

  const saved = await saveStaff(id, parsed.data);
  await recordAudit({ actorUserId: user.id, action: id ? "updated" : "created", entityType: "staff_profile", entityId: saved.id, note: parsed.data.name });
  revalidatePath("/staff");
  revalidatePath("/academics");
  redirect(`/staff/${saved.id}?saved=1`);
}

export async function deleteStaffAction(formData: FormData): Promise<void> {
  const user = await requirePermission("staff:write");
  const id = text(formData, "id");
  const row = await getStaff(id);
  if (!row) redirect("/staff");
  await deleteStaff(id);
  await recordAudit({ actorUserId: user.id, action: "deleted", entityType: "staff_profile", entityId: id, note: row.name });
  revalidatePath("/staff");
  revalidatePath("/academics");
  redirect("/staff?deleted=1");
}

export async function moveStaffAction(formData: FormData): Promise<void> {
  await requirePermission("staff:write");
  const direction = text(formData, "direction");
  if (direction !== "up" && direction !== "down") return;
  await moveSchoolRow("staffProfile", text(formData, "id"), direction);
  revalidatePath("/staff");
}
