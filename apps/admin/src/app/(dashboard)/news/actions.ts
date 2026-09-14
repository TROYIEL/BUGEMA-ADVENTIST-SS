"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requirePermission } from "@bass/auth/dal";
import { ContentStatus } from "@bass/db/enums";
import { recordAudit } from "@bass/core/audit";
import { deleteNews, getNews, saveNews, slugify } from "@bass/core/content-admin";

import { dateTimeFromInput, firstIssues, flag, text, type FormState } from "@/lib/forms";

const optional = (max: number) =>
  z.string().trim().max(max, `Keep this under ${max} characters.`).transform((v) => (v === "" ? null : v));

const schema = z.object({
  title: z.string().trim().min(2, "Give the story a headline.").max(160),
  slug: z.string().trim().max(120),
  excerpt: optional(400),
  body: z.string().transform((v) => (v.replace(/<[^>]+>/g, "").trim() === "" ? null : v)),
  category: optional(60),
  status: z.enum(ContentStatus, { error: "Choose whether the story is published." }),
  isFeatured: z.boolean(),
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
  featuredImageId: optional(40),
});

export async function saveNewsAction(id: string | null, _previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission("content:write");
  const values = {
    title: text(formData, "title"),
    slug: text(formData, "slug"),
    excerpt: text(formData, "excerpt"),
    body: String(formData.get("body") ?? ""),
    category: text(formData, "category"),
    status: text(formData, "status") || ContentStatus.DRAFT,
    isFeatured: flag(formData, "isFeatured"),
    publishedAt: text(formData, "publishedAt"),
    seoTitle: text(formData, "seoTitle"),
    seoDescription: text(formData, "seoDescription"),
    featuredImageId: text(formData, "featuredImageId"),
  };
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { status: "error", message: "Please check the highlighted fields.", fieldErrors: firstIssues(parsed.error), values };
  if (parsed.data.status === ContentStatus.PUBLISHED) {
    const publisher = await requirePermission("content:publish").catch(() => null);
    if (!publisher) return { status: "error", message: "Your role can write stories but not publish them. Save it as a draft for someone who can.", values };
  }

  const saved = await saveNews(id, { ...parsed.data, slug: slugify(parsed.data.slug || parsed.data.title) || "story" }, user.id);
  await recordAudit({ actorUserId: user.id, action: id ? "updated" : "created", entityType: "news_article", entityId: saved.id, note: parsed.data.title });
  revalidatePath("/news");
  redirect(`/news/${saved.id}?saved=1`);
}

export async function deleteNewsAction(formData: FormData): Promise<void> {
  const user = await requirePermission("content:write");
  const id = text(formData, "id");
  const story = await getNews(id);
  if (!story) redirect("/news");
  await deleteNews(id);
  await recordAudit({ actorUserId: user.id, action: "deleted", entityType: "news_article", entityId: id, note: story.title });
  revalidatePath("/news");
  redirect("/news?deleted=1");
}
