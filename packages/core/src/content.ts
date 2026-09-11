import "server-only";

import { cache } from "react";

import { ContentStatus } from "@bass/db/enums";
import { db } from "@bass/db";

export const MEDIA_SELECT = {
  storageKey: true,
  alt: true,
  width: true,
  height: true,
  blurDataUrl: true,
} as const;

/** Only PUBLISHED rows whose publish date has arrived are ever public. */
export function publishedFilter() {
  return {
    status: ContentStatus.PUBLISHED,
    OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
  };
}

export const getLatestNews = cache(async (limit = 3) =>
  db.newsArticle.findMany({
    where: publishedFilter(),
    orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      category: true,
      publishedAt: true,
      featuredImage: { select: MEDIA_SELECT },
    },
  }),
);

export const getUpcomingEvents = cache(async (limit = 3) =>
  db.event.findMany({
    where: {
      status: ContentStatus.PUBLISHED,
      // An event that has already happened is not "upcoming"; multi-day events
      // stay listed until their end date passes.
      OR: [{ endDate: { gte: new Date() } }, { startDate: { gte: new Date() } }],
    },
    orderBy: { startDate: "asc" },
    take: limit,
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      startDate: true,
      endDate: true,
      startTime: true,
      endTime: true,
      location: true,
      image: { select: MEDIA_SELECT },
    },
  }),
);

export const getGalleryPreview = cache(async (limit = 6) =>
  db.galleryImage.findMany({
    where: { album: { status: ContentStatus.PUBLISHED } },
    orderBy: [{ album: { order: "asc" } }, { order: "asc" }],
    take: limit,
    select: {
      id: true,
      caption: true,
      album: { select: { slug: true, title: true } },
      media: { select: MEDIA_SELECT },
    },
  }),
);

export const getAcademicPrograms = cache(async (limit?: number) =>
  db.academicProgram.findMany({
    where: { status: ContentStatus.PUBLISHED },
    orderBy: { order: "asc" },
    ...(limit ? { take: limit } : {}),
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      level: true,
      image: { select: MEDIA_SELECT },
    },
  }),
);

export const getPageBySlug = cache(async (slug: string) =>
  db.page.findFirst({
    where: { slug, ...publishedFilter() },
    select: {
      id: true,
      slug: true,
      title: true,
      subtitle: true,
      body: true,
      seoTitle: true,
      seoDescription: true,
      canonicalUrl: true,
      noindex: true,
      updatedAt: true,
      ogImage: { select: MEDIA_SELECT },
    },
  }),
);

/** Formats a date for display. Uses a fixed locale so SSR and the client agree. */
export function formatDate(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateRange(start: Date, end: Date | null): string {
  if (!end || start.toDateString() === end.toDateString()) {
    return formatDate(start);
  }
  return `${formatDate(start)} – ${formatDate(end)}`;
}
