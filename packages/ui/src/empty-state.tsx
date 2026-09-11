import type { ReactNode } from "react";

import { cn } from "./cn";

/**
 * Shown wherever there is genuinely nothing to display. Never a blank screen,
 * and never filled with sample content to look busy.
 */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-card border border-dashed border-line-strong",
        "bg-surface-sunken/60 px-6 py-14 text-center",
        className,
      )}
    >
      <p className="font-serif text-lg text-navy-900">{title}</p>
      {description ? (
        <p className="max-w-md text-sm leading-relaxed text-ink-600">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Marks content the school still has to supply. Never shown to the public. */
export function AwaitingContent({ what }: { what: string }) {
  return (
    <div className="rounded-card border border-dashed border-gold-400 bg-gold-50 px-4 py-3 text-sm text-gold-800">
      <span className="font-semibold">Awaiting content — </span>
      {what}
    </div>
  );
}
