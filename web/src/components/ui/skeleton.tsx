import type { ComponentPropsWithoutRef } from "react";

import { cn } from "./cn";

/**
 * A placeholder block that shimmers while real content is on its way.
 *
 * Give it the shape of what it stands in for — a line of text, a card, a
 * table row — so the page keeps its layout and nothing jumps when the
 * content lands. Purely decorative: hidden from assistive technology, with
 * the parent expected to carry `aria-busy`.
 */
export function Skeleton({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn("skeleton rounded-md bg-surface-sunken", className)}
      {...props}
    />
  );
}

/** A few lines of body text. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}
