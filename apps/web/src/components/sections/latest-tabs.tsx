"use client";

import Link from "next/link";
import Image from "next/image";
import { useId, useState } from "react";

import { cn } from "@bass/ui/cn";

export type LatestItem = {
  id: string;
  kind: "news" | "event";
  title: string;
  href: string;
  label: string;
  dateLabel: string | null;
  image: {
    storageKey: string;
    alt: string | null;
    blurDataUrl: string | null;
  } | null;
};

const TABS = [
  { key: "all", label: "Show all" },
  { key: "news", label: "Latest news" },
  { key: "event", label: "Upcoming events" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/**
 * Combined "latest" grid.
 *
 * News and events share one section, filtered by tabs, as in the reference.
 * Filtering happens on the client because every item is already in the payload
 * — a round trip to re-fetch eight cards the browser is holding would be a
 * worse experience for no benefit.
 *
 * The tabs are a real ARIA tablist: arrow keys move between them, and each
 * panel is labelled by its tab.
 */
export function LatestTabs({ items }: { items: LatestItem[] }) {
  const [active, setActive] = useState<TabKey>("all");
  const baseId = useId();

  const available = TABS.filter(
    (tab) => tab.key === "all" || items.some((item) => item.kind === tab.key),
  );

  const visible =
    active === "all" ? items : items.filter((item) => item.kind === active);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const index = available.findIndex((tab) => tab.key === active);
    if (index < 0) return;

    let next: number | null = null;
    if (event.key === "ArrowRight") next = (index + 1) % available.length;
    if (event.key === "ArrowLeft") next = (index - 1 + available.length) % available.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = available.length - 1;
    if (next === null) return;

    event.preventDefault();
    const tab = available[next];
    setActive(tab.key);
    document.getElementById(`${baseId}-tab-${tab.key}`)?.focus();
  }

  return (
    <>
      <div
        role="tablist"
        aria-label="Filter the latest news and events"
        onKeyDown={onKeyDown}
        className="mt-8 flex flex-wrap gap-6 border-b border-line"
      >
        {available.map((tab) => {
          const selected = tab.key === active;
          return (
            <button
              key={tab.key}
              id={`${baseId}-tab-${tab.key}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab.key)}
              className={cn(
                "-mb-px border-b-2 pb-3 text-[0.9375rem] font-semibold transition-colors",
                selected
                  ? "border-gold-500 text-navy-900"
                  : "border-transparent text-ink-600 hover:text-navy-900",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${active}`}
        tabIndex={-1}
      >
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {visible.map((item) => (
            <li key={item.id}>
              <article className="group relative isolate flex min-h-[15rem] flex-col justify-end overflow-hidden bg-navy-900">
                {/* Corner tab with a cut edge, as in the reference. */}
                <span className="absolute left-0 top-0 z-10 bg-navy-950 py-1.5 pl-3.5 pr-6 text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-white [clip-path:polygon(0_0,100%_0,calc(100%-0.75rem)_100%,0_100%)]">
                  {item.label}
                </span>

                <div className="absolute inset-0 -z-10">
                  {item.image ? (
                    <Image
                      src={`/media/${item.image.storageKey}`}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 23vw, (min-width: 640px) 46vw, 100vw"
                      loading="lazy"
                      {...(item.image.blurDataUrl
                        ? { placeholder: "blur" as const, blurDataURL: item.image.blurDataUrl }
                        : {})}
                      className="object-cover transition-transform duration-500 ease-[var(--ease-out-soft)] group-hover:scale-105"
                    />
                  ) : (
                    <div aria-hidden="true" className="grid size-full place-items-center bg-navy-900">
                      <span className="font-serif text-3xl text-white/20">BASS</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/70 to-navy-950/10" />
                </div>

                <div className="flex flex-col gap-1.5 p-4">
                  {item.dateLabel ? (
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-gold-300">
                      {item.dateLabel}
                    </p>
                  ) : null}
                  <h3 className="font-serif text-lg leading-snug text-white">
                    <Link href={item.href as never} className="before:absolute before:inset-0">
                      {item.title}
                    </Link>
                  </h3>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
