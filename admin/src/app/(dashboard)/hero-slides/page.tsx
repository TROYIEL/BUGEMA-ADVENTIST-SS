import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { requirePagePermission } from "@bass/auth/dal";
import { isSlideLive, listHeroSlides, type HeroSlideRow } from "@bass/core/hero-slides";
import { Alert } from "@bass/ui/alert";
import { Badge, type BadgeTone } from "@bass/ui/badge";
import { ButtonLink } from "@bass/ui/button";
import { EmptyState } from "@bass/ui/empty-state";

import { formatDateTime } from "@/components/applications/format";

import { removeHeroSlide, reorderHeroSlide, toggleHeroSlide } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Hero slides" };

function showing(slide: HeroSlideRow): { label: string; tone: BadgeTone } {
  if (!slide.isActive) return { label: "Off", tone: "neutral" };
  const now = new Date();
  if (slide.publishFrom && slide.publishFrom > now) return { label: "Scheduled", tone: "info" };
  if (slide.publishUntil && slide.publishUntil < now) return { label: "Expired", tone: "warning" };
  return { label: "Showing", tone: "success" };
}

/**
 * The slides the front page cycles through, in order. Reordering, switching
 * on and off and deleting happen here; the words and photographs on the
 * slide's own page.
 */
export default async function HeroSlidesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requirePagePermission("content:write");
  const [{ saved }, slides] = await Promise.all([searchParams, listHeroSlides()]);
  const live = slides.filter((slide) => isSlideLive(slide)).length;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

  return (
    <div className="container-admin py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">Hero slides</h1>
          <p className="mt-1 text-sm text-ink-600">
            {slides.length === 0
              ? "No slides yet."
              : `${slides.length} ${slides.length === 1 ? "slide" : "slides"}, ${live} showing.`}{" "}
            The front page cycles through the ones that are showing, in this order.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={siteUrl as never} variant="secondary" size="sm" target="_blank" rel="noopener">
            View the website
          </ButtonLink>
          <ButtonLink href="/hero-slides/new" size="sm" withArrow>
            New slide
          </ButtonLink>
        </div>
      </header>

      {saved === "1" ? (
        <Alert tone="success" className="mt-6 max-w-3xl">
          Slide saved. The website shows it immediately.
        </Alert>
      ) : null}

      {live === 0 ? (
        <Alert tone="info" className="mt-6 max-w-3xl" title="The website is building its own slides">
          While no slide is showing, the front page assembles slides itself from
          the school&rsquo;s settings, the admissions window, the latest news story
          and the next event. The moment one of yours is showing, only your
          slides are used.
        </Alert>
      ) : null}

      {slides.length === 0 ? (
        <EmptyState
          className="mt-6"
          title="Compose the first slide"
          description="A title, a few words, up to two buttons and up to four photographs."
          action={
            <ButtonLink href="/hero-slides/new" withArrow>
              New slide
            </ButtonLink>
          }
        />
      ) : (
        <ol className="mt-6 flex flex-col gap-3">
          {slides.map((slide, index) => {
            const status = showing(slide);
            const prints = [slide.collageOne, slide.collageTwo, slide.collageThree].filter(Boolean).length;
            return (
              <li
                key={slide.id}
                className="grid gap-4 rounded-lg border border-line bg-white p-4 sm:grid-cols-[auto_8rem_minmax(0,1fr)_auto] sm:items-center"
              >
                {/* Order: arrows rather than drag, so it works everywhere and needs no script. */}
                <div className="flex gap-1 sm:flex-col">
                  <form action={reorderHeroSlide}>
                    <input type="hidden" name="id" value={slide.id} />
                    <input type="hidden" name="direction" value="up" />
                    <button
                      type="submit"
                      disabled={index === 0}
                      aria-label={`Move "${slide.title}" up`}
                      className="grid size-8 place-items-center rounded-md border border-line text-navy-800 hover:bg-navy-50 disabled:opacity-30"
                    >
                      ↑
                    </button>
                  </form>
                  <form action={reorderHeroSlide}>
                    <input type="hidden" name="id" value={slide.id} />
                    <input type="hidden" name="direction" value="down" />
                    <button
                      type="submit"
                      disabled={index === slides.length - 1}
                      aria-label={`Move "${slide.title}" down`}
                      className="grid size-8 place-items-center rounded-md border border-line text-navy-800 hover:bg-navy-50 disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </form>
                </div>

                <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-navy-900">
                  {slide.image ? (
                    <Image
                      src={`/media/${slide.image.storageKey}`}
                      alt=""
                      fill
                      sizes="8rem"
                      className="object-cover opacity-80"
                    />
                  ) : null}
                  {slide.collageTwo ? (
                    <div className="absolute inset-3 overflow-hidden border-2 border-gold-400">
                      <Image
                        src={`/media/${slide.collageTwo.storageKey}`}
                        alt=""
                        fill
                        sizes="6rem"
                        className="object-cover"
                      />
                    </div>
                  ) : null}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-ink-500">{index + 1}.</span>
                    <Link
                      href={`/hero-slides/${slide.id}`}
                      className="truncate font-semibold text-navy-900 hover:underline"
                    >
                      {slide.title}
                    </Link>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink-600">
                    {[
                      slide.subtitle,
                      slide.ctaLabel ? `Button: ${slide.ctaLabel}` : null,
                      slide.showPhone ? "Call now" : null,
                      `${prints} ${prints === 1 ? "print" : "prints"}`,
                      slide.publishFrom ? `from ${formatDateTime(slide.publishFrom)}` : null,
                      slide.publishUntil ? `until ${formatDateTime(slide.publishUntil)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                  <Link
                    href={`/hero-slides/${slide.id}`}
                    className="text-sm font-semibold text-navy-800 hover:underline"
                  >
                    Edit
                  </Link>
                  <form action={toggleHeroSlide}>
                    <input type="hidden" name="id" value={slide.id} />
                    <input type="hidden" name="isActive" value={slide.isActive ? "false" : "true"} />
                    <button type="submit" className="text-sm font-semibold text-navy-800 hover:underline">
                      {slide.isActive ? "Switch off" : "Switch on"}
                    </button>
                  </form>
                  <form action={removeHeroSlide}>
                    <input type="hidden" name="id" value={slide.id} />
                    <button type="submit" className="text-sm font-semibold text-danger-600 hover:underline">
                      Delete
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
