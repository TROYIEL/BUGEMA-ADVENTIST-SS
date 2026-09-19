import Link from "next/link";

import { cn } from "./cn";

/**
 * Page-number navigation.
 *
 * Rendered as real links so a page can be opened in a new tab, shared, and
 * crawled — which a button-driven pager gives up.
 */
export function Pagination({
  currentPage,
  totalPages,
  basePath,
  searchParams = {},
}: {
  currentPage: number;
  totalPages: number;
  basePath: string;
  /** Preserved across pages, so filters survive pagination. */
  searchParams?: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  function hrefFor(page: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value) params.set(key, value);
    }
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return `${basePath}${query ? `?${query}` : ""}`;
  }

  // A sliding window keeps the control a fixed width however many pages exist.
  const windowSize = 2;
  const pages: (number | "gap")[] = [];
  for (let page = 1; page <= totalPages; page++) {
    const inWindow =
      page === 1 ||
      page === totalPages ||
      Math.abs(page - currentPage) <= windowSize;

    if (inWindow) {
      pages.push(page);
    } else if (pages[pages.length - 1] !== "gap") {
      pages.push("gap");
    }
  }

  return (
    <nav aria-label="Pagination" className="mt-12 flex justify-center">
      <ul className="flex flex-wrap items-center gap-1">
        <li>
          {currentPage > 1 ? (
            <Link
              href={hrefFor(currentPage - 1) as never}
              rel="prev"
              className="flex h-10 items-center rounded-full px-4 text-sm font-semibold text-navy-800 hover:bg-navy-50"
            >
              Previous
            </Link>
          ) : (
            <span aria-disabled="true" className="flex h-10 items-center px-4 text-sm font-semibold text-ink-400">
              Previous
            </span>
          )}
        </li>

        {pages.map((page, index) =>
          page === "gap" ? (
            <li key={`gap-${index}`} aria-hidden="true" className="px-2 text-ink-400">
              …
            </li>
          ) : (
            <li key={page}>
              <Link
                href={hrefFor(page) as never}
                aria-current={page === currentPage ? "page" : undefined}
                className={cn(
                  "grid h-10 min-w-10 place-items-center rounded-full px-3 text-sm font-semibold transition-colors",
                  page === currentPage
                    ? "bg-navy-800 text-white"
                    : "text-navy-800 hover:bg-navy-50",
                )}
              >
                <span className="sr-only">Page </span>
                {page}
              </Link>
            </li>
          ),
        )}

        <li>
          {currentPage < totalPages ? (
            <Link
              href={hrefFor(currentPage + 1) as never}
              rel="next"
              className="flex h-10 items-center rounded-full px-4 text-sm font-semibold text-navy-800 hover:bg-navy-50"
            >
              Next
            </Link>
          ) : (
            <span aria-disabled="true" className="flex h-10 items-center px-4 text-sm font-semibold text-ink-400">
              Next
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}

/** Reads and clamps a `?page=` parameter. */
export function parsePageParam(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number(raw ?? 1);
  return Number.isInteger(page) && page > 0 ? page : 1;
}
