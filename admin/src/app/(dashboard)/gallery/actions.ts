"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requirePermission } from "@bass/auth/dal";
import { ContentStatus } from "@bass/db/enums";
import { recordAudit } from "@bass/core/audit";
import {
  addAlbumImages,
  deleteAlbum,
  getAlbum,
  moveAlbumImage,
  removeAlbumImage,
  saveAlbum,
  slugify,
  updateAlbumImage,
} from "@bass/core/content-admin";

import { firstIssues, text, type FormState } from "@/lib/forms";

const optional = (max: number) =>
  z.string().trim().max(max, `Keep this under ${max} characters.`).transform((v) => (v === "" ? null : v));

const schema = z.object({
  title: z.string().trim().min(2, "Give the album a title.").max(160),
  slug: z.string().trim().max(120),
  description: optional(600),
  category: optional(60),
  status: z.enum(ContentStatus, { error: "Choose whether the album is published." }),
  coverImageId: optional(40),
});

export async function saveAlbumAction(id: string | null, _previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission("content:write");
  const values = {
    title: text(formData, "title"),
    slug: text(formData, "slug"),
    description: text(formData, "description"),
    category: text(formData, "category"),
    status: text(formData, "status") || ContentStatus.DRAFT,
    coverImageId: text(formData, "coverImageId"),
  };
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { status: "error", message: "Please check the highlighted fields.", fieldErrors: firstIssues(parsed.error), values };
  if (parsed.data.status === ContentStatus.PUBLISHED) {
    const publisher = await requirePermission("content:publish").catch(() => null);
    if (!publisher) return { status: "error", message: "Your role can prepare albums but not publish them. Save it as a draft for someone who can.", values };
  }

  const saved = await saveAlbum(id, { ...parsed.data, slug: slugify(parsed.data.slug || parsed.data.title) || "album" });
  await recordAudit({ actorUserId: user.id, action: id ? "updated" : "created", entityType: "gallery_album", entityId: saved.id, note: parsed.data.title });
  revalidatePath("/gallery");
  redirect(`/gallery/${saved.id}?saved=1`);
}

export async function deleteAlbumAction(formData: FormData): Promise<void> {
  const user = await requirePermission("content:write");
  const id = text(formData, "id");
  const album = await getAlbum(id);
  if (!album) redirect("/gallery");
  await deleteAlbum(id);
  await recordAudit({ actorUserId: user.id, action: "deleted", entityType: "gallery_album", entityId: id, note: album.title });
  revalidatePath("/gallery");
  redirect("/gallery?deleted=1");
}

/** The photographs ticked in the "add" panel. */
export async function addAlbumImagesAction(formData: FormData): Promise<void> {
  await requirePermission("content:write");
  const albumId = text(formData, "albumId");
  const mediaIds = formData.getAll("mediaIds").map(String).filter(Boolean);
  if (mediaIds.length > 0) await addAlbumImages(albumId, mediaIds);
  revalidatePath(`/gallery/${albumId}`);
}

export async function updateAlbumImageAction(formData: FormData): Promise<void> {
  await requirePermission("content:write");
  const albumId = text(formData, "albumId");
  await updateAlbumImage(albumId, text(formData, "imageId"), text(formData, "caption").slice(0, 300) || null);
  revalidatePath(`/gallery/${albumId}`);
}

export async function removeAlbumImageAction(formData: FormData): Promise<void> {
  await requirePermission("content:write");
  const albumId = text(formData, "albumId");
  await removeAlbumImage(albumId, text(formData, "imageId"));
  revalidatePath(`/gallery/${albumId}`);
}

export async function moveAlbumImageAction(formData: FormData): Promise<void> {
  await requirePermission("content:write");
  const albumId = text(formData, "albumId");
  const direction = text(formData, "direction");
  if (direction !== "up" && direction !== "down") return;
  await moveAlbumImage(albumId, text(formData, "imageId"), direction);
  revalidatePath(`/gallery/${albumId}`);
}
