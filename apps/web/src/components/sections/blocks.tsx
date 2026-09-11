import Link from "next/link";

import { MediaImage, type MediaImageAsset } from "@/components/media-image";
import { ButtonLink } from "@bass/ui/button";
import { SectionHeading } from "@bass/ui/card";
import { RichText } from "@bass/ui/rich-text";
import { cn } from "@bass/ui/cn";
import { HoverFill } from "@bass/ui/hover-fill";

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
    <section
      aria-label="Quick links"
      className="on-dark relative bg-navy-950 text-white [clip-path:polygon(5rem_0,100%_0,100%_100%,0_100%)] md:[clip-path:polygon(9rem_0,100%_0,100%_100%,0_100%)]"
    >
      <div className="container-page py-12 md:py-14">
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] lg:gap-14">
          <div className="flex flex-col gap-2">
            <h2 className="font-serif text-2xl text-white md:text-[1.75rem]">
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
          <div className="flex flex-col gap-5">
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
            {content.ctaLabel && content.ctaHref ? (
              <div className="mt-2">
                <ButtonLink href={content.ctaHref as never} withArrow>
                  {content.ctaLabel}
                </ButtonLink>
              </div>
            ) : null}
          </div>

          {content.media ? (
            <div className="relative lg:-my-28">
              {/* Offset blocks behind the photograph. Decorative only, so they
                  are hidden from assistive technology and dropped on small
                  screens where there is no room for them to read as layering. */}
              <div
                aria-hidden="true"
                className="absolute -right-5 -top-8 hidden size-40 bg-gold-400 lg:block"
              />
              <div
                aria-hidden="true"
                className="absolute -bottom-8 -left-6 hidden size-32 border-[6px] border-navy-700 lg:block"
              />
              <MediaImage
                asset={content.media}
                sizes="(min-width: 1024px) 55vw, 100vw"
                className="relative aspect-[5/4] w-full object-cover shadow-raised"
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
