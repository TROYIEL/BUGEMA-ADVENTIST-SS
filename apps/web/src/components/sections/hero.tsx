import { ButtonLink } from "@bass/ui/button";
import { MediaImage, type MediaImageAsset } from "@/components/media-image";

export type HeroProps = {
  title: string;
  subtitle?: string | null;
  body?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  ctaSecondaryLabel?: string | null;
  ctaSecondaryHref?: string | null;
  image?: MediaImageAsset | null;
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
 * Everything below the title is optional, so the layout still reads correctly
 * with only a headline.
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

export function Hero({
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
}: HeroProps) {
  const collageImages = collage.slice(0, 3);

  return (
    <section className="on-dark relative isolate overflow-hidden bg-navy-500 text-white">
      {/* Background photograph, held well back so the headline keeps contrast. */}
      {image ? (
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <MediaImage
            asset={image}
            alt=""
            sizes="100vw"
            priority
            fill
            className="object-cover object-center opacity-50"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-navy-950/70 via-navy-950/40 to-navy-950/60" />
        </div>
      ) : null}

      <div className="container-page relative py-14 md:py-16 lg:py-3">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
          <div className="flex max-w-xl flex-col gap-7">
            {subtitle ? (
              <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-gold-300">
                <span aria-hidden="true" className="h-px w-8 bg-gold-400" />
                {subtitle}
              </p>
            ) : null}

            <h1 className="font-serif text-display-md leading-[1.02] text-white md:text-6xl">
              {title}
            </h1>

            {body ? (
              <p className="max-w-lg text-4xl leading-relaxed text-navy-100">{body}</p>
            ) : null}

            {/* Stacked rather than side by side, as in the reference: each
                action reads as its own decision, and the column keeps its
                shape unchanged from mobile through to desktop. */}
            <div className="flex flex-col items-start gap-3">
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
                    className={`absolute overflow-hidden border-4 border-gold-400 shadow-raised ${COLLAGE_PLACEMENT[index]}`}
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
              <p className="max-w-xl self-end text-left font-serif text-2xl font-semibold uppercase leading-[0.95] tracking-tight text-gold-400 sm:text-3xl lg:text-[2.25rem] xl:text-[2.6rem]">
                {displayText}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
