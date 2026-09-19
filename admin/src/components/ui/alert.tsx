import type { ReactNode } from "react";

import { cn } from "./cn";

export type AlertTone = "info" | "success" | "warning" | "danger";

const TONES: Record<AlertTone, { wrapper: string; icon: string; path: ReactNode }> = {
  info: {
    wrapper: "border-info-600/25 bg-info-50 text-navy-900",
    icon: "text-info-600",
    path: <path d="M10 9v5m0-8.5v.5" strokeWidth="2" strokeLinecap="round" />,
  },
  success: {
    wrapper: "border-success-600/25 bg-success-50 text-success-700",
    icon: "text-success-600",
    path: <path d="m5.5 10.5 3 3 6-6.5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  },
  warning: {
    wrapper: "border-warning-600/30 bg-warning-50 text-warning-700",
    icon: "text-warning-600",
    path: <path d="M10 6.5v4.5m0 3h.01" strokeWidth="2" strokeLinecap="round" />,
  },
  danger: {
    wrapper: "border-danger-600/30 bg-danger-50 text-danger-700",
    icon: "text-danger-600",
    path: <path d="m6.5 6.5 7 7m0-7-7 7" strokeWidth="2" strokeLinecap="round" />,
  },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const config = TONES[tone];

  return (
    <div
      // `status` announces politely; `alert` would interrupt a screen reader
      // mid-sentence, which is only warranted for genuine errors.
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-card border p-4", config.wrapper, className)}
    >
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        aria-hidden="true"
        className={cn("mt-0.5 size-5 shrink-0", config.icon)}
      >
        <circle cx="10" cy="10" r="8.25" strokeWidth="1.5" opacity="0.35" />
        {config.path}
      </svg>
      <div className="min-w-0 text-sm leading-relaxed">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children}
      </div>
    </div>
  );
}
