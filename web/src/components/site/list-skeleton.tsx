import { ViewTransition } from "react";

import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

/**
 * Stands in for a grid of content cards while the list loads. The page
 * header above it renders at once, so the visitor sees where they are; the
 * cards fade in over this when they arrive. Same card proportions as
 * `NewsCard`/`EventCard`, so nothing shifts.
 */
export function CardGridSkeleton({ count = 6, label = "Loading" }: { count?: number; label?: string }) {
  return (
    <ViewTransition exit="fade-out" default="none">
      <div className="container-page py-14 md:py-16" aria-busy="true" aria-live="polite">
        <span className="sr-only">{label}…</span>
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: count }, (_, i) => (
            <li key={i} className="flex flex-col gap-3 rounded-card border border-line bg-surface-raised p-4">
              <Skeleton className="aspect-[3/2] w-full" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-4/5" />
              <SkeletonText lines={2} />
            </li>
          ))}
        </ul>
      </div>
    </ViewTransition>
  );
}
