"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requirePermission } from "@bass/auth/dal";
import { recordAudit } from "@bass/core/audit";
import {
  deleteMediaAsset,
  getMediaAsset,
  normaliseFolder,
  storePublicImage,
  updateMediaAsset,
} from "@bass/core/media-library";

/**
 * Staff actions on the media library. Uploads accept several photographs at
 * once and report per file, so one bad scan does not stop the rest.
 */

export type MediaFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Per-file outcomes from an upload, in order. */
  results?: { name: string; ok: boolean; message?: string }[];
  values?: Record<string, string>;
};

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function refresh() {
  revalidatePath("/media-library");
  revalidatePath("/hero-slides");
}

export async function uploadMedia(
  _previous: MediaFormState,
  formData: FormData,
): Promise<MediaFormState> {
  const user = await requirePermission("media:write");

  const folderChoice = text(formData, "folder");
  const folder = normaliseFolder(folderChoice === "__new" ? text(formData, "newFolder") : folderChoice);
  const alt = text(formData, "alt");
  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const values = { folder: folderChoice, newFolder: text(formData, "newFolder"), alt };

  if (files.length === 0) {
    return { status: "error", fieldErrors: { files: "Choose at least one photograph." }, values };
  }
  if (folderChoice === "__new" && !text(formData, "newFolder")) {
    return { status: "error", fieldErrors: { newFolder: "Name the new folder." }, values };
  }

  const results: NonNullable<MediaFormState["results"]> = [];
  for (const file of files) {
    const stored = await storePublicImage({
      file,
      folder,
      // One photograph can carry the description typed alongside it; a batch
      // gets its descriptions on each image's own page.
      alt: files.length === 1 ? alt : null,
      uploadedById: user.id,
    });
    results.push(stored.ok ? { name: file.name, ok: true } : { name: file.name, ok: false, message: stored.message });
    if (stored.ok) {
      await recordAudit({
        actorUserId: user.id,
        action: "created",
        entityType: "media_asset",
        entityId: stored.id,
        note: `${file.name} → ${folder}`,
      });
    }
  }

  refresh();
  const okCount = results.filter((result) => result.ok).length;
  return {
    status: okCount === results.length ? "success" : "error",
    message:
      okCount === results.length
        ? `${okCount} ${okCount === 1 ? "photograph" : "photographs"} added to "${folder}".`
        : `${okCount} of ${results.length} added. The rest were refused:`,
    results: results.filter((result) => !result.ok),
    values: okCount === results.length ? undefined : values,
  };
}

const detailsSchema = z.object({
  alt: z.string().trim().max(200, "Keep the description under 200 characters.").transform((v) => (v === "" ? null : v)),
  caption: z.string().trim().max(400, "Keep the caption under 400 characters.").transform((v) => (v === "" ? null : v)),
  folder: z.string().trim().min(1, "Choose a folder.").max(40),
});

export async function updateMedia(
  id: string,
  _previous: MediaFormState,
  formData: FormData,
): Promise<MediaFormState> {
  const user = await requirePermission("media:write");
  const folderChoice = text(formData, "folder");
  const values = {
    alt: text(formData, "alt"),
    caption: text(formData, "caption"),
    folder: folderChoice === "__new" ? text(formData, "newFolder") : folderChoice,
  };
  const parsed = detailsSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !(key in fieldErrors)) fieldErrors[key] = issue.message;
    }
    return { status: "error", fieldErrors, values };
  }

  const asset = await getMediaAsset(id);
  if (!asset) return { status: "error", message: "This photograph no longer exists." };

  await updateMediaAsset(id, parsed.data);
  await recordAudit({
    actorUserId: user.id,
    action: "updated",
    entityType: "media_asset",
    entityId: id,
    note: asset.originalName,
  });
  refresh();
  revalidatePath(`/media-library/${id}`);
  return { status: "success", message: "Saved." };
}

export async function deleteMedia(formData: FormData): Promise<void> {
  const user = await requirePermission("media:delete");
  const id = text(formData, "id");
  const asset = await getMediaAsset(id);
  if (!asset) redirect("/media-library");

  const result = await deleteMediaAsset(id);
  if (!result.ok) {
    // The page shows the usage; nothing was removed.
    redirect(`/media-library/${id}?inuse=1`);
  }

  await recordAudit({
    actorUserId: user.id,
    action: "deleted",
    entityType: "media_asset",
    entityId: id,
    note: asset.originalName,
  });
  refresh();
  redirect("/media-library?deleted=1");
}
