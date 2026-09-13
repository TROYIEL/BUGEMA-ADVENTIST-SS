import "server-only";

import { randomUUID } from "node:crypto";

import { checksum } from "@bass/auth/crypto";
import { MediaVisibility } from "@bass/db/enums";
import { db } from "@bass/db";

import { MEDIA_SELECT } from "./content";
import { processImage } from "./media";
import { IMAGE_MIME_TYPES, validateUpload } from "./mime";
import { buildStorageKey, storage } from "./storage";

/**
 * Public images: the ones the website is allowed to show. Applicant documents
 * are PRIVATE and live in their own folder; they never appear here.
 */

/** Photographs larger than this are refused before any decoding happens. */
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

const IMAGE_CHOICE_SELECT = {
  id: true,
  originalName: true,
  folder: true,
  createdAt: true,
  ...MEDIA_SELECT,
} as const;

export type ImageChoice = {
  id: string;
  originalName: string;
  folder: string;
  createdAt: Date;
  storageKey: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  blurDataUrl: string | null;
};

/** Every public image, newest first — what an image picker offers. */
export async function listImageChoices(): Promise<ImageChoice[]> {
  return db.mediaAsset.findMany({
    where: {
      visibility: MediaVisibility.PUBLIC,
      mimeType: { in: [...IMAGE_MIME_TYPES] },
    },
    orderBy: { createdAt: "desc" },
    select: IMAGE_CHOICE_SELECT,
  });
}

export type StoreImageResult =
  | { ok: true; id: string }
  | { ok: false; message: string };

/**
 * Validates, re-encodes and stores a photograph as a PUBLIC asset. The file
 * is written before the row is created and removed again if that fails, so
 * storage and the database cannot disagree about what exists.
 */
export async function storePublicImage({
  file,
  folder,
  alt,
  uploadedById,
}: {
  file: File;
  /** Fixed by the caller, never by the upload: "hero", "gallery", … */
  folder: string;
  alt?: string | null;
  uploadedById: string;
}): Promise<StoreImageResult> {
  if (file.size === 0) return { ok: false, message: "Choose a photograph to upload." };
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, message: `The photograph is larger than the ${MAX_IMAGE_BYTES / (1024 * 1024)} MB limit.` };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const validation = validateUpload({
    buffer,
    allowedMimeTypes: IMAGE_MIME_TYPES,
    maxSizeBytes: MAX_IMAGE_BYTES,
    declaredMimeType: file.type,
  });
  if (!validation.ok) return { ok: false, message: validation.reason };

  let processed: Awaited<ReturnType<typeof processImage>>;
  try {
    processed = await processImage(buffer);
  } catch {
    return { ok: false, message: "The photograph could not be read. Try exporting it again." };
  }

  const id = randomUUID();
  const storageKey = buildStorageKey({ folder, id, extension: processed.extension });
  await storage.put(storageKey, processed.buffer, processed.mimeType);

  try {
    const asset = await db.mediaAsset.create({
      data: {
        storageKey,
        filename: `${id}.${processed.extension}`,
        originalName: file.name.replace(/[\u0000-\u001f\u007f\\/]/g, "").slice(0, 200) || "photograph",
        mimeType: processed.mimeType,
        size: processed.buffer.byteLength,
        width: processed.width,
        height: processed.height,
        blurDataUrl: processed.blurDataUrl,
        alt: alt?.trim() || null,
        folder,
        visibility: MediaVisibility.PUBLIC,
        checksum: checksum(processed.buffer),
        uploadedById,
      },
      select: { id: true },
    });
    return { ok: true, id: asset.id };
  } catch (error) {
    await storage.delete(storageKey).catch(() => undefined);
    throw error;
  }
}
