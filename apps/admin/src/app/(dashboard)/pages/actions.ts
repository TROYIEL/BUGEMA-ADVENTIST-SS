"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requirePermission } from "@bass/auth/dal";
import { ContentStatus } from "@bass/db/enums";
import { recordAudit } from "@bass/core/audit";
import { deletePage, getPage, savePage, slugify } from "@bass/core/content-admin";

import { dateTimeFromInput, firstIssues, flag, text, type FormState } from "@/lib/forms";

const optional = (max: number) =>
  z.string().trim().max(max, `Keep this under ${max} characters.`).transform((v) => (v === "" ? null : v));

const schema = z.object({
  title: z.string().trim().min(2, "Give the page a title.").max(160),
  slug: z.string().trim().max(120),
  subtitle: optional(300),
  body: z.string().transform((v) => (v.replace(/<[^>]+>/g, "").trim() === "" ? null : v)),
  status: z.enum(ContentStatus, { error: "Choose whether the page is published." }),
  publishedAt: z.string().transform((v, ctx) => {
    const date = dateTimeFromInput(v);
    if (date === undefined) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date and time." });
      return z.NEVER;
    }
    return date;
  }),
  seoTitle: optional(120),
  seoDescription: optional(200),
  ogImageId: optional(40),
  canonicalUrl: optional(300).refine((v) => v === null || /^(\/|https?:\/\/)/.test(v), { message: "Enter a path or a full https:// address." }),
  noindex: z.boolean(),
});

export async function savePageAction(id: string | null, _previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission("content:write");
  const values = {
    title: text(formData, "title"),
    slug: text(formData, "slug"),
    subtitle: text(formData, "subtitle"),
    body: String(formData.get("body") ?? ""),
    status: text(formData, "status") || ContentStatus.DRAFT,
    publishedAt: text(formData, "publishedAt"),
    seoTitle: text(formData, "seoTitle"),
    seoDescription: text(formData, "seoDescription"),
    ogImageId: text(formData, "ogImageId"),
    canonicalUrl: text(formData, "canonicalUrl"),
    noindex: flag(formData, "noindex"),
  };
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { status: "error", message: "Please check the highlighted fields.", fieldErrors: firstIssues(parsed.error), values };

  // Publishing needs content:publish; anyone with content:write can keep a draft.
  if (parsed.data.status === ContentStatus.PUBLISHED) {
    const publisher = await requirePermission("content:publish").catch(() => null);
    if (!publisher) return { status: "error", message: "Your role can write pages but not publish them. Save it as a draft for someone who can.", values };
  }

  const slug = slugify(parsed.data.slug || parsed.data.title, { allowSlashes: true }) || "page";
  if (slug === "home" && !id) return { status: "error", fieldErrors: { slug: "That address belongs to the homepage." }, values };

  const saved = await savePage(id, { ...parsed.data, slug });
  await recordAudit({ actorUserId: user.id, action: id ? "updated" : "created", entityType: "page", entityId: saved.id, note: parsed.data.title });
  revalidatePath("/pages");
  redirect(`/pages/${saved.id}?saved=1`);
}

export async function deletePageAction(formData: FormData): Promise<void> {
  const user = await requirePermission("content:write");
  const id = text(formData, "id");
  const page = await getPage(id);
  if (!page) redirect("/pages");
  const result = await deletePage(id);
  if (!result.ok) redirect(`/pages/${id}?locked=1`);
  await recordAudit({ actorUserId: user.id, action: "deleted", entityType: "page", entityId: id, note: page.title });
  revalidatePath("/pages");
  redirect("/pages?deleted=1");
}
