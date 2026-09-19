"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requirePermission } from "@bass/auth/dal";
import { MediaVisibility } from "@bass/db/enums";
import { db } from "@bass/db";
import { recordAudit } from "@bass/core/audit";
import {
  createHeroSlide,
  deleteHeroSlide,
  getHeroSlide,
  moveHeroSlide,
  setHeroSlideActive,
  updateHeroSlide,
  type HeroSlideInput,
} from "@bass/core/hero-slides";
import { storePublicImage } from "@bass/core/media-library";

import type { SlideFormValues } from "@/components/hero-slides/helpers";

/**
 * Staff actions on hero slides. Each takes the slide id (or none, for a new
 * one) and the form; the form's image slots may each carry a chosen library
 * image, a freshly uploaded photograph, or nothing.
 */

export type SlideFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
  /**
   * What was typed, echoed back on a rejected save. React resets a form's
   * fields after any action completes, so without this an error would wipe
   * the slide the user was composing.
   */
  values?: SlideFormValues;
};

const IMAGE_SLOTS = ["image", "collageOne", "collageTwo", "collageThree"] as const;
type ImageSlot = (typeof IMAGE_SLOTS)[number];

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

/** "" -> null, so an empty input clears the column rather than storing "". */
const optional = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `Keep the ${label} under ${max} characters.`)
    .transform((value) => (value === "" ? null : value));

/** A path on this site, or an absolute http(s), tel: or mailto: link. */
const href = optional(300, "link").refine(
  (value) => value === null || /^(\/(?!\/)|https?:\/\/|tel:|mailto:)/.test(value),
  { message: "Enter a path like /admissions/apply, or a full https:// address." },
);

/** datetime-local gives "YYYY-MM-DDTHH:MM"; interpreted in the school's time zone. */
const when = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === "") return null;
    const date = new Date(`${value}:00+03:00`);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date and time." });
      return z.NEVER;
    }
    return date;
  });

const slideSchema = z
  .object({
    title: z.string().trim().min(2, "Give the slide a title.").max(120, "Keep the title under 120 characters."),
    subtitle: optional(60, "small line"),
    body: optional(400, "text"),
    displayText: optional(60, "display line"),
    ctaLabel: optional(40, "button label"),
    ctaHref: href,
    ctaSecondaryLabel: optional(40, "button label"),
    ctaSecondaryHref: href,
    showPhone: z.boolean(),
    isActive: z.boolean(),
    publishFrom: when,
    publishUntil: when,
  })
  .refine((data) => Boolean(data.ctaLabel) === Boolean(data.ctaHref), {
    message: "A button needs both a label and a link.",
    path: ["ctaLabel"],
  })
  .refine((data) => Boolean(data.ctaSecondaryLabel) === Boolean(data.ctaSecondaryHref), {
    message: "A button needs both a label and a link.",
    path: ["ctaSecondaryLabel"],
  })
  .refine(
    (data) => !data.publishFrom || !data.publishUntil || data.publishFrom < data.publishUntil,
    { message: "The slide must stop showing after it starts.", path: ["publishUntil"] },
  );

function firstIssues(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !(key in errors)) errors[key] = issue.message;
  }
  return errors;
}

/**
 * Resolves one image slot: an upload wins over a library choice, a library
 * choice must be a public image that exists, and "none" clears the slot.
 */
async function resolveImage(
  formData: FormData,
  slot: ImageSlot,
  userId: string,
): Promise<{ ok: true; id: string | null } | { ok: false; message: string }> {
  const file = formData.get(`${slot}File`);
  if (file instanceof File && file.size > 0) {
    const stored = await storePublicImage({ file, folder: "hero", uploadedById: userId });
    return stored.ok ? { ok: true, id: stored.id } : { ok: false, message: stored.message };
  }

  const chosen = text(formData, `${slot}Id`);
  if (!chosen) return { ok: true, id: null };

  const exists = await db.mediaAsset.count({
    where: { id: chosen, visibility: MediaVisibility.PUBLIC },
  });
  return exists ? { ok: true, id: chosen } : { ok: false, message: "That photograph is no longer in the library." };
}

export async function saveHeroSlide(
  id: string | null,
  _previous: SlideFormState,
  formData: FormData,
): Promise<SlideFormState> {
  const user = await requirePermission("content:write");

  const values: SlideFormValues = {
    title: text(formData, "title"),
    subtitle: text(formData, "subtitle"),
    body: text(formData, "body"),
    displayText: text(formData, "displayText"),
    ctaLabel: text(formData, "ctaLabel"),
    ctaHref: text(formData, "ctaHref"),
    ctaSecondaryLabel: text(formData, "ctaSecondaryLabel"),
    ctaSecondaryHref: text(formData, "ctaSecondaryHref"),
    showPhone: formData.get("showPhone") === "on",
    isActive: formData.get("isActive") === "on",
    publishFrom: text(formData, "publishFrom"),
    publishUntil: text(formData, "publishUntil"),
    imageId: text(formData, "imageId"),
    collageOneId: text(formData, "collageOneId"),
    collageTwoId: text(formData, "collageTwoId"),
    collageThreeId: text(formData, "collageThreeId"),
  };

  const parsed = slideSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors: firstIssues(parsed.error),
      values,
    };
  }

  if (id) {
    const existing = await getHeroSlide(id);
    if (!existing) return { status: "error", message: "This slide no longer exists.", values };
  }

  const images: Partial<Record<ImageSlot, string | null>> = {};
  for (const slot of IMAGE_SLOTS) {
    const resolved = await resolveImage(formData, slot, user.id);
    if (!resolved.ok) {
      return { status: "error", fieldErrors: { [`${slot}File`]: resolved.message }, values };
    }
    images[slot] = resolved.id;
  }

  const input: HeroSlideInput = {
    ...parsed.data,
    imageId: images.image ?? null,
    collageOneId: images.collageOne ?? null,
    collageTwoId: images.collageTwo ?? null,
    collageThreeId: images.collageThree ?? null,
  };

  let slideId = id;
  if (slideId) {
    await updateHeroSlide(slideId, input);
  } else {
    slideId = (await createHeroSlide(input)).id;
  }

  await recordAudit({
    actorUserId: user.id,
    action: id ? "updated" : "created",
    entityType: "hero_slide",
    entityId: slideId,
    note: input.title,
  });

  revalidatePath("/hero-slides");
  redirect("/hero-slides?saved=1");
}

export async function removeHeroSlide(formData: FormData): Promise<void> {
  const user = await requirePermission("content:write");
  const id = text(formData, "id");
  const slide = await getHeroSlide(id);
  if (!slide) return;

  await deleteHeroSlide(id);
  await recordAudit({
    actorUserId: user.id,
    action: "deleted",
    entityType: "hero_slide",
    entityId: id,
    note: slide.title,
  });
  revalidatePath("/hero-slides");
}

export async function reorderHeroSlide(formData: FormData): Promise<void> {
  await requirePermission("content:write");
  const direction = text(formData, "direction");
  if (direction !== "up" && direction !== "down") return;
  await moveHeroSlide(text(formData, "id"), direction);
  revalidatePath("/hero-slides");
}

export async function toggleHeroSlide(formData: FormData): Promise<void> {
  const user = await requirePermission("content:write");
  const id = text(formData, "id");
  const isActive = text(formData, "isActive") === "true";
  const slide = await getHeroSlide(id);
  if (!slide) return;

  await setHeroSlideActive(id, isActive);
  await recordAudit({
    actorUserId: user.id,
    action: isActive ? "published" : "unpublished",
    entityType: "hero_slide",
    entityId: id,
    note: slide.title,
  });
  revalidatePath("/hero-slides");
}
