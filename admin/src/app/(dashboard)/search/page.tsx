import type { Metadata } from "next";
import Link from "next/link";

import { requirePagePermission } from "@/lib/auth/dal";
import { searchEverything } from "@/lib/search-admin";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Search" };

/** Results for the top bar's search box, grouped by module. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requirePagePermission("admin:access");
  const { q = "" } = await searchParams;
  const query = q.trim();
  const sections = query ? await searchEverything(query, user.role) : [];
  const total = sections.reduce((sum, section) => sum + section.hits.length, 0);

  return (
    <div className="container-admin max-w-4xl py-8">
      <header>
        <h1 className="text-2xl font-semibold text-navy-900">Search</h1>
        <p className="mt-1 text-sm text-ink-600">
          Applications by name or reference, enquiries, pages, news, events, staff and users — whatever you may open.
        </p>
      </header>

      <form role="search" action="/search" className="mt-6 flex gap-2">
        <label htmlFor="search-q" className="sr-only">Search</label>
        <Input id="search-q" type="search" name="q" defaultValue={query} placeholder="Name, reference number, subject, title…" autoFocus className="flex-1" />
        <Button type="submit">Search</Button>
      </form>

      {query ? (
        <p className="mt-6 text-sm text-ink-600" aria-live="polite">
          {total === 0 ? (
            <>Nothing matches <strong className="text-navy-900">“{query}”</strong>.</>
          ) : (
            <>{total} {total === 1 ? "match" : "matches"} for <strong className="text-navy-900">“{query}”</strong></>
          )}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-6">
        {sections.map((section) => (
          <section key={section.key} aria-labelledby={`search-${section.key}`} className="rounded-lg border border-line bg-white">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <h2 id={`search-${section.key}`} className="text-xs font-semibold uppercase tracking-wide text-ink-600">{section.label}</h2>
              {section.moreHref ? (
                <Link href={section.moreHref as never} className="text-xs font-semibold text-navy-800 hover:underline">
                  All matches →
                </Link>
              ) : null}
            </div>
            <ul className="divide-y divide-line">
              {section.hits.map((hit) => (
                <li key={hit.href}>
                  <Link href={hit.href as never} className="flex flex-col gap-0.5 px-4 py-3 hover:bg-navy-50/60">
                    <span className="font-medium text-navy-900">{hit.title}</span>
                    {hit.meta ? <span className="text-xs text-ink-600">{hit.meta}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
