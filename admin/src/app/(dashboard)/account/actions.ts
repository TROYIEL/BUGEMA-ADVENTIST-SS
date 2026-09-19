"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@bass/auth/dal";
import { describePasswordProblem } from "@bass/auth/password-policy";
import { recordAudit } from "@bass/core/audit";
import { changeOwnPassword, updateOwnName } from "@bass/core/users-admin";

import { firstIssues, text, type FormState } from "@/lib/forms";

/** Anyone signed in can look after their own name and password. */

const nameSchema = z.object({ name: z.string().trim().min(2, "Enter your name.").max(120) });

const passwordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    password: z.string().superRefine((v, ctx) => {
      const problem = describePasswordProblem(v);
      if (problem) ctx.addIssue({ code: "custom", message: problem });
    }),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "The two passwords differ.", path: ["confirm"] })
  .refine((d) => d.password !== d.current, { message: "Choose a password you have not used here before.", path: ["password"] });

export async function updateOwnNameAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const values = { name: text(formData, "name") };
  const parsed = nameSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: firstIssues(parsed.error), values };
  await updateOwnName(user.id, parsed.data.name);
  await recordAudit({ actorUserId: user.id, action: "updated", entityType: "user", entityId: user.id, note: `Renamed themselves to ${parsed.data.name}` });
  revalidatePath("/", "layout");
  return { status: "success", message: "Name saved.", values };
}

export async function changeOwnPasswordAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = passwordSchema.safeParse({
    current: String(formData.get("current") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if (!parsed.success) return { status: "error", fieldErrors: firstIssues(parsed.error) };

  const result = await changeOwnPassword(user.id, parsed.data.current, parsed.data.password);
  if (!result.ok) return { status: "error", fieldErrors: { current: result.message } };

  await recordAudit({ actorUserId: user.id, action: "password_changed", entityType: "user", entityId: user.id, note: "Changed their own password" });
  return {
    status: "success",
    message: result.otherSessions > 0 ? `Password changed. ${result.otherSessions} other ${result.otherSessions === 1 ? "session was" : "sessions were"} signed out.` : "Password changed.",
  };
}
