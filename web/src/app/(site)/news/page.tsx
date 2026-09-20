import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, ViewTransition } from "react";

import { NewsCard } from "@/components/cards/content-cards";
import { CardGridSkeleton } from "@/components/site/list-skeleton";
import { PageHeader } from "@/components/site/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination, parsePageParam } from "@/components/ui/pagination";
import { MEDIA_SELECT, publishedFilter } from "@/lib/content";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const PER_PAGE = 9;

export const metadata: Metadata = {
  title: "News",
  alternates: { canonical: "/news" },
};

export default async function NewsIndexPage(props: PageProps<"/news">) {
  const searchParams = await props.searchParams;
  const page = parsePageParam(searchParams.page);
  const categoryParam = searchParams.category;
  const category = Array.isArray(categoryParam) ? categoryParam[0] : categoryParam;

  // The header renders immediately; the list streams in behind a skeleton.
  // The boundary sits inside the page, so a 404 elsewhere is still a real 404.
  return (
    <main id="main" className="flex flex-1 flex-col">
      <PageHeader title="News" crumbs={[{ label: "News" }]} />
      <Suspense key={`${page}:${category ?? ""}`} fallback={<CardGridSkeleton count={PER_PAGE} label="Loading news" />}>
        <NewsList page={page} category={category} />
      </Suspense>
    </main>
  );
}

async function NewsList({ page, category }: { page: number; category: string | undefined }) {
  const where = {
    ...publishedFilter(),
    ...(category ? { category } : {}),
  };

  const [articles, total, categories] = await Promise.all([
    db.newsArticle.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
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
    db.newsArticle.count({ where }),
    db.newsArticle.findMany({
      where: publishedFilter(),
      distinct: ["category"],
      select: { category: true },
    }),
  ]);

  const totalPages = Math.ceil(total / PER_PAGE);
  const availableCategories = categories
    .map((row) => row.category)
    .filter((value): value is string => Boolean(value));

  return (
    <ViewTransition enter="fade-in" default="none">
      <div className="container-page py-14 md:py-16">
        {availableCategories.length > 0 ? (
          <nav aria-label="Filter news by category" className="mb-10">
            <ul className="flex flex-wrap gap-2">
              <li>
                <Link
                  href="/news"
                  aria-current={!category ? "true" : undefined}
                  className={`inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold ${
                    !category
                      ? "bg-navy-800 text-white"
                      : "bg-surface-sunken text-navy-800 hover:bg-navy-50"
                  }`}
                >
                  All news
                </Link>
              </li>
              {availableCategories.map((value) => (
                <li key={value}>
                  <Link
                    href={`/news?category=${encodeURIComponent(value)}` as never}
                    aria-current={category === value ? "true" : undefined}
                    className={`inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold ${
                      category === value
                        ? "bg-navy-800 text-white"
                        : "bg-surface-sunken text-navy-800 hover:bg-navy-50"
                    }`}
                  >
                    {value}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        {articles.length === 0 ? (
          <EmptyState
            title="No news has been published yet"
            description="School news and announcements will appear here once they are published."
          />
        ) : (
          <>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((article) => (
                <li key={article.id}>
                  <NewsCard
                    article={article}
                    headingLevel="h2"
                    sizes="(min-width: 1024px) 32vw, (min-width: 640px) 48vw, 100vw"
                  />
                </li>
              ))}
            </ul>

            <Pagination
              currentPage={page}
              totalPages={totalPages}
              basePath="/news"
              searchParams={{ category }}
            />
          </>
        )}
      </div>
    </ViewTransition>
  );
}
