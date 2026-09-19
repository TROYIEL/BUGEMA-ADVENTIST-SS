"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/dal";
import { AnnouncementPlacement } from "@/generated/prisma/enums";
import { recordAudit } from "@/lib/audit";
import { deleteAnnouncement, saveAnnouncement } from "@/lib/content-admin";

import { dateTimeFromInput, firstIssues, flag, text, type FormState } from "@/lib/forms";

const optional = (max: number) =>
  z.string().trim().max(max, `Keep this under ${max} characters.`).transform((v) => (v === "" ? null : v));

const when = z.string().transform((v, ctx) => {
  const date = dateTimeFromInput(v);
  if (date === undefined) {
    ctx.addIssue({ code: "custom", message: "Enter a valid date and time." });
    return z.NEVER;
  }
  return date;
});

const schema = z
  .object({
    title: z.string().trim().min(2, "Write the announcement.").max(120, "Keep it under 120 characters; it sits in a bar."),
    body: optional(200),
    linkLabel: optional(40),
    linkHref: optional(300).refine((v) => v === null || /^(\/(?!\/)|https?:\/\/|tel:|mailto:)/.test(v), { message: "Enter a path like /admissions/apply, or a full address." }),
    placement: z.enum(AnnouncementPlacement, { error: "Choose where it shows." }),
    priority: z.string().trim().transform((v, ctx) => {
      const n = v === "" ? 0 : Number(v);
      if (!Number.isInteger(n) || n < -100 || n > 100) {
        ctx.addIssue({ code: "custom", message: "A whole number between -100 and 100." });
        return z.NEVER;
      }
      return n;
    }),
    startsAt: when,
    endsAt: when,
    isActive: z.boolean(),
  })
  .refine((d) => Boolean(d.linkLabel) === Boolean(d.linkHref), { message: "A link needs both its text and its address.", path: ["linkLabel"] })
  .refine((d) => !d.startsAt || !d.endsAt || d.startsAt < d.endsAt, { message: "It must end after it starts.", path: ["endsAt"] });

export async function saveAnnouncementAction(id: string | null, _previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission("announcements:write");
  const values = {
    title: text(formData, "title"),
    body: text(formData, "body"),
    linkLabel: text(formData, "linkLabel"),
    linkHref: text(formData, "linkHref"),
    placement: text(formData, "placement") || AnnouncementPlacement.GLOBAL,
    priority: text(formData, "priority"),
    startsAt: text(formData, "startsAt"),
    endsAt: text(formData, "endsAt"),
    isActive: flag(formData, "isActive"),
  };
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: firstIssues(parsed.error), values };

  const saved = await saveAnnouncement(id, parsed.data);
  await recordAudit({ actorUserId: user.id, action: id ? "updated" : "created", entityType: "announcement", entityId: saved.id, note: parsed.data.title });
  revalidatePath("/announcements");
  return { status: "idle" };
}

export async function deleteAnnouncementAction(formData: FormData): Promise<void> {
  const user = await requirePermission("announcements:write");
  const id = text(formData, "id");
  await deleteAnnouncement(id);
  await recordAudit({ actorUserId: user.id, action: "deleted", entityType: "announcement", entityId: id });
  revalidatePath("/announcements");
}
