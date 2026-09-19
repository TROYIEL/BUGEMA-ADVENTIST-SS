import Link from "next/link";

import { MediaImage, type MediaImageAsset } from "@/components/media-image";
import { cn } from "@/components/ui/cn";

/**
 * The school wordmark.
 *
 * The supplied crest is a black shield with a navy "BASS" wordmark, drawn for
 * light backgrounds. On the navy footer it is therefore set on a white plate
 * rather than dropped straight onto the dark ground, where the black shield
 * and navy lettering would disappear. This is also why the site header is
 * light: the brand dictates it, and forcing the crest onto a dark bar would
 * mean either recolouring the school's own mark or rendering it illegible.
 *
 * When no logo has been uploaded, an original typographic monogram stands in.
 * It deliberately does not imitate the real crest.
 */
export function BrandMark({
  schoolName,
  logo,
  tone = "light",
  className,
}: {
  schoolName: string;
  logo?: MediaImageAsset | null;
  /** "dark" for use on the navy footer. */
  tone?: "light" | "dark";
  className?: string;
}) {
  const onDark = tone === "dark";

  if (logo) {
    return (
      <Link
        href="/"
        aria-label={`${schoolName} — home`}
        className={cn("flex shrink-0 items-center", className)}
      >
        <MediaImage
          asset={logo}
          alt={schoolName}
          sizes="240px"
          priority
          className={cn(
            "w-auto object-contain",
            onDark
              ? "h-16 rounded-sm bg-white px-3 py-2"
              : "h-11 md:h-12",
          )}
        />
      </Link>
    );
  }

  return (
    <Link
      href="/"
      aria-label={`${schoolName} — home`}
      className={cn("group flex shrink-0 items-center gap-3", className)}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid size-11 shrink-0 place-items-center border-2 font-serif text-lg font-semibold",
          onDark
            ? "border-gold-400 bg-navy-800 text-white"
            : "border-gold-500 bg-navy-900 text-white",
        )}
      >
        B
      </span>
      <span className="flex min-w-0 flex-col leading-none">
        <span
          className={cn(
            "font-serif text-[1.0625rem] leading-tight tracking-tight",
            onDark ? "text-white" : "text-navy-900",
          )}
        >
          Bugema Adventist
        </span>
        <span
          className={cn(
            "mt-1 text-[0.65rem] font-semibold uppercase leading-none tracking-[0.18em]",
            onDark ? "text-gold-300" : "text-gold-700",
          )}
        >
          Secondary School
        </span>
      </span>
    </Link>
  );
}
