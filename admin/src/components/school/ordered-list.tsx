import Link from "next/link";

import type { ContentListRow } from "@/lib/content-admin";
import { ButtonLink } from "@/components/ui/button";

import { StatusBadge } from "@/components/content/content-table";

/**
 * A short ordered list of editable rows with order arrows — for the
 * programmes and departments, whose order is the order the website shows.
 */
export function OrderedList({
  title,
  hint,
  rows,
  basePath,
  kind,
  moveAction,
  newLabel,
}: {
  title: string;
  hint: string;
  rows: (ContentListRow & { order: number })[];
  basePath: string;
  kind: string;
  moveAction: (formData: FormData) => Promise<void>;
  newLabel: string;
}) {
  return (
    <section className="rounded-lg border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div>
          <h2 className="text-base font-semibold text-navy-900">{title}</h2>
          <p className="mt-0.5 text-sm text-ink-600">{hint}</p>
        </div>
        <ButtonLink href={`${basePath}/new` as never} size="sm" withArrow>{newLabel}</ButtonLink>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-ink-500">None yet.</p>
      ) : (
        <ol className="divide-y divide-line">
          {rows.map((row, index) => (
            <li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`${basePath}/${row.id}` as never} className="font-medium text-navy-900 hover:underline">{row.title}</Link>
                  <StatusBadge row={row} />
                </div>
                {row.meta ? <p className="mt-0.5 text-sm text-ink-600">{row.meta}</p> : null}
              </div>
              <div className="flex items-center gap-1">
                {(["up", "down"] as const).map((direction) => (
                  <form key={direction} action={moveAction}>
                    <input type="hidden" name="kind" value={kind} />
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="direction" value={direction} />
                    <button
                      type="submit"
                      disabled={direction === "up" ? index === 0 : index === rows.length - 1}
                      aria-label={`Move "${row.title}" ${direction}`}
                      className="grid size-7 place-items-center rounded-md border border-line text-navy-800 hover:bg-navy-50 disabled:opacity-30"
                    >
                      {direction === "up" ? "↑" : "↓"}
                    </button>
                  </form>
                ))}
                <Link href={`${basePath}/${row.id}` as never} className="ml-2 text-sm font-semibold text-navy-800 hover:underline">Edit</Link>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
