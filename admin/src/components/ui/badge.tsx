import type { ComponentPropsWithoutRef } from "react";

import { cn } from "./cn";

export type BadgeTone =
  | "neutral"
  | "navy"
  | "gold"
  | "success"
  | "warning"
  | "danger"
  | "info";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-sunken text-ink-600 ring-line-strong",
  navy: "bg-navy-50 text-navy-800 ring-navy-200",
  gold: "bg-gold-50 text-gold-800 ring-gold-200",
  success: "bg-success-50 text-success-700 ring-success-600/25",
  warning: "bg-warning-50 text-warning-700 ring-warning-600/25",
  danger: "bg-danger-50 text-danger-700 ring-danger-600/25",
  info: "bg-info-50 text-info-600 ring-info-600/25",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentPropsWithoutRef<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
        "text-xs font-semibold ring-1 ring-inset",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
