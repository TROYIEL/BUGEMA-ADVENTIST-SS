"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requirePermission } from "@bass/auth/dal";
import { ContentStatus } from "@bass/db/enums";
import { recordAudit } from "@bass/core/audit";
import { deleteEvent, getEvent, saveEvent, slugify } from "@bass/core/content-admin";

import { dateFromInput, firstIssues, flag, text, type FormState } from "@/lib/forms";

const optional = (max: number) =>
  z.string().trim().max(max, `Keep this under ${max} characters.`).transform((v) => (v === "" ? null : v));

const day = (required: boolean) =>
  z.string().trim().transform((v, ctx) => {
    if (v === "" && required) {
      ctx.addIssue({ code: "custom", message: "Enter the date." });
      return z.NEVER;
    }
    const date = dateFromInput(v);
    if (date === undefined) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date." });
      return z.NEVER;
    }
    return date;
  });

const time = optional(5).refine((v) => v === null || /^\d{2}:\d{2}$/.test(v), { message: "Use the 24-hour form, for example 09:00." });

const schema = z
  .object({
    title: z.string().trim().min(2, "Give the event a title.").max(160),
    slug: z.string().trim().max(120),
    description: optional(400),
    body: z.string().transform((v) => (v.replace(/<[^>]+>/g, "").trim() === "" ? null : v)),
    startDate: day(true),
    endDate: day(false),
    startTime: time,
    endTime: time,
    location: optional(160),
    registrationUrl: optional(300).refine((v) => v === null || /^https?:\/\//.test(v), { message: "Enter a full https:// address." }),
    status: z.enum(ContentStatus, { error: "Choose whether the event is published." }),
    isFeatured: z.boolean(),
    seoTitle: optional(120),
    seoDescription: optional(200),
    imageId: optional(40),
  })
  .refine((d) => !d.endDate || !d.startDate || d.endDate >= d.startDate, { message: "The event must end on or after the day it starts.", path: ["endDate"] });

export async function saveEventAction(id: string | null, _previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission("content:write");
  const values = {
    title: text(formData, "title"),
    slug: text(formData, "slug"),
    description: text(formData, "description"),
    body: String(formData.get("body") ?? ""),
    startDate: text(formData, "startDate"),
    endDate: text(formData, "endDate"),
    startTime: text(formData, "startTime"),
    endTime: text(formData, "endTime"),
    location: text(formData, "location"),
    registrationUrl: text(formData, "registrationUrl"),
    status: text(formData, "status") || ContentStatus.DRAFT,
    isFeatured: flag(formData, "isFeatured"),
    seoTitle: text(formData, "seoTitle"),
    seoDescription: text(formData, "seoDescription"),
    imageId: text(formData, "imageId"),
  };
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { status: "error", message: "Please check the highlighted fields.", fieldErrors: firstIssues(parsed.error), values };
  if (parsed.data.status === ContentStatus.PUBLISHED) {
    const publisher = await requirePermission("content:publish").catch(() => null);
    if (!publisher) return { status: "error", message: "Your role can write events but not publish them. Save it as a draft for someone who can.", values };
  }

  const saved = await saveEvent(id, { ...parsed.data, startDate: parsed.data.startDate!, slug: slugify(parsed.data.slug || parsed.data.title) || "event" });
  await recordAudit({ actorUserId: user.id, action: id ? "updated" : "created", entityType: "event", entityId: saved.id, note: parsed.data.title });
  revalidatePath("/events");
  redirect(`/events/${saved.id}?saved=1`);
}

export async function deleteEventAction(formData: FormData): Promise<void> {
  const user = await requirePermission("content:write");
  const id = text(formData, "id");
  const event = await getEvent(id);
  if (!event) redirect("/events");
  await deleteEvent(id);
  await recordAudit({ actorUserId: user.id, action: "deleted", entityType: "event", entityId: id, note: event.title });
  revalidatePath("/events");
  redirect("/events?deleted=1");
}
