"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requirePermission } from "@bass/auth/dal";
import { describePasswordProblem } from "@bass/auth/password-policy";
import { ROLE_LABELS } from "@bass/auth/rbac";
import { revokeAllSessionsForUser } from "@bass/auth/session";
import { UserRole } from "@bass/db/enums";
import { recordAudit } from "@bass/core/audit";
import { createUser, deleteUser, getUser, resetUserPassword, setUserActive, updateUser } from "@bass/core/users-admin";

import { firstIssues, text, type FormState } from "@/lib/forms";

/**
 * Staff accounts. Everything here needs users:write, which only a super
 * administrator holds; the rules about the last super administrator and
 * one's own account live in @bass/core/users-admin.
 */

const password = z.string().superRefine((v, ctx) => {
  const problem = describePasswordProblem(v);
  if (problem) ctx.addIssue({ code: "custom", message: problem });
});

const detailsSchema = z.object({
  name: z.string().trim().min(2, "Enter the person's name.").max(120),
  email: z.email("Enter a valid email address.").max(254).transform((v) => v.toLowerCase()),
  role: z.enum(UserRole, { error: "Choose a role." }),
});

const newUserSchema = detailsSchema
  .extend({ password, confirm: z.string() })
  .refine((d) => d.password === d.confirm, { message: "The two passwords differ.", path: ["confirm"] });

const passwordSchema = z
  .object({ password, confirm: z.string() })
  .refine((d) => d.password === d.confirm, { message: "The two passwords differ.", path: ["confirm"] });

export async function createUserAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("users:write");
  const values = { name: text(formData, "name"), email: text(formData, "email"), role: text(formData, "role") || UserRole.STAFF };
  // The passwords are validated but never echoed back.
  const parsed = newUserSchema.safeParse({ ...values, password: String(formData.get("password") ?? ""), confirm: String(formData.get("confirm") ?? "") });
  if (!parsed.success) return { status: "error", message: "Please check the highlighted fields.", fieldErrors: firstIssues(parsed.error), values };

  const result = await createUser(parsed.data);
  if (!result.ok) return { status: "error", fieldErrors: { [result.field]: result.message }, values };

  await recordAudit({ actorUserId: actor.id, action: "created", entityType: "user", entityId: result.id, note: `${parsed.data.name} (${ROLE_LABELS[parsed.data.role]})` });
  revalidatePath("/users");
  redirect(`/users/${result.id}?created=1`);
}

export async function updateUserAction(id: string, _previous: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("users:write");
  const values = { name: text(formData, "name"), email: text(formData, "email"), role: text(formData, "role") };
  const parsed = detailsSchema.safeParse(values);
  if (!parsed.success) return { status: "error", message: "Please check the highlighted fields.", fieldErrors: firstIssues(parsed.error), values };

  const result = await updateUser(id, actor.id, parsed.data);
  if (!result.ok) return { status: "error", fieldErrors: { [result.field]: result.message }, values };

  if (result.roleChanged && result.previousRole) {
    await recordAudit({
      actorUserId: actor.id,
      action: "role_changed",
      entityType: "user",
      entityId: id,
      oldValue: { role: result.previousRole },
      newValue: { role: parsed.data.role },
      note: `${parsed.data.name}: ${ROLE_LABELS[result.previousRole]} → ${ROLE_LABELS[parsed.data.role]}`,
    });
  } else {
    await recordAudit({ actorUserId: actor.id, action: "updated", entityType: "user", entityId: id, note: parsed.data.name });
  }
  revalidatePath("/users");
  redirect(`/users/${id}?saved=1`);
}

export async function resetPasswordAction(id: string, _previous: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("users:write");
  const parsed = passwordSchema.safeParse({ password: String(formData.get("password") ?? ""), confirm: String(formData.get("confirm") ?? "") });
  if (!parsed.success) return { status: "error", fieldErrors: firstIssues(parsed.error) };
  const user = await getUser(id);
  if (!user) return { status: "error", message: "That account no longer exists." };

  await resetUserPassword(id, parsed.data.password);
  await recordAudit({ actorUserId: actor.id, action: "password_changed", entityType: "user", entityId: id, note: `${user.name}: set by an administrator` });
  revalidatePath("/users");
  return { status: "success", message: `New password set. ${user.name} has been signed out everywhere and can sign in with it now.` };
}

export async function setActiveAction(formData: FormData): Promise<void> {
  const actor = await requirePermission("users:write");
  const id = text(formData, "id");
  const isActive = text(formData, "isActive") === "true";
  const user = await getUser(id);
  if (!user) redirect("/users");

  const result = await setUserActive(id, actor.id, isActive);
  if (!result.ok) redirect(`/users/${id}?refused=${encodeURIComponent(result.message)}`);

  await recordAudit({ actorUserId: actor.id, action: isActive ? "account_enabled" : "account_disabled", entityType: "user", entityId: id, note: user.name });
  revalidatePath("/users");
  redirect(`/users/${id}?saved=1`);
}

export async function signOutEverywhereAction(formData: FormData): Promise<void> {
  const actor = await requirePermission("users:write");
  const id = text(formData, "id");
  const user = await getUser(id);
  if (!user) redirect("/users");
  await revokeAllSessionsForUser(id);
  await recordAudit({ actorUserId: actor.id, action: "signed_out", entityType: "user", entityId: id, note: `${user.name}: signed out everywhere by an administrator` });
  revalidatePath("/users");
  redirect(`/users/${id}?signedout=1`);
}

export async function deleteUserAction(formData: FormData): Promise<void> {
  const actor = await requirePermission("users:write");
  const id = text(formData, "id");
  const user = await getUser(id);
  if (!user) redirect("/users");

  const result = await deleteUser(id, actor.id);
  if (!result.ok) redirect(`/users/${id}?refused=${encodeURIComponent(result.message)}`);

  await recordAudit({ actorUserId: actor.id, action: "deleted", entityType: "user", entityId: id, note: `${user.name} (${user.email})` });
  revalidatePath("/users");
  redirect("/users?deleted=1");
}
