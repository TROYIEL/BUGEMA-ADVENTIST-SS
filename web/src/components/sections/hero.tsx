import { ButtonLink } from "@bass/ui/button";
import { cn } from "@bass/ui/cn";
import { MediaImage, type MediaImageAsset } from "@/components/media-image";

/**
 * One hero slide's worth of content. Everything below the title is optional,
 * so the layout still reads correctly with only a headline — a slide built
 * from a news story has no collage, a slide built from settings has no date.
 */
export type HeroSlideData = {
  /** Stable key for the carousel; any string unique among the slides. */
  id: string;
  /** Small caps line above the title, with the gold rule. */
  subtitle?: string | null;
  title: string;
  body?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  ctaSecondaryLabel?: string | null;
  ctaSecondaryHref?: string | null;
  /** Background photograph, held well back behind the copy. */
  image?: MediaImageAsset | null;
  /** Up to three photographs, stacked as prints beside the copy. */
  collage?: MediaImageAsset[];
  /** Short phrase set in oversized gold display type beside the collage. */
  displayText?: string | null;
  /** Shown as a "call now" action when the school has published a number. */
  phone?: string | null;
};

/**
 * Homepage hero.
 *
 * Follows the reference's arrangement: headline top-left with the calls to
 * action stacked beneath it, an oversized trio of overlapping photographs to
 * the right, and a short phrase in large accent type below them. Rebuilt in
 * the BASS navy-and-gold identity — none of the reference's branding, copy or
 * markup is reused.
 *
 * Renders one slide. On its own it is the whole hero; inside `HeroCarousel`
 * it is one of several, and `active` drives the entrance animation: the copy
 * rises into place line by line and the prints settle one after another.
 * Everything animates on `translate` and opacity — never `transform` — and
 * stops under reduced motion.
 */

/**
 * Each frame gets its own width, aspect ratio, angle and depth.
 *
 * Uniform tiles at a uniform ratio read as a gallery strip; the varied shapes
 * and the deliberate overlap are what make this read as a stack of prints. The
 * spans overlap by a few percent so the frames sit over one another rather
 * than merely sitting beside one another.
 */
const COLLAGE_PLACEMENT = [
  "left-0 top-14 w-[35%] aspect-[3/4] -rotate-5 z-10",
  "left-[40%] top-0 w-[41%] aspect-[4/5] rotate-2 z-20",
  "left-[81%] top-20 w-[37%] aspect-[4/3] rotate-4 z-0",
] as const;

/** Entrance: hidden and a little low until the slide is active, then rises. */
function rise(active: boolean, delayClass: string) {
  return cn(
    "transition-[translate,opacity] duration-700 ease-[var(--ease-out-soft)] motion-reduce:transition-none",
    active ? cn("translate-y-0 opacity-100", delayClass) : "translate-y-4 opacity-0",
  );
}

export function Hero({
  slide,
  active = true,
  priority = false,
  headingLevel = "h1",
  className,
}: {
  slide: HeroSlideData;
  /** False for a carousel slide that is not the one showing. */
  active?: boolean;
  /** Eager-load the background: only for the first slide, the page's LCP. */
  priority?: boolean;
  /** A page has one h1; in a carousel only the first slide gets it. */
  headingLevel?: "h1" | "h2";
  className?: string;
}) {
  const Heading = headingLevel;
  const {
    title,
    subtitle,
    body,
    ctaLabel,
    ctaHref,
    ctaSecondaryLabel,
    ctaSecondaryHref,
    image,
    collage = [],
    displayText,
    phone,
  } = slide;
  const collageImages = collage.slice(0, 3);

  return (
    <section
      className={cn("on-dark relative isolate overflow-hidden bg-navy-500 text-white", className)}
    >
      {/* Background photograph, held well back so the headline keeps contrast. */}
      {image ? (
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <MediaImage
            asset={image}
            alt=""
            sizes="100vw"
            priority={priority}
            fill
            className={cn(
              "object-cover object-center opacity-50",
              // A slow, barely-there drift while the slide is showing.
              "transition-[scale] duration-[8000ms] ease-linear motion-reduce:transition-none",
              active ? "scale-[1.06]" : "scale-100",
            )}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-navy-950/70 via-navy-950/40 to-navy-950/60" />
        </div>
      ) : null}

      <div className="container-page relative py-14 md:py-16 lg:py-3">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
          <div className="flex max-w-xl flex-col gap-7">
            {subtitle ? (
              <p
                className={cn(
                  "flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-gold-300",
                  rise(active, "delay-100"),
                )}
              >
                <span aria-hidden="true" className="h-px w-8 bg-gold-400" />
                {subtitle}
              </p>
            ) : null}

            <Heading
              className={cn(
                "font-serif text-display-md leading-[1.02] text-white md:text-6xl",
                rise(active, "delay-200"),
              )}
            >
              {title}
            </Heading>

            {body ? (
              <p
                className={cn(
                  "max-w-lg leading-relaxed text-navy-100",
                  // A short tagline is set large, as a line of display copy; a
                  // paragraph of real information is set to be read.
                  body.length <= 80 ? "text-2xl md:text-4xl" : "text-lg md:text-xl",
                  rise(active, "delay-300"),
                )}
              >
                {body}
              </p>
            ) : null}

            {/* Stacked rather than side by side, as in the reference: each
                action reads as its own decision, and the column keeps its
                shape unchanged from mobile through to desktop. */}
            <div className={cn("flex flex-col items-start gap-3", rise(active, "delay-[400ms]"))}>
              {/* A telephone number is the fastest route to an answer for many
                  parents, so it leads — but only once the school has actually
                  published one. */}
              {phone ? (
                <ButtonLink
                  href={`tel:${phone.replace(/\s+/g, "")}` as never}
                  variant="on-dark-accent"
                  size="lg"
                  withArrow
                >
                  Call now: {phone}
                </ButtonLink>
              ) : null}

              {ctaLabel && ctaHref ? (
                <ButtonLink
                  href={ctaHref as never}
                  variant={phone ? "on-dark-outline" : "on-dark"}
                  size="lg"
                  withArrow
                >
                  {ctaLabel}
                </ButtonLink>
              ) : null}

              {/* Dropped once a phone number exists, so the stack stays at two
                  actions rather than becoming a list to read through. */}
              {!phone && ctaSecondaryLabel && ctaSecondaryHref ? (
                <ButtonLink
                  href={ctaSecondaryHref as never}
                  variant="on-dark-outline"
                  size="lg"
                  withArrow
                >
                  {ctaSecondaryLabel}
                </ButtonLink>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col">
            {collageImages.length > 0 ? (
              <div
                aria-hidden="true"
                className="relative h-[18rem] sm:h-[24rem] lg:h-[27rem] xl:h-[30rem]"
              >
                {collageImages.map((asset, index) => (
                  <div
                    key={asset.storageKey}
                    className={cn(
                      "absolute overflow-hidden border-4 border-gold-400 shadow-raised",
                      COLLAGE_PLACEMENT[index],
                      // The prints settle one after another, slightly behind the copy.
                      "transition-[translate,opacity] duration-700 ease-[var(--ease-out-soft)] motion-reduce:transition-none",
                      active
                        ? cn("translate-y-0 opacity-100", ["delay-300", "delay-[450ms]", "delay-[600ms]"][index])
                        : "translate-y-6 opacity-0",
                    )}
                  >
                    <MediaImage
                      asset={asset}
                      alt=""
                      sizes="(min-width: 1024px) 30vw, 45vw"
                      fill
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            ) : null}

            {displayText ? (
              <p
                className={cn(
                  "max-w-xl self-end text-left font-serif text-2xl font-semibold uppercase leading-[0.95] tracking-tight text-gold-400 sm:text-3xl lg:text-[2.25rem] xl:text-[2.6rem]",
                  rise(active, "delay-[700ms]"),
                )}
              >
                {displayText}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
