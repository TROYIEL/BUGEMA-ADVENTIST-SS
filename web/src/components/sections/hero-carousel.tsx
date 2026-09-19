"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/components/ui/cn";
import { Hero, type HeroSlideData } from "@/components/sections/hero";

/**
 * The hero as a slider.
 *
 * Every slide is the ordinary `Hero`, so anything the hero can show — a
 * background, the three prints, the gold display line, the calls to action —
 * a slide can show, and a slide can leave any of them out. The track slides
 * sideways; the newly showing slide then plays its own entrance.
 *
 * Behaviour that matters more than the motion:
 *  - it advances by itself, but not while the pointer or keyboard focus is
 *    on it, not while the tab is hidden, and not at all for anyone who has
 *    asked for reduced motion;
 *  - slides that are not showing are `inert`, so their links are neither
 *    tabbable nor announced;
 *  - arrow keys and a swipe both work, and the dots and arrows are real
 *    buttons with names.
 *
 * With one slide there is nothing to slide, so it renders the plain hero.
 */

const AUTOPLAY_MS = 7000;
const SWIPE_THRESHOLD_PX = 40;

export function HeroCarousel({ slides }: { slides: HeroSlideData[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const count = slides.length;

  const goTo = useCallback(
    (next: number) => setIndex(((next % count) + count) % count),
    [count],
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // Autoplay. Restarts from the current slide whenever it changes hands, so a
  // manual step does not get cut short by a timer set for the previous one.
  useEffect(() => {
    if (count < 2 || paused || reducedMotion) return;
    let timer: number | undefined;
    const schedule = () => {
      window.clearTimeout(timer);
      if (document.visibilityState === "visible") {
        timer = window.setTimeout(() => goTo(index + 1), AUTOPLAY_MS);
      }
    };
    schedule();
    document.addEventListener("visibilitychange", schedule);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [count, paused, reducedMotion, index, goTo]);

  if (count === 0) return null;
  if (count === 1) return <Hero slide={slides[0]!} priority />;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Highlights"
      className="group/carousel relative overflow-hidden bg-navy-500"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") goTo(index + 1);
        if (event.key === "ArrowLeft") goTo(index - 1);
      }}
      onTouchStart={(event) => {
        touchStartX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const start = touchStartX.current;
        const end = event.changedTouches[0]?.clientX;
        touchStartX.current = null;
        if (start === null || end === undefined) return;
        if (end - start > SWIPE_THRESHOLD_PX) goTo(index - 1);
        if (start - end > SWIPE_THRESHOLD_PX) goTo(index + 1);
      }}
    >
      {/* The track. Each slide is a full-width column; the whole row shifts
          left by one slide per step. `translate`, not `transform`, so it
          actually transitions under Tailwind v4. */}
      <div
        className={cn(
          "flex transition-[translate] duration-700 ease-[var(--ease-out-soft)] motion-reduce:transition-none",
        )}
        style={{ translate: `-${index * 100}% 0` }}
        aria-live={paused ? "polite" : "off"}
      >
        {slides.map((slide, position) => {
          const active = position === index;
          return (
            <div
              key={slide.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${position + 1} of ${count}`}
              aria-hidden={!active}
              inert={!active}
              className="w-full shrink-0"
            >
              <Hero
                slide={slide}
                active={active}
                priority={position === 0}
                headingLevel={position === 0 ? "h1" : "h2"}
                className="h-full"
              />
            </div>
          );
        })}
      </div>

      {/* Controls sit over the bottom edge: dots in the middle, arrows at the
          sides. Kept off the copy and the prints so nothing is covered. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex items-center justify-center gap-3 md:bottom-6">
        <ArrowButton direction="previous" onClick={() => goTo(index - 1)} />
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-navy-950/50 px-3 py-2 backdrop-blur-sm">
          {slides.map((slide, position) => (
            <button
              key={slide.id}
              type="button"
              aria-label={`Go to slide ${position + 1}: ${slide.title}`}
              aria-current={position === index ? "true" : undefined}
              onClick={() => goTo(position)}
              className="group/dot grid size-6 place-items-center"
            >
              <span
                className={cn(
                  "block h-1.5 rounded-full transition-[width,background-color] duration-300 motion-reduce:transition-none",
                  position === index
                    ? "w-6 bg-gold-400"
                    : "w-1.5 bg-white/60 group-hover/dot:bg-white",
                )}
              />
            </button>
          ))}
        </div>
        <ArrowButton direction="next" onClick={() => goTo(index + 1)} />
      </div>
    </section>
  );
}

function ArrowButton({
  direction,
  onClick,
}: {
  direction: "previous" | "next";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={direction === "previous" ? "Previous slide" : "Next slide"}
      onClick={onClick}
      className={cn(
        "pointer-events-auto grid size-10 place-items-center rounded-full bg-navy-950/50 text-white backdrop-blur-sm",
        "ring-1 ring-inset ring-white/25 transition-colors duration-200 hover:bg-gold-400 hover:text-navy-950",
      )}
    >
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-4">
        <path
          d={direction === "previous" ? "M13 8H2M6 4 2 8l4 4" : "M3 8h11M9 4l4 4-4 4"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
