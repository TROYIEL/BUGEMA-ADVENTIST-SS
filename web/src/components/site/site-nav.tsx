"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { BrandMark } from "@/components/site/brand-mark";
import { MediaImage, type MediaImageAsset } from "@/components/media-image";
import { ButtonLink } from "@/components/ui/button";
import { HoverFill } from "@/components/ui/hover-fill";
import { cn } from "@/components/ui/cn";
import type { NavItem } from "@/lib/navigation";

/** An article featured inside the mega-menu. Dates arrive pre-formatted. */
export type MenuArticle = {
  slug: string;
  title: string;
  category: string | null;
  dateLabel: string | null;
  image: MediaImageAsset | null;
};

const UTILITY_BAR_HEIGHT = "2.25rem";
const MAIN_BAR_HEIGHT = "5rem";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={cn("size-3.5 transition-transform duration-200", open && "rotate-180")}
    >
      <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={cn("size-4", className)}>
      <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="size-5">
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" />
      <path d="m13.5 13.5 3.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function SiteNav({
  items,
  schoolName,
  logo,
  featuredNews = [],
}: {
  items: NavItem[];
  schoolName: string;
  logo: MediaImageAsset | null;
  featuredNews?: MenuArticle[];
}) {
  const pathname = usePathname();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedMobile, setExpandedMobile] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuIdPrefix = useId();

  // Close everything on navigation, or the panel stays open over the new page.
  //
  // Adjusted during render rather than in an effect. React documents this as
  // the way to reset state when a value changes: it runs before the browser
  // paints, so the menu never flashes open on the new route, and it avoids the
  // cascading re-render that a setState-inside-useEffect would cause.
  const [renderedPathname, setRenderedPathname] = useState(pathname);
  if (pathname !== renderedPathname) {
    setRenderedPathname(pathname);
    setOpenMenuId(null);
    setMobileOpen(false);
  }

  // Escape closes the open panel and returns focus to the trigger that opened it.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (openMenuId) {
        const trigger = document.getElementById(`${menuIdPrefix}-trigger-${openMenuId}`);
        setOpenMenuId(null);
        trigger?.focus();
      }
      setMobileOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openMenuId, menuIdPrefix]);

  // A click anywhere outside the header dismisses the mega menu.
  useEffect(() => {
    if (!openMenuId) return;

    function onPointerDown(event: PointerEvent) {
      if (!headerRef.current?.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [openMenuId]);

  // The drawer covers the page, so the page behind it must not scroll.
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  /**
   * Hover intent.
   *
   * Opening instantly on pointer-enter makes panels flash open as the pointer
   * sweeps across the bar, and closing instantly makes the panel impossible to
   * reach — so both ends are delayed slightly. The panel is a DOM child of the
   * same <li> as its trigger, which is what lets `pointerleave` treat moving
   * into the panel as staying put.
   *
   * Touch pointers are ignored: a tap fires pointerenter as well, and acting on
   * it would fight the click handler and open a panel the tap then closes.
   */
  function clearHoverTimer() {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  }

  function handlePointerEnter(event: React.PointerEvent, itemId: string | null) {
    if (event.pointerType === "touch") return;
    clearHoverTimer();
    hoverTimer.current = setTimeout(() => setOpenMenuId(itemId), itemId ? 110 : 180);
  }

  function handlePointerLeave(event: React.PointerEvent) {
    if (event.pointerType === "touch") return;
    clearHoverTimer();
    // Closing on hover-out must NOT move focus: the pointer user never asked
    // for it, and yanking focus back to the trigger would scroll the page.
    hoverTimer.current = setTimeout(() => setOpenMenuId(null), 180);
  }

  function closeMenu(itemId: string) {
    const trigger = document.getElementById(`${menuIdPrefix}-trigger-${itemId}`);
    setOpenMenuId(null);
    // Returning focus matters: without it, dismissing the panel drops the
    // keyboard user back at the top of the document.
    trigger?.focus();
  }

  useEffect(() => clearHoverTimer, []);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 border-b-2 border-gold-500 bg-navy-950"
    >
      {/* Thin navy utility strip: keeps the institutional contrast the dark
          header used to provide, without putting the crest on a dark ground. */}
      <div className="on-dark hidden bg-navy-950 text-white lg:block">
        <div
          className="container-page flex items-center justify-end gap-6 text-[0.8125rem]"
          style={{ height: UTILITY_BAR_HEIGHT }}
        >
          <Link href="/contact" className="text-navy-100 transition-colors hover:text-white">
            Visit us
          </Link>
          <Link href="/contact" className="text-navy-100 transition-colors hover:text-white">
            Contact us
          </Link>
          <Link href="/admissions/application-status" className="text-navy-100 transition-colors hover:text-white">
            Check an application
          </Link>
        </div>
      </div>

      <div
        className="container-page flex items-center justify-between gap-6"
        style={{ height: MAIN_BAR_HEIGHT }}
      >
        <BrandMark schoolName={schoolName} logo={logo} className="bg-white" />

        {/* Desktop navigation */}
        <nav aria-label="Main" className="hidden lg:block ">
          <ul className="flex items-center">
            {items.map((item) => {
              const hasChildren = item.children.length > 0;
              const panelId = `${menuIdPrefix}-panel-${item.id}`;
              const triggerId = `${menuIdPrefix}-trigger-${item.id}`;
              const open = openMenuId === item.id;
              const active = isActive(item.href);

              const baseClasses =
                "relative flex items-center gap-1.5 px-3.5 text-[0.9375rem] font-semibold transition-colors";

              // The gold parallelogram marking the priority item, recoloured
              // from the reference's magenta flag.
              const flagClasses = item.highlight
                ? "nav-flag mx-1.5 px-4 text-navy-950"
                : cn(
                    // Gold, not navy: the header is dark, so the previous
                    // navy-900 active colour left the open item almost
                    // invisible against its own background.
                    active || open
                      ? "text-gold-300"
                      : "text-white hover:text-gold-200",
                    // Gold underline that grows from the centre on hover.
                    "after:absolute after:inset-x-3.5 after:bottom-0 after:h-0.5 after:origin-center after:bg-gold-500 after:transition-transform after:duration-200 after:ease-[var(--ease-out-soft)]",
                    active || open ? "after:scale-x-100" : "after:scale-x-0 hover:after:scale-x-100",
                  );

              return (
                <li
                  key={item.id}
                  className="flex"
                  // Entering an item without a panel closes whatever is open,
                  // so sweeping along the bar behaves the way it looks.
                  onPointerEnter={(event) =>
                    handlePointerEnter(event, hasChildren ? item.id : null)
                  }
                  onPointerLeave={handlePointerLeave}
                >
                  {hasChildren ? (
                    <button
                      type="button"
                      id={triggerId}
                      aria-expanded={open}
                      aria-controls={panelId}
                      onClick={() => setOpenMenuId(open ? null : item.id)}
                      className={cn(baseClasses, flagClasses)}
                      style={{ height: MAIN_BAR_HEIGHT }}
                    >
                      {item.label}
                      <ChevronIcon open={open} />
                    </button>
                  ) : (
                    <Link
                      href={item.href as never}
                      className={cn(baseClasses, flagClasses)}
                      style={{ height: MAIN_BAR_HEIGHT }}
                    >
                      {item.label}
                    </Link>
                  )}

                  {hasChildren ? (
                    <MegaPanel
                      id={panelId}
                      labelledBy={triggerId}
                      item={item}
                      open={open}
                      siblings={items.filter((entry) => entry.id !== item.id)}
                      featuredNews={featuredNews}
                      onClose={() => closeMenu(item.id)}
                    />
                  ) : null}
                </li>
              );
            })}

            <li className="ml-2 border-l border-line pl-2">
              <Link
                href="/search"
                aria-label="Search this site"
                className="grid size-10 place-items-center rounded-full text-white hover:text-navy-900 transition-colors hover:bg-navy-50"
              >
                <SearchIcon />
              </Link>
            </li>
          </ul>
        </nav>

        {/* Mobile trigger */}
        <div className="flex items-center gap-1 lg:hidden">
          <Link
            href="/search"
            aria-label="Search this site"
            className="grid size-10 place-items-center rounded-full text-navy-800"
          >
            <SearchIcon />
          </Link>
          <button
            type="button"
            aria-expanded={mobileOpen}
            aria-controls={`${menuIdPrefix}-mobile`}
            onClick={() => setMobileOpen((value) => !value)}
            className="grid size-10 place-items-center rounded-full text-navy-800"
          >
            <span className="sr-only">{mobileOpen ? "Close menu" : "Open menu"}</span>
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="size-6">
              {mobileOpen ? (
                <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              ) : (
                <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile drawer — laid out for a phone, not a shrunken desktop menu */}
      <div
        id={`${menuIdPrefix}-mobile`}
        hidden={!mobileOpen}
        className="fixed inset-x-0 bottom-0 z-40 overflow-y-auto overscroll-contain bg-surface-raised lg:hidden"
        style={{ top: MAIN_BAR_HEIGHT }}
      >
        <nav aria-label="Main" className="container-page py-4">
          <ul className="flex flex-col divide-y divide-line">
            {items.map((item) => {
              const hasChildren = item.children.length > 0;
              const expanded = expandedMobile === item.id;

              return (
                <li key={item.id}>
                  <div className="flex items-center">
                    <Link
                      href={item.href as never}
                      className={cn(
                        "flex-1 py-4 font-serif text-xl",
                        isActive(item.href) ? "text-navy-700" : "text-navy-900",
                      )}
                    >
                      {item.label}
                    </Link>
                    {hasChildren ? (
                      <button
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => setExpandedMobile(expanded ? null : item.id)}
                        className="grid size-11 shrink-0 place-items-center rounded-full text-ink-600"
                      >
                        <span className="sr-only">
                          {expanded ? `Hide ${item.label} links` : `Show ${item.label} links`}
                        </span>
                        <ChevronIcon open={expanded} />
                      </button>
                    ) : null}
                  </div>

                  {hasChildren && expanded ? (
                    <ul className="mb-4 flex flex-col border-l-2 border-gold-500 pl-4">
                      {item.children.map((child) => (
                        <li key={child.id}>
                          <Link
                            href={child.href as never}
                            className="block py-2.5 text-[0.9375rem] text-ink-600 hover:text-navy-900"
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <div className="my-8">
            <ButtonLink href="/admissions/apply" size="lg" withArrow className="w-full">
              Apply for admission
            </ButtonLink>
          </div>
        </nav>
      </div>
    </header>
  );
}

/**
 * Full-width dropdown panel.
 *
 * Positioned with `absolute inset-x-0 top-full` against the header, which is
 * `sticky` and therefore the containing block. It previously used `fixed` with
 * a hardcoded offset, which broke as soon as the announcement bar appeared
 * above the header: the bar is not sticky, so at the top of the page it pushed
 * the header down and the panel opened *over* the navigation. Measuring from
 * the header itself is correct at every scroll position, with or without the
 * bar.
 */
function MegaPanel({
  id,
  labelledBy,
  item,
  open,
  siblings,
  featuredNews,
  onClose,
}: {
  id: string;
  labelledBy: string;
  item: NavItem;
  open: boolean;
  siblings: NavItem[];
  featuredNews: MenuArticle[];
  onClose: () => void;
}) {
  // The news section gets real articles; everywhere else gets the application
  // call to action, which is the thing most visitors are looking for.
  const showsNews = item.href === "/news" && featuredNews.length > 0;

  return (
    <div
      id={id}
      aria-labelledby={labelledBy}
      data-open={open ? "true" : "false"}
      // `inert` rather than `hidden`: the panel has to stay in the DOM to be
      // animated, but while closed it must be unreachable by tab, invisible to
      // a screen reader, and unclickable. `hidden` would do all three — and
      // also apply display:none, which cannot be transitioned.
      inert={!open}
      className={cn(
        "absolute inset-x-0 top-full z-40 max-h-[calc(100dvh-9rem)] overflow-y-auto",
        "border-b-2 border-gold-500 bg-surface-raised text-ink-900 shadow-raised",
        // `visibility` is animatable and directional: on the way out it stays
        // visible for the whole duration, on the way in it flips immediately.
        // That is what lets the panel fade out and then genuinely stop
        // existing to the pointer, with no JavaScript timer.
        "transition-[opacity,translate,visibility] duration-300 ease-[var(--ease-out-soft)] motion-reduce:transition-none",
        "data-[open=false]:invisible data-[open=false]:-translate-y-3 data-[open=false]:opacity-0",
        "data-[open=true]:visible data-[open=true]:translate-y-0 data-[open=true]:opacity-100",
      )}
    >
      <div
        className={cn(
          "container-page relative py-12",
          // The contents settle a beat after the panel itself, which reads as
          // a considered reveal rather than one flat cross-fade.
          "transition-[opacity,translate] duration-900 ease-[var(--ease-out-soft)] motion-reduce:transition-none",
          open
            ? "translate-y-0 opacity-100 delay-100"
            : "-translate-y-1.5 opacity-0 delay-0",
        )}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-navy-950 text-white transition-colors hover:bg-navy-800 md:right-0"
        >
          {/* The icon alone carries no meaning to a screen reader. */}
          <span className="sr-only">Close menu</span>
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-4">
            <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
          </svg>
        </button>

        <div className="grid min-h-[20rem] gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-12">
          {/* Column one: what this section is */}
          <div className="flex flex-col gap-4">
            <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-navy-600">
              <span aria-hidden="true" className="h-px w-6 bg-gold-500" />
              {item.label}
            </p>
            <Link
              href={item.href as never}
              className="group inline-flex w-fit items-center gap-2 font-serif text-3xl leading-tight text-navy-900 hover:text-navy-700"
            >
              {item.label}
              <ArrowIcon className="text-gold-600 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
            {item.description ? (
              <p className="max-w-xs text-sm leading-relaxed text-ink-600">
                {item.description}
              </p>
            ) : null}

            <Link
              href={item.href as never}
              className="mt-auto inline-flex w-fit items-center gap-2 border-b-2 border-gold-500 pb-0.5 text-sm font-semibold text-navy-900 hover:border-gold-600"
            >
              View everything in {item.label.toLowerCase()}
            </Link>
          </div>

          {/* Column two: the links themselves */}
          <ul className="grid content-start gap-x-8 gap-y-1 sm:grid-cols-2 lg:border-x lg:border-line lg:px-12">
            {item.children.map((child) => (
              <li key={child.id}>
                <Link
                  href={child.href as never}
                  className="group flex flex-col gap-0.5 rounded py-2.5 transition-colors"
                >
                  <span className="flex items-center gap-1.5 font-medium text-navy-900 group-hover:text-navy-600">
                    <span className="group-hover:underline">{child.label}</span>
                    <ArrowIcon className="size-3.5 -translate-x-1 text-gold-600 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
                  </span>
                  {child.description ? (
                    <span className="text-[0.8125rem] leading-snug text-ink-500">
                      {child.description}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>

          {/* Column three: featured content, then cross-links */}
          <div className="flex flex-col gap-6">
            {showsNews ? (
              <div className="flex flex-col gap-4">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-500">
                  Latest from the school
                </p>
                {featuredNews.map((article) => (
                  <Link
                    key={article.slug}
                    href={`/news/${article.slug}` as never}
                    className="group flex gap-3"
                  >
                    {article.image ? (
                      <MediaImage
                        asset={article.image}
                        alt=""
                        sizes="96px"
                        className="size-20 shrink-0 object-cover"
                      />
                    ) : null}
                    <span className="flex min-w-0 flex-col gap-1">
                      {article.dateLabel ? (
                        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-gold-700">
                          {article.dateLabel}
                        </span>
                      ) : null}
                      <span className="font-serif text-[0.9375rem] leading-snug text-navy-900 group-hover:underline">
                        {article.title}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-3 bg-navy-900 p-6 text-white">
                <p className="font-serif text-xl">Start your application</p>
                <p className="text-sm leading-relaxed text-navy-100">
                  Applications are made online and can be saved and resumed at
                  any point.
                </p>
                <ButtonLink
                  href="/admissions/apply"
                  variant="on-dark"
                  withArrow
                  className="mt-2 self-start"
                >
                  Apply for admission
                </ButtonLink>
              </div>
            )}

            {siblings.length > 0 ? (
              <div className="mt-auto flex flex-col gap-3">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-500">
                  You may also want
                </p>
                <ul className="flex flex-wrap gap-2">
                  {siblings.slice(0, 6).map((sibling) => (
                    <li key={sibling.id}>
                      <Link
                        href={sibling.href as never}
                        className="group relative isolate inline-flex overflow-hidden rounded-full border border-line px-3.5 py-1.5 text-[0.8125rem] font-medium text-navy-800 transition-colors hover:border-navy-300"
                      >
                        <HoverFill tone="bg-navy-50" inset="inset-[2px]" />
                        <span className="relative">{sibling.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
