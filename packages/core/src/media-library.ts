import "server-only";

import { randomUUID } from "node:crypto";

import { checksum } from "@bass/auth/crypto";
import { MediaVisibility } from "@bass/db/enums";
import { db } from "@bass/db";

import type { Prisma } from "@bass/db/types";

import { MEDIA_SELECT } from "./content";
import { processImage } from "./media";
import { IMAGE_MIME_TYPES, validateUpload } from "./mime";
import { SETTINGS_REGISTRY, SETTING_KEYS, getSiteSettings } from "./settings";
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

// ---------------------------------------------------------------------------
// The library itself
// ---------------------------------------------------------------------------

export const MEDIA_PAGE_SIZE = 24;

/** Folders are plain labels chosen at upload; these are offered first. */
export const SUGGESTED_FOLDERS = [
  "campus",
  "academics",
  "student-life",
  "facilities",
  "gallery",
  "news",
  "events",
  "staff",
  "hero",
  "brand",
] as const;

const LIBRARY_SELECT = {
  id: true,
  originalName: true,
  mimeType: true,
  size: true,
  folder: true,
  caption: true,
  createdAt: true,
  updatedAt: true,
  uploadedBy: { select: { name: true } },
  ...MEDIA_SELECT,
} satisfies Prisma.MediaAssetSelect;

export type MediaAssetRow = Prisma.MediaAssetGetPayload<{ select: typeof LIBRARY_SELECT }>;

export type MediaFilters = { folder?: string; q?: string };

/** Only what the website may show: public assets. Applicant documents never appear. */
function libraryWhere(filters: MediaFilters): Prisma.MediaAssetWhereInput {
  const where: Prisma.MediaAssetWhereInput = { visibility: MediaVisibility.PUBLIC };
  if (filters.folder) where.folder = filters.folder;
  const q = filters.q?.trim();
  if (q) {
    where.OR = [
      { originalName: { contains: q, mode: "insensitive" } },
      { alt: { contains: q, mode: "insensitive" } },
      { caption: { contains: q, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listMediaAssets(
  filters: MediaFilters,
  page: number,
): Promise<{ rows: MediaAssetRow[]; total: number; totalPages: number }> {
  const where = libraryWhere(filters);
  const [rows, total] = await Promise.all([
    db.mediaAsset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * MEDIA_PAGE_SIZE,
      take: MEDIA_PAGE_SIZE,
      select: LIBRARY_SELECT,
    }),
    db.mediaAsset.count({ where }),
  ]);
  return { rows, total, totalPages: Math.max(1, Math.ceil(total / MEDIA_PAGE_SIZE)) };
}

/** Folders in use, with counts, plus the suggested ones not yet used. */
export async function listFolders(): Promise<{ name: string; count: number }[]> {
  const groups = await db.mediaAsset.groupBy({
    by: ["folder"],
    where: { visibility: MediaVisibility.PUBLIC },
    _count: { _all: true },
    orderBy: { folder: "asc" },
  });
  const used = groups.map((group) => ({ name: group.folder, count: group._count._all }));
  const missing = SUGGESTED_FOLDERS.filter((name) => !used.some((entry) => entry.name === name)).map(
    (name) => ({ name, count: 0 }),
  );
  return [...used, ...missing];
}

export async function getMediaAsset(id: string): Promise<MediaAssetRow | null> {
  return db.mediaAsset.findFirst({
    where: { id, visibility: MediaVisibility.PUBLIC },
    select: LIBRARY_SELECT,
  });
}

/** Folder names are labels, but they also form storage paths for new uploads. */
export function normaliseFolder(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "uploads";
}

export async function updateMediaAsset(
  id: string,
  input: { alt: string | null; caption: string | null; folder: string },
): Promise<void> {
  await db.mediaAsset.update({
    where: { id },
    data: { alt: input.alt, caption: input.caption, folder: normaliseFolder(input.folder) },
  });
}

export type MediaUsage = { where: string; label: string }[];

/**
 * Everywhere an image is shown from. Deleting an image that is in use would
 * silently blank part of the website, so the library refuses until each of
 * these has been changed.
 */
export async function mediaUsage(id: string): Promise<MediaUsage> {
  const [asset, settings] = await Promise.all([
    db.mediaAsset.findUnique({
      where: { id },
      select: {
        pageOgImages: { select: { title: true } },
        featureMedia: { select: { title: true } },
        highlightMedia: { select: { label: true } },
        newsImages: { select: { title: true } },
        eventImages: { select: { title: true } },
        albumCovers: { select: { title: true } },
        galleryImages: { select: { album: { select: { title: true } } } },
        staffPhotos: { select: { name: true } },
        departmentImages: { select: { name: true } },
        programImages: { select: { title: true } },
        heroSlideImages: { select: { title: true } },
        heroSlideCollageOne: { select: { title: true } },
        heroSlideCollageTwo: { select: { title: true } },
        heroSlideCollageThree: { select: { title: true } },
      },
    }),
    getSiteSettings(),
  ]);
  if (!asset) return [];

  const usage: MediaUsage = [];
  const add = (where: string, rows: { label: string }[]) => {
    for (const row of rows) usage.push({ where, label: row.label });
  };
  add("Page (social image)", asset.pageOgImages.map((r) => ({ label: r.title })));
  add("Homepage feature", asset.featureMedia.map((r) => ({ label: r.title })));
  add("Homepage highlight", asset.highlightMedia.map((r) => ({ label: r.label })));
  add("News", asset.newsImages.map((r) => ({ label: r.title })));
  add("Event", asset.eventImages.map((r) => ({ label: r.title })));
  add("Gallery album cover", asset.albumCovers.map((r) => ({ label: r.title })));
  add("Gallery", asset.galleryImages.map((r) => ({ label: r.album.title })));
  add("Staff", asset.staffPhotos.map((r) => ({ label: r.name })));
  add("Department", asset.departmentImages.map((r) => ({ label: r.name })));
  add("Programme", asset.programImages.map((r) => ({ label: r.title })));
  add("Hero slide", [
    ...asset.heroSlideImages,
    ...asset.heroSlideCollageOne,
    ...asset.heroSlideCollageTwo,
    ...asset.heroSlideCollageThree, 
  ].map((r) => ({ label: r.title })));

  for (const key of SETTING_KEYS) {
    if (SETTINGS_REGISTRY[key].type === "image" && settings[key].value === id) {
      usage.push({ where: "Site setting", label: SETTINGS_REGISTRY[key].label });
    }
  }
  return usage;
}

export type DeleteMediaResult = { ok: true } | { ok: false; usage: MediaUsage };

/** Removes the row and the file. Refuses while anything still shows the image. */
export async function deleteMediaAsset(id: string): Promise<DeleteMediaResult> {
  const usage = await mediaUsage(id);
  if (usage.length > 0) return { ok: false, usage };

  const asset = await db.mediaAsset.findFirst({
    where: { id, visibility: MediaVisibility.PUBLIC },
    select: { storageKey: true },
  });
  if (!asset) return { ok: true };

  await db.mediaAsset.delete({ where: { id } });
  await storage.delete(asset.storageKey).catch(() => undefined);
  return { ok: true };
}
