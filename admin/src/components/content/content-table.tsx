import Link from "next/link";

import { ContentStatus } from "@/generated/prisma/enums";
import type { ContentListRow } from "@/lib/content-admin";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label } from "@/components/ui/field";

import { formatDateTime } from "@/components/applications/format";

/**
 * The list behind each content module: status chips, a search box, and a
 * table of rows that link to their editors. Server-rendered; the chips and
 * search are plain links and a GET form.
 */

export function StatusBadge({ row }: { row: Pick<ContentListRow, "status" | "publishedAt"> }) {
  if (row.status === ContentStatus.PUBLISHED && row.publishedAt && row.publishedAt > new Date()) {
    return <Badge tone="info">Scheduled</Badge>;
  }
  switch (row.status) {
    case ContentStatus.PUBLISHED:
      return <Badge tone="success">Published</Badge>;
    case ContentStatus.ARCHIVED:
      return <Badge tone="neutral">Archived</Badge>;
    default:
      return <Badge tone="warning">Draft</Badge>;
  }
}

export function ContentTable({
  basePath,
  noun,
  rows,
  status,
  q,
  publicPrefix,
  newLabel,
}: {
  basePath: string;
  noun: string;
  rows: ContentListRow[];
  status?: ContentStatus;
  q?: string;
  /** Where a row lives on the public site, e.g. "/news/". */
  publicPrefix: string;
  newLabel: string;
}) {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const chip = (value: ContentStatus | undefined, label: string) => {
    const query = new URLSearchParams();
    if (value) query.set("status", value);
    if (q) query.set("q", q);
    const active = value === status;
    return (
      <Link
        key={label}
        href={`${basePath}${query.toString() ? `?${query}` : ""}` as never}
        aria-current={active ? "page" : undefined}
        className={cn(
          "rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors",
          active ? "bg-navy-800 text-white ring-navy-800" : "bg-white text-navy-800 ring-line-strong hover:bg-navy-50",
        )}
      >
        {label}
      </Link>
    );
  };

  return (
    <>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {chip(undefined, "All")}
          {chip(ContentStatus.PUBLISHED, "Published")}
          {chip(ContentStatus.DRAFT, "Drafts")}
          {chip(ContentStatus.ARCHIVED, "Archived")}
        </div>
        <form method="get" action={basePath} className="flex items-end gap-2">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q" className="sr-only">Search</Label>
            <Input id="q" name="q" type="search" placeholder={`Search ${noun}s`} defaultValue={q ?? ""} className="min-w-64" />
          </div>
          <Button type="submit" size="md" variant="secondary">Search</Button>
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          className="mt-6"
          title={q || status ? "Nothing matches" : `No ${noun}s yet`}
          description={q || status ? "Try clearing the filter." : `Create the first ${noun} to see it here.`}
          action={<ButtonLink href={`${basePath}/new` as never} withArrow>{newLabel}</ButtonLink>}
        />
      ) : (
        // `relative` is load-bearing: the table's visually-hidden header text
        // (`sr-only`) is position:absolute, and without a positioned wrapper its
        // containing block is the viewport — it escapes this scroll container
        // and stretches the whole page sideways on a phone.
        <div className="relative mt-6 overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="bg-surface-sunken text-left text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">
              <tr>
                <th scope="col" className="px-4 py-3">Title</th>
                <th scope="col" className="px-4 py-3">Showing</th>
                <th scope="col" className="px-4 py-3">Updated</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-navy-50/50">
                  <td className="px-4 py-3">
                    <Link href={`${basePath}/${row.id}` as never} className="font-medium text-navy-900 hover:underline">{row.title}</Link>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {row.slug ? <span className="font-mono">{publicPrefix}{row.slug}</span> : null}
                      {row.slug && row.meta ? " · " : ""}
                      {row.meta}
                    </p>
                  </td>
                  <td className="px-4 py-3"><StatusBadge row={row} /></td>
                  <td className="px-4 py-3 text-ink-700">{formatDateTime(row.updatedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      {row.slug && row.status === ContentStatus.PUBLISHED ? (
                        <a href={`${siteUrl}${publicPrefix}${row.slug}`} target="_blank" rel="noopener" className="text-sm font-semibold text-ink-600 hover:underline">
                          View
                        </a>
                      ) : null}
                      <Link href={`${basePath}/${row.id}` as never} className="text-sm font-semibold text-navy-800 hover:underline">Edit</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function ContentHeader({ title, count, noun, basePath, newLabel }: { title: string; count: number; noun: string; basePath: string; newLabel: string }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-navy-900">{title}</h1>
        <p className="mt-1 text-sm text-ink-600">{count} {count === 1 ? noun : `${noun}s`}.</p>
      </div>
      <ButtonLink href={`${basePath}/new` as never} size="sm" withArrow>{newLabel}</ButtonLink>
    </header>
  );
}

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-ink-500">
      {items.map((item, index) => (
        <span key={index}>
          {index > 0 ? <span aria-hidden="true"> / </span> : null}
          {item.href ? <Link href={item.href as never} className="hover:underline">{item.label}</Link> : <span className="text-navy-900">{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}
