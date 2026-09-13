"use client";

import { createContext, useContext, useId, useState, type ReactNode } from "react";

import { cn } from "@bass/ui/cn";

/**
 * A reveal driven by hovering a whole area, not one control.
 *
 * `HoverReveal` is the hover area and owns the state; it stamps `data-state`
 * on itself so descendants can animate off it with `group-data-[state=open]`
 * — the covered panel in the featured band does exactly that. Hover alone
 * would leave phones and keyboards out, so `HoverRevealToggle` is a real
 * button: a tap or Enter pins the reveal open, a second one closes it, and
 * moving the pointer away only closes what hovering opened.
 */

type RevealState = {
  open: boolean;
  toggle: () => void;
  panelId: string;
  /** Present when the panel, not the whole area, is what reacts to hovering. */
  panelHover?: { onMouseEnter: () => void; onMouseLeave: () => void };
};

const RevealContext = createContext<RevealState | null>(null);

function useReveal(component: string): RevealState {
  const state = useContext(RevealContext);
  if (!state) throw new Error(`${component} must be used inside <HoverReveal>.`);
  return state;
}

export function HoverReveal({
  children,
  className,
  hoverArea = "area",
}: {
  children: ReactNode;
  className?: string;
  /** What the pointer has to be over: this whole element, or just the panel. */
  hoverArea?: "area" | "panel";
}) {
  const panelId = useId();
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const open = pinned || hovered;

  const hoverHandlers = {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  };

  return (
    <RevealContext
      value={{
        open,
        toggle: () => setPinned((value) => !value),
        panelId,
        panelHover: hoverArea === "panel" ? hoverHandlers : undefined,
      }}
    >
      <div
        data-state={open ? "open" : "closed"}
        {...(hoverArea === "area" ? hoverHandlers : {})}
        className={cn("group/reveal", className)}
      >
        {children}
      </div>
    </RevealContext>
  );
}

export function HoverRevealToggle({
  label,
  collapseLabel = "Show less",
  className,
}: {
  label: string;
  collapseLabel?: string;
  className?: string;
}) {
  const { open, toggle, panelId } = useReveal("HoverRevealToggle");

  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={panelId}
      onClick={toggle}
      className={cn(
        "inline-flex w-fit items-center gap-2 text-sm font-semibold text-navy-800 underline-offset-4 hover:underline",
        className,
      )}
    >
      {open ? collapseLabel : label}
      <svg
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
        className={cn(
          "size-4 transition-transform duration-300 ease-[var(--ease-out-soft)] motion-reduce:transition-none",
          open && "translate-x-0.5",
        )}
      >
        <path
          d="M2 8h11M9 4l4 4-4 4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/** The thing being revealed; carries the id the toggle points at. */
export function HoverRevealPanel({ children, className }: { children: ReactNode; className?: string }) {
  const { panelId, panelHover } = useReveal("HoverRevealPanel");
  return (
    <div id={panelId} {...panelHover} className={className}>
      {children}
    </div>
  );
}
