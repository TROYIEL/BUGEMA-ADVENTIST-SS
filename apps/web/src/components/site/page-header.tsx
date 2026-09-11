import { Breadcrumbs, type Crumb } from "@bass/ui/breadcrumbs";
import { MediaImage, type MediaImageAsset } from "@/components/media-image";
import { cn } from "@bass/ui/cn";

/**
 * Standard page masthead: breadcrumb trail, then a navy band carrying the
 * title. Gives every interior page the same anchoring the homepage hero gives
 * the front page, without pretending each one needs a photograph.
 */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  crumbs = [],
  image,
  size = "default",
}: {
  title: string;
  subtitle?: string | null;
  eyebrow?: string | null;
  crumbs?: Crumb[];
  image?: MediaImageAsset | null;
  size?: "default" | "compact";
}) {
  return (
    <>
      <Breadcrumbs items={crumbs} />

      <section className="on-dark relative isolate overflow-hidden bg-navy-900 text-white">
        {image ? (
          <div aria-hidden="true" className="absolute inset-0 -z-10">
            <MediaImage
              asset={image}
              alt=""
              sizes="100vw"
              fill
              className="object-cover opacity-25"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-navy-950 via-navy-950/85 to-navy-900/50" />
          </div>
        ) : null}

        <div
          className={cn(
            "container-page",
            size === "compact" ? "py-12 md:py-14" : "py-16 md:py-20",
          )}
        >
          <div className="flex max-w-3xl flex-col gap-4">
            {eyebrow ? (
              <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-gold-300">
                <span aria-hidden="true" className="h-px w-8 bg-gold-400" />
                {eyebrow}
              </p>
            ) : null}
            <h1
              className={cn(
                "font-serif text-white",
                size === "compact"
                  ? "text-display-sm"
                  : "text-display-sm md:text-display-md",
              )}
            >
              {title}
            </h1>
            {subtitle ? (
              <p className="max-w-2xl text-lg leading-relaxed text-navy-100">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
