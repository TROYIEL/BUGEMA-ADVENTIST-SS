import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/site/page-header";
import { Badge } from "@bass/ui/badge";
import { Button } from "@bass/ui/button";
import { EmptyState } from "@bass/ui/empty-state";
import { Input } from "@bass/ui/field";
import { Pagination, parsePageParam } from "@bass/ui/pagination";
import { SEARCH_TYPE_LABELS, searchContent } from "@bass/core/search";

export const dynamic = "force-dynamic";

const PER_PAGE = 10;

export const metadata: Metadata = {
  title: "Search",
  // Search result pages carry no unique content worth indexing.
  robots: { index: false, follow: true },
};

export default async function SearchPage(props: PageProps<"/search">) {
  const searchParams = await props.searchParams;
  const rawQuery = searchParams.q;
  const query = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery) ?? "";
  const page = parsePageParam(searchParams.page);

  const { results, total } = await searchContent(query, { page, perPage: PER_PAGE });
  const totalPages = Math.ceil(total / PER_PAGE);
  const hasQuery = query.trim().length >= 2;

  return (
    <main id="main" className="flex flex-1 flex-col">
      <PageHeader title="Search" crumbs={[{ label: "Search" }]} size="compact" />

      <div className="container-page py-12 md:py-14">
        {/* A GET form, so a search is a shareable, bookmarkable URL. */}
        <form role="search" action="/search" className="flex max-w-xl gap-3">
          <div className="flex-1">
            <label htmlFor="q" className="sr-only">
              Search this website
            </label>
            <Input
              id="q"
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Search pages, news, events and academics"
              autoFocus={!hasQuery}
            />
          </div>
          <Button type="submit" className="shrink-0">
            Search
          </Button>
        </form>

        <div className="mt-10">
          {!hasQuery ? (
            <p className="text-ink-600">
              Enter at least two characters to search the website.
            </p>
          ) : results.length === 0 ? (
            <EmptyState
              title={`No results for “${query}”`}
              description="Try a different or more general term, or browse using the navigation above."
            />
          ) : (
            <>
              <p className="text-sm text-ink-500" aria-live="polite">
                {total} {total === 1 ? "result" : "results"} for &ldquo;{query}&rdquo;
              </p>

              <ul className="mt-6 flex flex-col divide-y divide-line border-y border-line">
                {results.map((result) => (
                  <li key={`${result.entityType}-${result.entityId}`}>
                    <Link
                      href={result.url as never}
                      className="group flex flex-col gap-1.5 py-5 transition-colors"
                    >
                      <span className="flex items-center gap-3">
                        <Badge tone="navy">
                          {SEARCH_TYPE_LABELS[result.entityType] ?? result.entityType}
                        </Badge>
                        <span className="font-serif text-lg text-navy-900 group-hover:underline">
                          {result.title}
                        </span>
                      </span>
                      {result.excerpt ? (
                        <span className="line-clamp-2 text-[0.9375rem] leading-relaxed text-ink-600">
                          {result.excerpt}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>

              <Pagination
                currentPage={page}
                totalPages={totalPages}
                basePath="/search"
                searchParams={{ q: query }}
              />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
