import Link from "next/link";

import { MediaImage, type MediaImageAsset } from "@/components/media-image";
import { cn } from "@/components/ui/cn";
import { formatDate, formatDateRange } from "@/lib/content";

/**
 * A corner tab with a cut edge, echoing the reference's angled labels. Purely
 * decorative geometry — the text inside is real content.
 */
function CornerLabel({ children, className }: { children: string; className?: string }) {
  return (
    <span
      className={cn(
        "absolute left-0 top-0 z-10 bg-navy-950 py-1.5 pl-4 pr-6 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-white",
        "[clip-path:polygon(0_0,100%_0,calc(100%-0.75rem)_100%,0_100%)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

function ImageFallback({ label }: { label: string }) {
  return (
    <div
      aria-hidden="true"
      className="flex size-full items-center justify-center bg-navy-900 p-6"
    >
      <span className="font-serif text-2xl text-white/25">{label}</span>
    </div>
  );
}

/**
 * Cards sit under an <h2> section heading on the homepage but directly under
 * the page <h1> on a listing page, so the heading level has to be chosen by
 * the caller — a fixed <h3> skips a level on listings.
 */
type HeadingLevel = "h2" | "h3";

export type NewsCardData = {
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  publishedAt: Date | null;
  featuredImage: MediaImageAsset | null;
};

/**
 * News card with the title over the image, as in the reference. A gradient
 * scrim keeps the white text legible regardless of the photograph beneath it.
 */
export function NewsCard({
  article,
  sizes,
  headingLevel: Heading = "h3",
}: {
  article: NewsCardData;
  sizes: string;
  headingLevel?: HeadingLevel;
}) {
  return (
    <article className="group relative isolate flex h-full min-h-[19rem] flex-col justify-end overflow-hidden bg-navy-900">
      <CornerLabel>{article.category ?? "News"}</CornerLabel>

      <div className="absolute inset-0 -z-10">
        {article.featuredImage ? (
          <MediaImage
            asset={article.featuredImage}
            alt=""
            sizes={sizes}
            fill
            className="object-cover transition-transform duration-500 ease-[var(--ease-out-soft)] group-hover:scale-[1.04]"
          />
        ) : (
          <ImageFallback label="BASS" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/70 to-navy-950/10" />
      </div>

      <div className="flex flex-col gap-2 p-5">
        {article.publishedAt ? (
          <p className="text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-gold-300">
            {formatDate(article.publishedAt)}
          </p>
        ) : null}
        <Heading className="font-serif text-xl leading-snug text-white">
          <Link href={`/news/${article.slug}` as never} className="before:absolute before:inset-0">
            {article.title}
          </Link>
        </Heading>
      </div>
    </article>
  );
}

export type EventCardData = {
  slug: string;
  title: string;
  description: string | null;
  startDate: Date;
  endDate: Date | null;
  startTime: string | null;
  location: string | null;
};

/** Events lead with the date, which is what a parent is scanning for. */
export function EventCard({ event }: { event: EventCardData }) {
  const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: "UTC" }).format(event.startDate);
  const month = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(event.startDate);

  return (
    <article className="group relative flex h-full gap-5 border border-line bg-surface-raised p-5 transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-card">
      <div
        aria-hidden="true"
        className="flex size-16 shrink-0 flex-col items-center justify-center border-2 border-gold-500 bg-navy-900 text-white"
      >
        <span className="font-serif text-2xl leading-none">{day}</span>
        <span className="mt-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-gold-300">
          {month}
        </span>
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <h3 className="font-serif text-lg leading-snug text-navy-900">
          <Link href={`/events/${event.slug}` as never} className="before:absolute before:inset-0 group-hover:underline">
            {event.title}
          </Link>
        </h3>
        <p className="text-[0.8125rem] text-ink-500">
          <span className="sr-only">Date: </span>
          {formatDateRange(event.startDate, event.endDate)}
          {event.startTime ? `, ${event.startTime}` : ""}
        </p>
        {event.location ? (
          <p className="text-[0.8125rem] text-ink-500">{event.location}</p>
        ) : null}
        {event.description ? (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-600">
            {event.description}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export type ProgramCardData = {
  slug: string;
  title: string;
  summary: string | null;
  image: MediaImageAsset | null;
};

/**
 * Programme card with a hover reveal.
 *
 * At rest it shows only the title over the photograph. On hover the image
 * lifts, the scrim deepens, and the summary and call to action slide in —
 * the pattern from the reference's course cards.
 *
 * Three details make it behave rather than just look right:
 *  - `group-focus-within` mirrors every hover state, so a keyboard user gets
 *    the same reveal when they tab to the card;
 *  - `@media (hover: none)` forces the revealed state open permanently, so on
 *    a phone — where hover does not exist — the summary is simply always
 *    visible instead of being unreachable;
 *  - the height animates via `grid-template-rows`, which transitions smoothly
 *    where `height: auto` cannot.
 *
 * The global reduced-motion rule collapses these transitions to nothing, so
 * the content appears instantly for anyone who has asked for less movement.
 */
export function ProgramCard({ program, sizes }: { program: ProgramCardData; sizes: string }) {
  return (
    <article className="group relative isolate flex min-h-[20rem] flex-col justify-end overflow-hidden bg-navy-900">
      <div className="absolute inset-0 -z-10">
        {program.image ? (
          <MediaImage
            asset={program.image}
            alt=""
            sizes={sizes}
            fill
            className="object-cover transition-transform duration-700 ease-[var(--ease-out-soft)] group-hover:scale-105 group-focus-within:scale-105"
          />
        ) : (
          <ImageFallback label={program.title} />
        )}
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/60 to-transparent",
            "transition-opacity duration-500",
            "group-hover:from-navy-950 group-hover:via-navy-950/80",
          )}
        />
      </div>

      <div className="flex flex-col gap-2 p-6">
        <h3 className="font-serif text-2xl text-white">
          {/* The ::before stretches this one link over the whole card. It is
              raised above the card's content because the revealed panel below
              animates with `translate`, which puts it in its own stacking
              layer; without the z-index that panel would sit on top of the
              overlay and the summary and "Find out more" would be dead. */}
          <Link
            href={`/academics/programmes/${program.slug}` as never}
            className="before:absolute before:inset-0 before:z-10"
          >
            {program.title}
          </Link>
        </h3>

        <span
          aria-hidden="true"
          className="h-0.5 w-10 bg-gold-500 transition-all duration-300 group-hover:w-16 group-focus-within:w-16"
        />

        <div
          className={cn(
            "grid grid-rows-[0fr] transition-[grid-template-rows] duration-400 ease-[var(--ease-out-soft)]",
            "group-hover:grid-rows-[1fr] group-focus-within:grid-rows-[1fr]",
            // No hover available (touch): keep it open rather than unreachable.
            "[@media(hover:none)]:grid-rows-[1fr]",
          )}
        >
          <div className="overflow-hidden">
            <div
              className={cn(
                "flex flex-col items-start gap-4 pt-3",
                "translate-y-1 opacity-0 transition-all duration-300 delay-75",
                "group-hover:translate-y-0 group-hover:opacity-100",
                "group-focus-within:translate-y-0 group-focus-within:opacity-100",
                "[@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100",
              )}
            >
              {program.summary ? (
                <p className="max-w-sm text-sm leading-relaxed text-navy-100">
                  {program.summary}
                </p>
              ) : null}

              {/* Presentational: the whole card is already one link, so this
                  must not become a second tab stop announcing the same target. */}
              <span
                aria-hidden="true"
                className="inline-flex items-center gap-2.5 rounded-full bg-white/95 px-5 py-2 text-sm font-semibold text-navy-900"
              >
                Find out more
                <span className="grid size-5 place-items-center rounded-full bg-navy-900 text-white">
                  <svg viewBox="0 0 16 16" fill="none" className="size-3">
                    <path
                      d="M2 8h11M9 4l4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
