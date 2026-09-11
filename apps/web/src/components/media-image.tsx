import Image from "next/image";

import { cn } from "@bass/ui/cn";

export type MediaImageAsset = {
  storageKey: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  blurDataUrl: string | null;
};

/**
 * Renders a media-library asset through next/image.
 *
 * Files are served by the /media route handler rather than from public/, which
 * is why `images.localPatterns` in next.config.ts allows `/media/**`.
 */
export function MediaImage({
  asset,
  sizes,
  className,
  priority = false,
  fill = false,
  alt,
}: {
  asset: MediaImageAsset;
  /** Required whenever the image is responsive, or the browser assumes 100vw. */
  sizes: string;
  className?: string;
  /** Eagerly load and raise fetch priority. Use only for the LCP image. */
  priority?: boolean;
  fill?: boolean;
  /** Overrides the asset's stored alt text where context demands it. */
  alt?: string;
}) {
  const src = `/media/${asset.storageKey}`;
  // An empty alt marks the image as decorative, which is correct when no
  // description was recorded — better than repeating the filename.
  const alternative = alt ?? asset.alt ?? "";

  // `alt` is passed explicitly at each call site below rather than through
  // this object: spread props defeat the jsx-a11y/alt-text rule, and losing
  // that check on an image component is not a trade worth making.
  const shared = {
    src,
    sizes,
    className: cn(className),
    // `priority` was deprecated in Next 16 in favour of these two.
    loading: priority ? ("eager" as const) : ("lazy" as const),
    fetchPriority: priority ? ("high" as const) : ("auto" as const),
    ...(asset.blurDataUrl
      ? { placeholder: "blur" as const, blurDataURL: asset.blurDataUrl }
      : {}),
  };

  if (fill) {
    return <Image {...shared} alt={alternative} fill />;
  }

  return (
    <Image
      {...shared}
      alt={alternative}
      width={asset.width ?? 1600}
      height={asset.height ?? 1066}
    />
  );
}
