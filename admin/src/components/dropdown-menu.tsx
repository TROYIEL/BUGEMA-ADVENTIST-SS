"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { cn } from "@/components/ui/cn";

/**
 * A button that opens a small panel below it. Closes on Escape, on a click
 * outside, and on navigation. Kept deliberately plain: the panel's contents
 * are ordinary links and forms, so keyboard users tab through them as usual.
 */
export function DropdownMenu({
  trigger,
  label,
  align = "end",
  width = "w-64",
  children,
}: {
  trigger: ReactNode;
  /** Accessible name for the button when the trigger is only an icon. */
  label: string;
  align?: "start" | "end";
  width?: string;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  // Opened *at* a pathname: navigating away closes it without an effect.
  const pathname = usePathname();
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;
  const setOpen = (next: boolean) => setOpenedAt(next ? pathname : null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpenedAt(null);
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full text-sm font-medium text-navy-900 outline-none transition-colors hover:bg-navy-50 focus-visible:ring-2 focus-visible:ring-navy-800"
      >
        {trigger}
      </button>
      <div
        id={id}
        role="menu"
        hidden={!open}
        className={cn(
          "absolute top-full z-40 mt-2 rounded-lg border border-line bg-white p-1.5 shadow-raised",
          align === "end" ? "right-0" : "left-0",
          width,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** One row inside a DropdownMenu. */
export const menuItemClass =
  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-navy-900 hover:bg-navy-50 focus-visible:bg-navy-50 focus-visible:outline-none";
