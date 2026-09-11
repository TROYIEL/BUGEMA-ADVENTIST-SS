import type { MetadataRoute } from "next";

import { ContentStatus } from "@bass/db/enums";
import { db } from "@bass/db";
import { publishedFilter } from "@bass/core/content";

/**
 * Sitemap.
 *
 * Route files like this are cached by default in Next 16; the school publishes
 * content continuously, so this one is rendered per request instead. It is a
 * handful of indexed queries.
 */
export const dynamic = "force-dynamic";

function siteUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  return `${base}${path}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [pages, news, events, albums, programs, departments] = await Promise.all([
    db.page.findMany({
      where: { ...publishedFilter(), noindex: false, NOT: { slug: "home" } },
      select: { slug: true, updatedAt: true },
    }),
    db.newsArticle.findMany({
      where: publishedFilter(),
      select: { slug: true, updatedAt: true },
    }),
    db.event.findMany({
      where: { status: ContentStatus.PUBLISHED },
      select: { slug: true, updatedAt: true },
    }),
    db.galleryAlbum.findMany({
      where: { status: ContentStatus.PUBLISHED },
      select: { slug: true, updatedAt: true },
    }),
    db.academicProgram.findMany({
      where: { status: ContentStatus.PUBLISHED },
      select: { slug: true, updatedAt: true },
    }),
    db.academicDepartment.findMany({
      where: { status: ContentStatus.PUBLISHED },
      select: { slug: true, updatedAt: true },
    }),
  ]);

  // Listing routes that always exist. /search and the applicant status lookup
  // are deliberately absent: neither has content worth indexing.
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: siteUrl("/admissions"), changeFrequency: "monthly", priority: 0.9 },
    { url: siteUrl("/admissions/apply"), changeFrequency: "monthly", priority: 0.9 },
    { url: siteUrl("/academics"), changeFrequency: "monthly", priority: 0.8 },
    { url: siteUrl("/academics/departments"), changeFrequency: "monthly", priority: 0.6 },
    { url: siteUrl("/academics/subjects"), changeFrequency: "monthly", priority: 0.6 },
    { url: siteUrl("/news"), changeFrequency: "weekly", priority: 0.7 },
    { url: siteUrl("/events"), changeFrequency: "weekly", priority: 0.7 },
    { url: siteUrl("/gallery"), changeFrequency: "monthly", priority: 0.6 },
    { url: siteUrl("/contact"), changeFrequency: "yearly", priority: 0.7 },
  ];

  return [
    ...staticRoutes,
    ...pages.map((row) => ({
      url: siteUrl(`/${row.slug}`),
      lastModified: row.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...news.map((row) => ({
      url: siteUrl(`/news/${row.slug}`),
      lastModified: row.updatedAt,
      changeFrequency: "yearly" as const,
      priority: 0.5,
    })),
    ...events.map((row) => ({
      url: siteUrl(`/events/${row.slug}`),
      lastModified: row.updatedAt,
      changeFrequency: "yearly" as const,
      priority: 0.5,
    })),
    ...albums.map((row) => ({
      url: siteUrl(`/gallery/${row.slug}`),
      lastModified: row.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
    ...programs.map((row) => ({
      url: siteUrl(`/academics/programmes/${row.slug}`),
      lastModified: row.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...departments.map((row) => ({
      url: siteUrl(`/academics/departments/${row.slug}`),
      lastModified: row.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
