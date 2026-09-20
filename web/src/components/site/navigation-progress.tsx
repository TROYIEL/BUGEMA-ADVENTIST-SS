"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Phase = "idle" | "loading" | "done";

/**
 * A thin gold bar along the top of the viewport while a navigation is in
 * flight, so a click is never met with silence while the next page's data
 * loads.
 *
 * Starts on any click of a same-origin link (and on back/forward) and
 * finishes when the URL actually changes. The site deliberately has no
 * route-level loading.tsx — a streamed Suspense fallback would turn every
 * 404 into a 200 — so this is what stands in for one.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const location = `${pathname}?${searchParams.toString()}`;
  // Where we were when the navigation started; null when nothing is loading.
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const phase: Phase = startedAt === null ? "idle" : startedAt === location ? "loading" : "done";

  useEffect(() => {
    const here = () => `${window.location.pathname}?${new URLSearchParams(window.location.search).toString()}`;
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if ((anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Same document (a hash link, or the page we are already on): nothing loads.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setStartedAt(here());
    }
    function onPopState() {
      setStartedAt(here());
    }
    document.addEventListener("click", onClick, { capture: true });
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  // Once the URL has changed, let the bar reach the end and fade, then
  // reset. Also give up on a navigation that never lands (the click opened
  // a file, say).
  useEffect(() => {
    if (phase === "idle") return;
    const timer = setTimeout(() => setStartedAt(null), phase === "done" ? 400 : 10000);
    return () => clearTimeout(timer);
  }, [phase]);

  return (
    <div
      aria-hidden="true"
      data-phase={phase}
      className="nav-progress pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.75 origin-left bg-linear-to-r from-gold-500 via-gold-300 to-gold-500"
    />
  );
}
