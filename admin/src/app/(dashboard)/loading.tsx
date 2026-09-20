import { ViewTransition } from "react";

import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

/**
 * Shown the instant a navigation starts, while the page's data loads. The
 * shape matches the common admin page — a heading, a toolbar, a table — so
 * the real content lands in place rather than jumping into view. Fades out
 * under the content when it arrives.
 */
export default function DashboardLoading() {
  return (
    <ViewTransition exit="fade-out" default="none">
      <div className="container-admin py-8" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading…</span>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-3.5 w-80 max-w-full" />
          </div>
          <Skeleton className="h-9 w-32 rounded-full" />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Skeleton className="h-10 w-72 max-w-full rounded-full" />
          <Skeleton className="h-10 w-40 rounded-full" />
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-line bg-white">
          <div className="border-b border-line bg-surface-sunken px-4 py-3">
            <Skeleton className="h-3 w-1/2 bg-line" />
          </div>
          <ul className="divide-y divide-line">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="grid gap-4 px-4 py-4 sm:grid-cols-[10rem_1fr_8rem]">
                <Skeleton className="h-3.5 w-28" />
                <SkeletonText lines={2} />
                <Skeleton className="h-6 w-20 rounded-full" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ViewTransition>
  );
}
