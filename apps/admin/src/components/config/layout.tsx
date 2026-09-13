import type { ReactNode } from "react";

import { cn } from "@bass/ui/cn";

/**
 * Layout for a list of configurable rows: each row shows its summary and
 * folds out its editor; a matching fold-out at the end adds a row. Native
 * <details> does the folding, so nothing here needs a script.
 */

export function ConfigSection({
  id,
  title,
  hint,
  children,
  add,
}: {
  id: string;
  title: string;
  hint: string;
  children: ReactNode;
  /** The "add" editor, rendered folded at the end of the list. */
  add: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 rounded-lg border border-line bg-white">
      <div className="border-b border-line px-5 py-3">
        <h2 className="text-base font-semibold text-navy-900">{title}</h2>
        <p className="mt-0.5 text-sm text-ink-600">{hint}</p>
      </div>
      <ol className="divide-y divide-line">{children}</ol>
      <details className="group/add border-t border-line">
        <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-navy-800 hover:bg-navy-50">
          <span className="group-open/add:hidden">+ Add</span>
          <span className="hidden group-open/add:inline">Cancel</span>
        </summary>
        <div className="border-t border-line bg-surface-sunken/60 px-5 py-5">{add}</div>
      </details>
    </section>
  );
}

export function ConfigRow({
  title,
  meta,
  badges,
  editor,
  controls,
  muted = false,
}: {
  title: ReactNode;
  meta?: ReactNode;
  badges?: ReactNode;
  /** The row's editor, folded out by clicking the row. */
  editor: ReactNode;
  /** Move / delete forms, laid out on the right, outside the fold-out. */
  controls: ReactNode;
  muted?: boolean;
}) {
  return (
    <li className={cn("flex flex-wrap items-start gap-x-4 gap-y-2 px-5 py-3", muted && "opacity-60")}>
      <details className="group/row min-w-0 flex-1">
        <summary className="cursor-pointer list-none rounded-md py-1 hover:bg-navy-50/60">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-navy-900">{title}</span>
            {badges}
            <span className="ml-auto text-sm font-semibold text-navy-800">
              <span className="group-open/row:hidden">Edit</span>
              <span className="hidden group-open/row:inline">Close</span>
            </span>
          </span>
          {meta ? <span className="mt-0.5 block text-sm text-ink-600">{meta}</span> : null}
        </summary>
        <div className="mt-3 rounded-md border border-line bg-surface-sunken/60 px-5 py-5">{editor}</div>
      </details>
      <div className="flex items-center gap-2 pt-1">{controls}</div>
    </li>
  );
}

/** Up/down arrows posting to a move action. */
export function MoveControls({
  action,
  hidden,
  first,
  last,
  label,
}: {
  action: (formData: FormData) => Promise<void>;
  /** Hidden fields identifying the row (id, kind). */
  hidden: Record<string, string>;
  first: boolean;
  last: boolean;
  label: string;
}) {
  return (
    <div className="flex gap-1">
      {(["up", "down"] as const).map((direction) => (
        <form key={direction} action={action}>
          {Object.entries(hidden).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <input type="hidden" name="direction" value={direction} />
          <button
            type="submit"
            disabled={direction === "up" ? first : last}
            aria-label={`Move "${label}" ${direction}`}
            className="grid size-7 place-items-center rounded-md border border-line text-navy-800 hover:bg-navy-50 disabled:opacity-30"
          >
            {direction === "up" ? "↑" : "↓"}
          </button>
        </form>
      ))}
    </div>
  );
}

export function DeleteControl({
  action,
  id,
  label,
  disabledReason,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  label: string;
  /** When set, the row cannot be deleted and the button says why on hover. */
  disabledReason?: string | null;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={Boolean(disabledReason)}
        title={disabledReason ?? undefined}
        aria-label={`Delete "${label}"`}
        className="rounded-md px-2 py-1 text-sm font-semibold text-danger-600 hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40"
      >
        Delete
      </button>
    </form>
  );
}
