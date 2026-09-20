import Link from "next/link";

import { MediaImage, type MediaImageAsset } from "@/components/media-image";
import {
  HoverReveal,
  HoverRevealPanel,
  HoverRevealToggle,
} from "@/components/sections/hover-reveal";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/card";
import { RichText } from "@/components/ui/rich-text";
import { cn } from "@/components/ui/cn";
import { HoverFill } from "@/components/ui/hover-fill";

/**
 * Homepage section blocks.
 *
 * Every block renders `null` when it has nothing real to show. A section with
 * no configured content disappears rather than leaving an empty band or a row
 * of blank cards on a live school website.
 */

export type BlockContent = {
  eyebrow?: string | null;
  title?: string | null;
  subtitle?: string | null;
  body?: string | null;
  /** Paragraphs behind a "show more", for a band that offers a little more than its blurb. */
  details?: string[] | null;
  detailsLabel?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  ctaSecondaryLabel?: string | null;
  ctaSecondaryHref?: string | null;
  media?: MediaImageAsset | null;
};

// ---------------------------------------------------------------------------

export function QuickActions({
  actions,
  title,
  body,
}: {
  actions: { label: string; href: string; description?: string }[];
  title?: string | null;
  body?: string | null;
}) {
  if (actions.length === 0) return null;

  return (
    // Dark band with its top-left corner cut away, the transition device the
    // reference uses between its hero and the first light content.
    //
    // The cut must stay inside the band's own padding, or it slices through
    // the heading and buttons: a phone has 1.25rem of side padding, a laptop
    // 4rem. So up to 1760px it is a chamfer that ends 2.5rem (3rem on md)
    // down the left edge — always above the 3rem/3.5rem top padding — and
    // only from 1760px, where the centred container leaves 80px+ of margin,
    // does it become the full-height slant.
    <section
      aria-label="Quick links"
      className="on-dark relative mt-14 bg-navy-950 text-white [clip-path:polygon(0_2.5rem,3rem_0,100%_0,100%_100%,0_100%)] md:[clip-path:polygon(0_3rem,6rem_0,100%_0,100%_100%,0_100%)] min-[110rem]:[clip-path:polygon(5rem_0,100%_0,100%_100%,7%_100%)]"
    >
      <div className="container-page py-12 md:py-14">
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] lg:gap-14">
          <div className="flex flex-col gap-2">
            <h2 className="font-serif text-2xl font-bold text-white md:text-4xl ">
              {title ?? "Start your application"}
            </h2>
            {body ? (
              <p className="text-[0.9375rem] leading-relaxed text-navy-100">{body}</p>
            ) : null}
          </div>

          <ul className="flex flex-wrap gap-3">
            {actions.map((action) => (
              <li key={`${action.href}-${action.label}`}>
                <Link
                  href={action.href as never}
                  className="group relative isolate inline-flex items-center gap-3 overflow-hidden rounded-full bg-white/95 px-5 py-2.5 text-[0.9375rem] font-semibold text-navy-900"
                >
                  <HoverFill tone="bg-gold-400" />
                  {action.label}
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-navy-900 text-white transition-transform duration-200 group-hover:translate-x-0.5">
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-3">
                      <path
                        d="M2 8h11M9 4l4 4-4 4"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

/**
 * Editorial image-and-text block. `reverse` puts the image first, which is how
 * the homepage alternates rhythm down the page.
 */
export function TextImage({
  content,
  reverse = false,
}: {
  content: BlockContent;
  reverse?: boolean;
}) {
  if (!content.title && !content.body) return null;

  return (
    <section className="container-page py-16 md:py-20">
      <div
        className={cn(
          "grid items-center gap-10 lg:grid-cols-2 lg:gap-16",
          reverse && "lg:[&>*:first-child]:order-2",
        )}
      >
        <div className="flex flex-col gap-6">
          <SectionHeading
            eyebrow={content.eyebrow}
            title={content.title ?? ""}
            description={content.subtitle}
          />
          <RichText html={content.body} />
          {content.ctaLabel && content.ctaHref ? (
            <div className="mt-1">
              <ButtonLink href={content.ctaHref as never} withArrow>
                {content.ctaLabel}
              </ButtonLink>
            </div>
          ) : null}
        </div>

        {content.media ? (
          <div className="relative">
            {/* Offset gold panel behind the photograph, echoing the reference's
                layered blocks without copying its shapes. */}
            <div
              aria-hidden="true"
              className="absolute -bottom-4 -right-4 hidden h-full w-full border-4 border-gold-400 lg:block"
            />
            <MediaImage
              asset={content.media}
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="relative aspect-[4/3] w-full object-cover"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

export function FullWidthImage({ content }: { content: BlockContent }) {
  if (!content.media) return null;

  return (
    <section className="relative isolate">
      <MediaImage
        asset={content.media}
        sizes="100vw"
        className="h-[22rem] w-full object-cover md:h-[30rem]"
      />
      {content.title ? (
        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-navy-950/85 to-transparent">
          <div className="container-page pb-10">
            <h2 className="max-w-2xl font-serif text-display-sm text-white md:text-display-md">
              {content.title}
            </h2>
          </div>
        </div>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------

/**
 * Feature grid. Follows the reference's benefit layout — heading and text
 * first, image beneath — which reads better than an icon row and does not need
 * a picture for every item.
 */
export function FeatureGrid({
  content,
  features,
}: {
  content: BlockContent;
  features: { title: string; body: string; media?: MediaImageAsset | null }[];
}) {
  // Categories without any copy would render as empty cards, so they are
  // dropped rather than shown blank.
  const withContent = features.filter((feature) => feature.body.trim().length > 0);
  if (withContent.length === 0) return null;

  return (
    <section className="container-page py-16 md:py-20">
      {content.title ? (
        <SectionHeading eyebrow={content.eyebrow} title={content.title} description={content.subtitle} />
      ) : null}

      <ul className="mt-12 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4 ">
        {withContent.map((feature) => (
          <li key={feature.title} className="flex flex-col group gap-3 border-t-2 border-navy-950">
            <h3 className="font-serif text-xl leading-snug text-navy-900">{feature.title}</h3>
            <p className="text-[0.9375rem] leading-relaxed text-ink-600">{feature.body}</p>
            {feature.media ? (
              <MediaImage
                asset={feature.media}
                sizes="(min-width: 1024px) 22vw, (min-width: 640px) 45vw, 100vw"
                className="mt-2 aspect-[4/3] w-full object-cover border-2 border-navy-950 hover:cursor-pointer hover:scale-105 duration-500"
              />
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------

export function Statistics({
  content,
  stats,
}: {
  content: BlockContent;
  stats: {
    value: string;
    label: string;
    caption?: string;
    media?: MediaImageAsset | null;
  }[];
}) {
  if (stats.length === 0) return null;

  return (
    // Dark band carrying a row of highlights: photograph above, statement
    // below — the inverse of the feature grid higher up the page, which is how
    // the reference keeps two four-column rows from reading as the same block.
    <section className="on-dark bg-navy-950 py-14 text-white md:py-16">
      <div className="container-page">
        {content.title ? (
          <h2 className="max-w-3xl font-serif text-2xl leading-snug text-white md:text-[1.75rem]">
            {content.title}
          </h2>
        ) : null}

        <ul className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <li key={stat.label} className="flex flex-col gap-4">
              {stat.media ? (
                <MediaImage
                  asset={stat.media}
                  alt=""
                  sizes="(min-width: 1024px) 22vw, (min-width: 640px) 45vw, 100vw"
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="grid aspect-[4/3] w-full place-items-center bg-navy-900"
                >
                  <span className="font-serif text-4xl text-gold-400">{stat.value}</span>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <p className="font-serif text-xl leading-snug text-white">
                  <span className="text-gold-400">{stat.value}</span> {stat.label}
                </p>
                {stat.caption ? (
                  <p className="text-sm leading-relaxed text-navy-100">{stat.caption}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

/** Admissions call to action: dark band, angled top edge, photograph behind. */
export function CtaBanner({ content }: { content: BlockContent }) {
  if (!content.title) return null;

  return (
    <section className="on-dark relative isolate overflow-hidden bg-navy-950 text-white">
      {content.media ? (
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <MediaImage
            asset={content.media}
            alt=""
            sizes="100vw"
            fill
            className="object-cover object-[center_25%] opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-navy-950 via-navy-950/90 to-navy-950/50" />
        </div>
      ) : null}

      <div className="container-page py-20 md:py-24">
        <div className="flex max-w-2xl flex-col gap-6">
          {content.eyebrow ? (
            <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-gold-300">
              <span aria-hidden="true" className="h-px w-8 bg-gold-400" />
              {content.eyebrow}
            </p>
          ) : null}

          <h2 className="font-serif text-display-sm text-white md:text-display-md">
            {content.title}
          </h2>

          {content.body ? (
            <p className="text-lg leading-relaxed text-navy-100">{content.body}</p>
          ) : null}

          {content.ctaLabel && content.ctaHref ? (
            <div className="mt-2 flex flex-wrap gap-4">
              <ButtonLink href={content.ctaHref as never} variant="on-dark" size="lg" withArrow>
                {content.ctaLabel}
              </ButtonLink>
              {content.ctaSecondaryLabel && content.ctaSecondaryHref ? (
                <ButtonLink
                  href={content.ctaSecondaryHref as never}
                  variant="on-dark-outline"
                  size="lg"
                >
                  {content.ctaSecondaryLabel}
                </ButtonLink>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

/**
 * Featured story: coloured band with the photograph breaking out of it, the
 * most editorial layout on the page.
 */
export function FeaturedStory({ content }: { content: BlockContent }) {
  if (!content.title) return null;

  return (
    // Coloured band with the photograph deliberately oversized: it breaks out
    // well above and below the band and carries offset blocks behind it, so it
    // reads as a layered composition rather than a picture sitting in a box.
    // The band needs vertical margin of its own to make room for the overhang.
    <section className="relative my-28 bg-navy-100 lg:my-40">
      <div className="container-page">
        <div className="grid items-center gap-12 py-14 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16 lg:py-20">
          {/* The framed panel is the hover area: resting the pointer on it
              draws the cover off the extra paragraphs. */}
          <HoverReveal hoverArea="panel" className="flex flex-col gap-5">
            {content.eyebrow ? (
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-navy-700">
                {content.eyebrow}
              </p>
            ) : null}
            <h2 className="font-serif text-display-sm text-navy-950 md:text-display-md">
              {content.title}
            </h2>
            {content.body ? (
              <p className="max-w-xl text-lg leading-relaxed text-navy-900/80">{content.body}</p>
            ) : null}
            {/* A little more without leaving the page; the full story is
                still one click away on the button below. */}
            {content.details && content.details.length > 0 ? (
              <>
                <HoverRevealToggle label={content.detailsLabel ?? "Read more"} />
                {/* Gold frame over an offset navy one: the same layered
                    device as the blocks behind the photograph, at text
                    scale. The outer margin leaves room for the offset. */}
                <HoverRevealPanel className="relative mr-2 mb-2 max-w-xl">
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 translate-x-2 translate-y-2 border-2 border-navy-700"
                  />
                  <div className="relative overflow-hidden border-2 border-gold-400 bg-white/70">
                    {/* Extra right padding keeps every line clear of the
                        sliver the cover parks at when it is drawn back. */}
                    <div className="flex flex-col gap-4 p-5 pr-14 md:p-6 md:pr-16">
                      {content.details.map((paragraph, index) => (
                        <p key={index} className="leading-relaxed text-navy-900/85">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                    {/* The cover. At rest it lies over the right three
                        quarters of the text with a slanted leading edge, so
                        the start of each line shows through; on hover it
                        slides most of the way off to the right, leaving a
                        sliver at the edge, and comes back when the pointer
                        leaves. Two layers: gold beneath, navy on top and
                        nudged right, so a gold edge follows the slant — a
                        border cannot, because clip-path cuts it off. It
                        transitions `translate`, not `transform`: Tailwind's
                        translate utilities set the CSS translate property. */}
                    <div
                      aria-hidden="true"
                      className={cn(
                        "pointer-events-none absolute inset-0",
                        "transition-[translate] duration-700 ease-[var(--ease-out-soft)] motion-reduce:transition-none",
                        "translate-x-[20%] group-data-[state=open]/reveal:translate-x-[88%]",
                      )}
                    >
                      <div className="absolute inset-0 bg-gold-500/50 [clip-path:polygon(10%_0,100%_0,100%_100%,0_100%)]" />
                      <div className="absolute inset-y-0 left-1 right-0 opacity-85 bg-navy-800/85 [clip-path:polygon(11%_0,100%_0,100%_100%,0_100%)]" />
                    </div>
                  </div>
                </HoverRevealPanel>
              </>
            ) : null}
            {content.ctaLabel && content.ctaHref ? (
              <div className="mt-2">
                <ButtonLink href={content.ctaHref as never} withArrow>
                  {content.ctaLabel}
                </ButtonLink>
              </div>
            ) : null}
          </HoverReveal>

          {content.media ? (
            <div className="group/photo relative lg:-my-28">
              {/* Hovering the photograph makes the composition breathe: the
                  blocks behind it push further out, the picture eases in a
                  touch, a faint navy tint settles over the top-right corner
                  and a pair of gold corner brackets draw themselves in. Every
                  transition is on `translate`, `scale` or opacity — never
                  `transform` — and all of it stops under reduced motion. */}
              {/* Offset blocks behind the photograph. Decorative only, so they
                  are hidden from assistive technology and dropped on small
                  screens where there is no room for them to read as layering. */}
              <div
                aria-hidden="true"
                className={cn(
                  "absolute -right-5 -top-8 hidden size-40 bg-gold-400 lg:block",
                  "transition-[translate] duration-500 ease-[var(--ease-out-soft)] motion-reduce:transition-none",
                  "group-hover/photo:translate-x-3 group-hover/photo:-translate-y-3",
                )}
              />
              <div
                aria-hidden="true"
                className={cn(
                  "absolute -bottom-8 -left-6 hidden size-32 border-[6px] border-navy-700 lg:block",
                  "transition-[translate] duration-500 ease-[var(--ease-out-soft)] motion-reduce:transition-none",
                  "group-hover/photo:-translate-x-3 group-hover/photo:translate-y-3",
                )}
              />

              <div className="relative overflow-hidden shadow-raised">
                <MediaImage
                  asset={content.media}
                  sizes="(min-width: 1024px) 55vw, 100vw"
                  className={cn(
                    "aspect-[5/4] w-full object-cover",
                    "transition-[scale] duration-700 ease-[var(--ease-out-soft)] motion-reduce:transition-none",
                    "group-hover/photo:scale-[1.03]",
                  )}
                />

                {/* Faint tint from the top-right corner, matching the gold
                    block's side of the picture. */}
                <div
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute inset-0 bg-gradient-to-bl from-navy-950/45 via-navy-950/0 to-transparent",
                    "opacity-0 transition-opacity duration-500 motion-reduce:transition-none",
                    "group-hover/photo:opacity-100",
                  )}
                />

                {/* Corner brackets: two gold lines at the top right, two at
                    the bottom left, each growing from nothing along its edge. */}
                <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                  <span className="absolute right-4 top-4 h-0.5 w-0 bg-gold-400 transition-[width] duration-500 delay-100 ease-[var(--ease-out-soft)] motion-reduce:transition-none group-hover/photo:w-16" />
                  <span className="absolute right-4 top-4 h-0 w-0.5 bg-gold-400 transition-[height] duration-500 delay-100 ease-[var(--ease-out-soft)] motion-reduce:transition-none group-hover/photo:h-16" />
                  <span className="absolute bottom-4 left-4 h-0.5 w-0 bg-gold-400 transition-[width] duration-500 delay-100 ease-[var(--ease-out-soft)] motion-reduce:transition-none group-hover/photo:w-16" />
                  <span className="absolute bottom-4 left-4 h-0 w-0.5 bg-gold-400 transition-[height] duration-500 delay-100 ease-[var(--ease-out-soft)] motion-reduce:transition-none group-hover/photo:h-16" />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
