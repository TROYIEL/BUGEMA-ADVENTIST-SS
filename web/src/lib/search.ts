import "server-only";

import { ContentStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { richTextToPlainText, truncate } from "./sanitize";

/**
 * Site search over CMS content.
 *
 * Backed by the `search_documents` table and its trigger-maintained tsvector
 * (see the search_tsv_trigger migration). Keeping a denormalised index means
 * one indexed query rather than a UNION across six tables, and it lets pages,
 * news, events, programmes and albums be ranked against each other.
 */

export type SearchResult = {
  entityType: string;
  entityId: string;
  title: string;
  excerpt: string | null;
  url: string;
  rank: number;
};

export const SEARCH_TYPE_LABELS: Record<string, string> = {
  page: "Page",
  news: "News",
  event: "Event",
  album: "Gallery",
  program: "Academics",
  department: "Academics",
  subject: "Subject",
};

export async function searchContent(
  query: string,
  { page = 1, perPage = 10 }: { page?: number; perPage?: number } = {},
): Promise<{ results: SearchResult[]; total: number }> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return { results: [], total: 0 };

  const offset = (page - 1) * perPage;

  // `websearch_to_tsquery` accepts what people actually type — quoted phrases,
  // OR, leading minus — without throwing on malformed input the way
  // `to_tsquery` does. Parameterised, so the query string is never interpolated.
  const [results, countRows] = await Promise.all([
    db.$queryRaw<SearchResult[]>`
      SELECT
        "entityType",
        "entityId",
        "title",
        "excerpt",
        "url",
        ts_rank("tsv", websearch_to_tsquery('english', ${trimmed})) AS "rank"
      FROM "search_documents"
      WHERE "tsv" @@ websearch_to_tsquery('english', ${trimmed})
      ORDER BY "rank" DESC, "updatedAt" DESC
      LIMIT ${perPage} OFFSET ${offset}
    `,
    db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS "count"
      FROM "search_documents"
      WHERE "tsv" @@ websearch_to_tsquery('english', ${trimmed})
    `,
  ]);

  return {
    results,
    total: Number(countRows[0]?.count ?? 0),
  };
}

type IndexEntry = {
  entityType: string;
  entityId: string;
  title: string;
  excerpt?: string | null;
  keywords?: string | null;
  url: string;
};

/** Adds or refreshes one document in the index. */
export async function indexDocument(entry: IndexEntry): Promise<void> {
  await db.searchDocument.upsert({
    where: {
      entityType_entityId: {
        entityType: entry.entityType,
        entityId: entry.entityId,
      },
    },
    update: {
      title: entry.title,
      excerpt: entry.excerpt ?? null,
      keywords: entry.keywords ?? null,
      url: entry.url,
    },
    create: {
      entityType: entry.entityType,
      entityId: entry.entityId,
      title: entry.title,
      excerpt: entry.excerpt ?? null,
      keywords: entry.keywords ?? null,
      url: entry.url,
    },
  });
}

/** Removes a document — call when content is deleted or unpublished. */
export async function removeFromIndex(
  entityType: string,
  entityId: string,
): Promise<void> {
  await db.searchDocument
    .delete({ where: { entityType_entityId: { entityType, entityId } } })
    .catch(() => {
      // Already absent. Nothing to do.
    });
}

/**
 * Rebuilds the whole index from published content.
 *
 * Only published rows are indexed, so a draft can never surface through search
 * even though the row exists.
 */
export async function reindexAll(): Promise<number> {
  const published = {
    status: ContentStatus.PUBLISHED,
    OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
  };

  const [pages, news, events, albums, programs, departments, subjects] =
    await Promise.all([
      db.page.findMany({
        where: { ...published, NOT: { slug: "home" } },
        select: { id: true, slug: true, title: true, subtitle: true, body: true },
      }),
      db.newsArticle.findMany({
        where: published,
        select: { id: true, slug: true, title: true, excerpt: true, body: true, category: true },
      }),
      db.event.findMany({
        where: { status: ContentStatus.PUBLISHED },
        select: { id: true, slug: true, title: true, description: true, body: true, location: true },
      }),
      db.galleryAlbum.findMany({
        where: { status: ContentStatus.PUBLISHED },
        select: { id: true, slug: true, title: true, description: true, category: true },
      }),
      db.academicProgram.findMany({
        where: { status: ContentStatus.PUBLISHED },
        select: { id: true, slug: true, title: true, summary: true, body: true },
      }),
      db.academicDepartment.findMany({
        where: { status: ContentStatus.PUBLISHED },
        select: { id: true, slug: true, name: true, description: true, body: true },
      }),
      db.subject.findMany({
        where: { status: ContentStatus.PUBLISHED },
        select: { id: true, slug: true, name: true, description: true },
      }),
    ]);

  const entries: IndexEntry[] = [
    ...pages.map((row) => ({
      entityType: "page",
      entityId: row.id,
      title: row.title,
      excerpt: row.subtitle ?? truncate(richTextToPlainText(row.body), 240),
      keywords: richTextToPlainText(row.body).slice(0, 2000),
      url: `/${row.slug}`,
    })),
    ...news.map((row) => ({
      entityType: "news",
      entityId: row.id,
      title: row.title,
      excerpt: row.excerpt ?? truncate(richTextToPlainText(row.body), 240),
      keywords: [row.category, richTextToPlainText(row.body).slice(0, 2000)]
        .filter(Boolean)
        .join(" "),
      url: `/news/${row.slug}`,
    })),
    ...events.map((row) => ({
      entityType: "event",
      entityId: row.id,
      title: row.title,
      excerpt: row.description ?? truncate(richTextToPlainText(row.body), 240),
      keywords: [row.location, richTextToPlainText(row.body).slice(0, 2000)]
        .filter(Boolean)
        .join(" "),
      url: `/events/${row.slug}`,
    })),
    ...albums.map((row) => ({
      entityType: "album",
      entityId: row.id,
      title: row.title,
      excerpt: row.description,
      keywords: row.category,
      url: `/gallery/${row.slug}`,
    })),
    ...programs.map((row) => ({
      entityType: "program",
      entityId: row.id,
      title: row.title,
      excerpt: row.summary ?? truncate(richTextToPlainText(row.body), 240),
      keywords: richTextToPlainText(row.body).slice(0, 2000),
      url: `/academics/programmes/${row.slug}`,
    })),
    ...departments.map((row) => ({
      entityType: "department",
      entityId: row.id,
      title: row.name,
      excerpt: row.description ?? truncate(richTextToPlainText(row.body), 240),
      keywords: richTextToPlainText(row.body).slice(0, 2000),
      url: `/academics/departments/${row.slug}`,
    })),
    ...subjects.map((row) => ({
      entityType: "subject",
      entityId: row.id,
      title: row.name,
      excerpt: row.description,
      keywords: null,
      url: `/academics/subjects#${row.slug}`,
    })),
  ];

  // Clear first, so content that was unpublished or deleted since the last run
  // does not linger in the index.
  await db.searchDocument.deleteMany({});

  for (const entry of entries) {
    await indexDocument(entry);
  }

  return entries.length;
}
