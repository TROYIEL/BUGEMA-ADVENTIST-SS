import "server-only";

import { AnnouncementPlacement, ContentStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

import { MEDIA_SELECT } from "./content";
import { richTextToPlainText, sanitizeRichText, truncate } from "./sanitize";
import { indexDocument, removeFromIndex } from "./search";

export * from "./content-shared";

/**
 * Website content, from the staff side: pages, news, events, gallery albums
 * and announcements. Rich text is sanitised on the way in; anything that is
 * published is put in the search index and anything that is not is taken
 * out, so a draft can never surface through search.
 */

// ---------------------------------------------------------------------------
// Slugs
// ---------------------------------------------------------------------------

/** "Sports Day 2026!" -> "sports-day-2026". Keeps "/" so pages can nest. */
export function slugify(input: string, { allowSlashes = false } = {}): string {
  const slug = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(allowSlashes ? /[^a-z0-9/]+/g : /[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "")
    .replace(/\/-|-\//g, "/")
    .replace(/\/+/g, "/")
    .replace(/(^\/|\/$)/g, "");
  return slug.slice(0, 120);
}

type SlugTable = "page" | "newsArticle" | "event" | "galleryAlbum" | "academicProgram" | "academicDepartment" | "subject";

async function slugTaken(table: SlugTable, slug: string, exceptId: string | null): Promise<boolean> {
  const where = { slug, NOT: exceptId ? { id: exceptId } : undefined };
  switch (table) {
    case "page":
      return (await db.page.count({ where })) > 0;
    case "newsArticle":
      return (await db.newsArticle.count({ where })) > 0;
    case "event":
      return (await db.event.count({ where })) > 0;
    case "galleryAlbum":
      return (await db.galleryAlbum.count({ where })) > 0;
    case "academicProgram":
      return (await db.academicProgram.count({ where })) > 0;
    case "academicDepartment":
      return (await db.academicDepartment.count({ where })) > 0;
    case "subject":
      return (await db.subject.count({ where })) > 0;
  }
}

/** The slug as given if free, otherwise with -2, -3 … until one is. */
export async function uniqueSlug(table: SlugTable, wanted: string, exceptId: string | null): Promise<string> {
  let candidate = wanted;
  for (let n = 2; await slugTaken(table, candidate, exceptId); n++) {
    candidate = `${wanted}-${n}`;
  }
  return candidate;
}

// ---------------------------------------------------------------------------
// Listing (shared shape for the tables)
// ---------------------------------------------------------------------------

export type ContentListRow = {
  id: string;
  title: string;
  slug: string | null;
  status: ContentStatus;
  meta: string | null;
  updatedAt: Date;
  publishedAt: Date | null;
};

export type ContentFilters = { status?: ContentStatus; q?: string };

function statusFilter(filters: ContentFilters) {
  const where: { status?: ContentStatus; OR?: unknown[] } = {};
  if (filters.status) where.status = filters.status;
  return where;
}

function textSearch(q: string | undefined, fields: string[]) {
  const trimmed = q?.trim();
  if (!trimmed) return undefined;
  return fields.map((field) => ({ [field]: { contains: trimmed, mode: "insensitive" as const } }));
}

/** Whether a published row is actually visible yet (pages and news can be dated ahead). */
export function isLive(row: { status: ContentStatus; publishedAt?: Date | null }): boolean {
  return row.status === ContentStatus.PUBLISHED && (!row.publishedAt || row.publishedAt <= new Date());
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

const PAGE_SELECT = {
  id: true,
  slug: true,
  title: true,
  subtitle: true,
  body: true,
  status: true,
  isSystem: true,
  seoTitle: true,
  seoDescription: true,
  ogImageId: true,
  canonicalUrl: true,
  noindex: true,
  publishedAt: true,
  updatedAt: true,
  ogImage: { select: MEDIA_SELECT },
} satisfies Prisma.PageSelect;

export type PageRow = Prisma.PageGetPayload<{ select: typeof PAGE_SELECT }>;

export async function listPages(filters: ContentFilters): Promise<ContentListRow[]> {
  const rows = await db.page.findMany({
    where: { ...statusFilter(filters), OR: textSearch(filters.q, ["title", "slug"]) },
    orderBy: [{ isSystem: "desc" }, { slug: "asc" }],
    select: { id: true, title: true, slug: true, status: true, isSystem: true, updatedAt: true, publishedAt: true },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    meta: row.isSystem ? "Part of the site's structure" : null,
    updatedAt: row.updatedAt,
    publishedAt: row.publishedAt,
  }));
}

export async function getPage(id: string): Promise<PageRow | null> {
  return db.page.findUnique({ where: { id }, select: PAGE_SELECT });
}

export type PageInput = {
  title: string;
  slug: string;
  subtitle: string | null;
  body: string | null;
  status: ContentStatus;
  publishedAt: Date | null;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageId: string | null;
  canonicalUrl: string | null;
  noindex: boolean;
};

export async function savePage(id: string | null, input: PageInput): Promise<{ id: string }> {
  const existing = id ? await db.page.findUnique({ where: { id }, select: { isSystem: true, slug: true } }) : null;
  const data = {
    ...input,
    // A system page's address is wired into the site; it keeps it.
    slug: existing?.isSystem ? existing.slug : await uniqueSlug("page", input.slug, id),
    body: input.body ? sanitizeRichText(input.body) : null,
    publishedAt: input.status === ContentStatus.PUBLISHED ? (input.publishedAt ?? new Date()) : input.publishedAt,
  };
  const saved = id
    ? await db.page.update({ where: { id }, data, select: { id: true, slug: true, title: true, subtitle: true, body: true, status: true, publishedAt: true } })
    : await db.page.create({ data, select: { id: true, slug: true, title: true, subtitle: true, body: true, status: true, publishedAt: true } });

  if (isLive(saved) && saved.slug !== "home") {
    await indexDocument({
      entityType: "page",
      entityId: saved.id,
      title: saved.title,
      excerpt: saved.subtitle ?? truncate(richTextToPlainText(saved.body), 240),
      keywords: richTextToPlainText(saved.body).slice(0, 2000),
      url: `/${saved.slug}`,
    });
  } else {
    await removeFromIndex("page", saved.id);
  }
  return { id: saved.id };
}

export async function deletePage(id: string): Promise<{ ok: boolean; reason?: string }> {
  const page = await db.page.findUnique({ where: { id }, select: { isSystem: true } });
  if (!page) return { ok: true };
  if (page.isSystem) return { ok: false, reason: "This page is part of the site's structure; unpublish it instead." };
  await db.page.delete({ where: { id } });
  await removeFromIndex("page", id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// News
// ---------------------------------------------------------------------------

const NEWS_SELECT = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  body: true,
  category: true,
  status: true,
  isFeatured: true,
  publishedAt: true,
  seoTitle: true,
  seoDescription: true,
  featuredImageId: true,
  updatedAt: true,
  featuredImage: { select: MEDIA_SELECT },
  author: { select: { name: true } },
} satisfies Prisma.NewsArticleSelect;

export type NewsRow = Prisma.NewsArticleGetPayload<{ select: typeof NEWS_SELECT }>;

export async function listNews(filters: ContentFilters): Promise<ContentListRow[]> {
  const rows = await db.newsArticle.findMany({
    where: { ...statusFilter(filters), OR: textSearch(filters.q, ["title", "category"]) },
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    select: { id: true, title: true, slug: true, status: true, category: true, isFeatured: true, updatedAt: true, publishedAt: true },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    meta: [row.category, row.isFeatured ? "Featured" : null].filter(Boolean).join(" · ") || null,
    updatedAt: row.updatedAt,
    publishedAt: row.publishedAt,
  }));
}

export async function listNewsCategories(): Promise<string[]> {
  const rows = await db.newsArticle.findMany({
    where: { category: { not: null } },
    distinct: ["category"],
    select: { category: true },
    orderBy: { category: "asc" },
  });
  return rows.map((row) => row.category!).filter(Boolean);
}

export async function getNews(id: string): Promise<NewsRow | null> {
  return db.newsArticle.findUnique({ where: { id }, select: NEWS_SELECT });
}

export type NewsInput = {
  title: string;
  slug: string;
  excerpt: string | null;
  body: string | null;
  category: string | null;
  status: ContentStatus;
  isFeatured: boolean;
  publishedAt: Date | null;
  seoTitle: string | null;
  seoDescription: string | null;
  featuredImageId: string | null;
};

export async function saveNews(id: string | null, input: NewsInput, authorId: string): Promise<{ id: string }> {
  const data = {
    ...input,
    slug: await uniqueSlug("newsArticle", input.slug, id),
    body: input.body ? sanitizeRichText(input.body) : null,
    publishedAt: input.status === ContentStatus.PUBLISHED ? (input.publishedAt ?? new Date()) : input.publishedAt,
  };
  const select = { id: true, slug: true, title: true, excerpt: true, body: true, category: true, status: true, publishedAt: true };
  const saved = id
    ? await db.newsArticle.update({ where: { id }, data, select })
    : await db.newsArticle.create({ data: { ...data, authorId }, select });

  if (isLive(saved)) {
    await indexDocument({
      entityType: "news",
      entityId: saved.id,
      title: saved.title,
      excerpt: saved.excerpt ?? truncate(richTextToPlainText(saved.body), 240),
      keywords: [saved.category, richTextToPlainText(saved.body).slice(0, 2000)].filter(Boolean).join(" "),
      url: `/news/${saved.slug}`,
    });
  } else {
    await removeFromIndex("news", saved.id);
  }
  return { id: saved.id };
}

export async function deleteNews(id: string): Promise<void> {
  await db.newsArticle.delete({ where: { id } });
  await removeFromIndex("news", id);
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

const EVENT_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  body: true,
  startDate: true,
  endDate: true,
  startTime: true,
  endTime: true,
  location: true,
  registrationUrl: true,
  status: true,
  isFeatured: true,
  seoTitle: true,
  seoDescription: true,
  imageId: true,
  updatedAt: true,
  image: { select: MEDIA_SELECT },
} satisfies Prisma.EventSelect;

export type EventRow = Prisma.EventGetPayload<{ select: typeof EVENT_SELECT }>;

export async function listEvents(filters: ContentFilters): Promise<ContentListRow[]> {
  const rows = await db.event.findMany({
    where: { ...statusFilter(filters), OR: textSearch(filters.q, ["title", "location"]) },
    orderBy: [{ startDate: "desc" }],
    select: { id: true, title: true, slug: true, status: true, startDate: true, location: true, isFeatured: true, updatedAt: true },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    meta: [row.startDate.toISOString().slice(0, 10), row.location, row.isFeatured ? "Featured" : null].filter(Boolean).join(" · "),
    updatedAt: row.updatedAt,
    publishedAt: null,
  }));
}

export async function getEvent(id: string): Promise<EventRow | null> {
  return db.event.findUnique({ where: { id }, select: EVENT_SELECT });
}

export type EventInput = {
  title: string;
  slug: string;
  description: string | null;
  body: string | null;
  startDate: Date;
  endDate: Date | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  registrationUrl: string | null;
  status: ContentStatus;
  isFeatured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  imageId: string | null;
};

export async function saveEvent(id: string | null, input: EventInput): Promise<{ id: string }> {
  const data = {
    ...input,
    slug: await uniqueSlug("event", input.slug, id),
    body: input.body ? sanitizeRichText(input.body) : null,
  };
  const select = { id: true, slug: true, title: true, description: true, body: true, location: true, status: true };
  const saved = id
    ? await db.event.update({ where: { id }, data, select })
    : await db.event.create({ data, select });

  if (saved.status === ContentStatus.PUBLISHED) {
    await indexDocument({
      entityType: "event",
      entityId: saved.id,
      title: saved.title,
      excerpt: saved.description ?? truncate(richTextToPlainText(saved.body), 240),
      keywords: [saved.location, richTextToPlainText(saved.body).slice(0, 2000)].filter(Boolean).join(" "),
      url: `/events/${saved.slug}`,
    });
  } else {
    await removeFromIndex("event", saved.id);
  }
  return { id: saved.id };
}

export async function deleteEvent(id: string): Promise<void> {
  await db.event.delete({ where: { id } });
  await removeFromIndex("event", id);
}

// ---------------------------------------------------------------------------
// Gallery
// ---------------------------------------------------------------------------

const ALBUM_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  category: true,
  status: true,
  order: true,
  coverImageId: true,
  updatedAt: true,
  coverImage: { select: MEDIA_SELECT },
  images: {
    orderBy: { order: "asc" },
    select: {
      id: true,
      caption: true,
      order: true,
      media: { select: { id: true, originalName: true, ...MEDIA_SELECT } },
    },
  },
} satisfies Prisma.GalleryAlbumSelect;

export type AlbumRow = Prisma.GalleryAlbumGetPayload<{ select: typeof ALBUM_SELECT }>;

export async function listAlbums(filters: ContentFilters): Promise<ContentListRow[]> {
  const rows = await db.galleryAlbum.findMany({
    where: { ...statusFilter(filters), OR: textSearch(filters.q, ["title", "category"]) },
    orderBy: [{ order: "asc" }, { updatedAt: "desc" }],
    select: { id: true, title: true, slug: true, status: true, category: true, updatedAt: true, _count: { select: { images: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    meta: [row.category, `${row._count.images} ${row._count.images === 1 ? "photograph" : "photographs"}`].filter(Boolean).join(" · "),
    updatedAt: row.updatedAt,
    publishedAt: null,
  }));
}

export async function getAlbum(id: string): Promise<AlbumRow | null> {
  return db.galleryAlbum.findUnique({ where: { id }, select: ALBUM_SELECT });
}

export type AlbumInput = {
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  status: ContentStatus;
  coverImageId: string | null;
};

async function syncAlbumIndex(id: string): Promise<void> {
  const album = await db.galleryAlbum.findUnique({
    where: { id },
    select: { id: true, slug: true, title: true, description: true, category: true, status: true },
  });
  if (!album) return;
  if (album.status === ContentStatus.PUBLISHED) {
    await indexDocument({
      entityType: "album",
      entityId: album.id,
      title: album.title,
      excerpt: album.description,
      keywords: album.category,
      url: `/gallery/${album.slug}`,
    });
  } else {
    await removeFromIndex("album", album.id);
  }
}

export async function saveAlbum(id: string | null, input: AlbumInput): Promise<{ id: string }> {
  const data = { ...input, slug: await uniqueSlug("galleryAlbum", input.slug, id) };
  const saved = id
    ? await db.galleryAlbum.update({ where: { id }, data, select: { id: true } })
    : await db.galleryAlbum.create({
        data: { ...data, order: ((await db.galleryAlbum.aggregate({ _max: { order: true } }))._max.order ?? 0) + 10 },
        select: { id: true },
      });
  await syncAlbumIndex(saved.id);
  return saved;
}

export async function deleteAlbum(id: string): Promise<void> {
  await db.galleryAlbum.delete({ where: { id } });
  await removeFromIndex("album", id);
}

/** Adds photographs to the end of an album; ones already in it are skipped. */
export async function addAlbumImages(albumId: string, mediaIds: string[]): Promise<number> {
  const existing = await db.galleryImage.findMany({ where: { albumId }, select: { mediaId: true, order: true } });
  const present = new Set(existing.map((row) => row.mediaId));
  const fresh = mediaIds.filter((mediaId, index) => !present.has(mediaId) && mediaIds.indexOf(mediaId) === index);
  let order = Math.max(0, ...existing.map((row) => row.order));
  if (fresh.length === 0) return 0;
  await db.galleryImage.createMany({
    data: fresh.map((mediaId) => ({ albumId, mediaId, order: (order += 10) })),
  });
  // The first photograph becomes the cover if the album has none.
  await db.galleryAlbum.updateMany({ where: { id: albumId, coverImageId: null }, data: { coverImageId: fresh[0] } });
  return fresh.length;
}

export async function updateAlbumImage(albumId: string, imageId: string, caption: string | null): Promise<void> {
  await db.galleryImage.updateMany({ where: { id: imageId, albumId }, data: { caption } });
}

export async function removeAlbumImage(albumId: string, imageId: string): Promise<void> {
  await db.galleryImage.deleteMany({ where: { id: imageId, albumId } });
}

export async function moveAlbumImage(albumId: string, imageId: string, direction: "up" | "down"): Promise<void> {
  const images = await db.galleryImage.findMany({ where: { albumId }, orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true } });
  const index = images.findIndex((image) => image.id === imageId);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= images.length) return;
  [images[index], images[target]] = [images[target]!, images[index]!];
  await db.$transaction(images.map((image, position) => db.galleryImage.update({ where: { id: image.id }, data: { order: (position + 1) * 10 } })));
}

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

const ANNOUNCEMENT_SELECT = {
  id: true,
  title: true,
  body: true,
  linkLabel: true,
  linkHref: true,
  placement: true,
  priority: true,
  startsAt: true,
  endsAt: true,
  isActive: true,
  updatedAt: true,
} satisfies Prisma.AnnouncementSelect;

export type AnnouncementRow = Prisma.AnnouncementGetPayload<{ select: typeof ANNOUNCEMENT_SELECT }>;

export async function listAnnouncements(): Promise<AnnouncementRow[]> {
  return db.announcement.findMany({
    orderBy: [{ isActive: "desc" }, { priority: "desc" }, { createdAt: "desc" }],
    select: ANNOUNCEMENT_SELECT,
  });
}

export type AnnouncementInput = {
  title: string;
  body: string | null;
  linkLabel: string | null;
  linkHref: string | null;
  placement: AnnouncementPlacement;
  priority: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
};

export async function saveAnnouncement(id: string | null, input: AnnouncementInput): Promise<{ id: string }> {
  if (id) {
    await db.announcement.update({ where: { id }, data: input });
    return { id };
  }
  return db.announcement.create({ data: input, select: { id: true } });
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await db.announcement.delete({ where: { id } });
}

/** Whether an announcement is showing right now. */
export function isAnnouncementLive(row: Pick<AnnouncementRow, "isActive" | "startsAt" | "endsAt">, now = new Date()): boolean {
  if (!row.isActive) return false;
  if (row.startsAt && row.startsAt > now) return false;
  if (row.endsAt && row.endsAt < now) return false;
  return true;
}
