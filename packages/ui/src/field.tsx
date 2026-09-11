import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "./cn";

const CONTROL =
  "w-full rounded-card border border-line-strong bg-surface-raised px-3.5 py-2.5 " +
  "text-[0.9375rem] text-ink-900 placeholder:text-ink-400 " +
  "transition-colors duration-150 " +
  "hover:border-navy-300 " +
  "focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-600/25 " +
  "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-500 " +
  "aria-[invalid=true]:border-danger-600 aria-[invalid=true]:ring-danger-600/20";

export function Label({
  required = false,
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"label"> & { required?: boolean }) {
  return (
    <label className={cn("text-sm font-semibold text-navy-900", className)} {...props}>
      {children}
      {required ? (
        <>
          {" "}
          <span className="text-danger-600" aria-hidden="true">
            *
          </span>
          <span className="sr-only"> (required)</span>
        </>
      ) : null}
    </label>
  );
}

/**
 * Wraps a control with its label, hint and error.
 *
 * The hint and error are wired to the control through aria-describedby, so a
 * screen reader announces them with the field rather than leaving them as
 * orphaned text nearby.
 */
export function Field({
  id,
  label,
  hint,
  error,
  required = false,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: (props: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": boolean;
    required: boolean;
  }) => ReactNode;
  className?: string;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {hint ? (
        <p id={hintId} className="text-sm text-ink-500">
          {hint}
        </p>
      ) : null}
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": Boolean(error),
        required,
      })}
      {error ? (
        <p id={errorId} className="text-sm font-medium text-danger-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentPropsWithoutRef<"input">) {
  return <input className={cn(CONTROL, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentPropsWithoutRef<"textarea">) {
  return <textarea className={cn(CONTROL, "min-h-28 resize-y", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentPropsWithoutRef<"select">) {
  return <select className={cn(CONTROL, "pr-9", className)} {...props} />;
}
