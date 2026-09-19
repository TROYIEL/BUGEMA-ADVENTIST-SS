import type { Metadata } from "next";
import Link from "next/link";

import { requirePagePermission } from "@bass/auth/dal";
import type { AuditAction } from "@bass/core/audit";
import { ACTION_WORDS, AUDIT_PAGE_SIZE, entityPath, entityWords, listAuditEntries, listAuditFacets, type AuditEntry } from "@bass/core/audit-admin";
import { Input } from "@bass/ui/field";
import { Picker } from "@bass/ui/picker";

import { formatDateTime } from "@/components/applications/format";
import { dateFromInput } from "@/lib/forms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Audit log" };

type Query = { action?: string; type?: string; actor?: string; q?: string; from?: string; to?: string; page?: string };

/**
 * Who changed what, when. Read-only by design: nothing here can be edited
 * or removed, and sign-ins (including failed ones) are listed alongside
 * the changes.
 */
export default async function AuditPage({ searchParams }: { searchParams: Promise<Query> }) {
  await requirePagePermission("audit:read");
  const query = await searchParams;
  const from = dateFromInput(query.from ?? "") ?? null;
  // "To" a day means up to the end of that day in Kampala.
  const to = query.to ? new Date(`${query.to}T23:59:59.999+03:00`) : null;
  const filters = {
    action: query.action || undefined,
    entityType: query.type || undefined,
    actorId: query.actor || undefined,
    q: query.q || undefined,
    from: from && !Number.isNaN(from.getTime()) ? from : null,
    to: to && !Number.isNaN(to.getTime()) ? to : null,
  };
  const page = Math.max(1, Number(query.page) || 1);
  const [{ rows, total, pages, page: current }, facets] = await Promise.all([listAuditEntries(filters, page), listAuditFacets()]);

  const pageHref = (n: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value && key !== "page") params.set(key, value);
    if (n > 1) params.set("page", String(n));
    const qs = params.toString();
    return `/audit${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="container-admin max-w-6xl py-8">
      <header>
        <h1 className="text-2xl font-semibold text-navy-900">Audit log</h1>
        <p className="mt-1 text-sm text-ink-600">
          Every change made here, and every sign-in, with who made it. {total.toLocaleString("en-GB")} {total === 1 ? "entry" : "entries"}
          {Object.values(filters).some(Boolean) ? " match" : ""}. Nothing in this log can be edited or removed.
        </p>
      </header>

      <form className="mt-6 grid gap-3 rounded-lg border border-line bg-white p-4 text-sm sm:grid-cols-2 lg:grid-cols-6" role="search">
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-action" className="text-xs font-semibold uppercase tracking-wide text-ink-600">What happened</label>
          <Picker
            id="audit-action"
            name="action"
            defaultValue={query.action ?? ""}
            emptyLabel="Anything"
            options={facets.actions.map((action) => ({ value: action, label: ACTION_WORDS[action as AuditAction] ?? action }))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-type" className="text-xs font-semibold uppercase tracking-wide text-ink-600">To what</label>
          <Picker id="audit-type" name="type" defaultValue={query.type ?? ""} emptyLabel="Anything" options={facets.entityTypes.map((type) => ({ value: type, label: entityWords(type) }))} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-actor" className="text-xs font-semibold uppercase tracking-wide text-ink-600">By whom</label>
          <Picker id="audit-actor" name="actor" defaultValue={query.actor ?? ""} emptyLabel="Anyone" options={facets.actors.map((actor) => ({ value: actor.id, label: actor.name }))} />
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-600">From</span>
          <Input type="date" name="from" defaultValue={query.from ?? ""} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-600">To</span>
          <Input type="date" name="to" defaultValue={query.to ?? ""} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-600">Note or record id</span>
          <Input type="search" name="q" defaultValue={query.q ?? ""} />
        </label>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
          <button type="submit" className="rounded-full bg-navy-800 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-900">
            Filter
          </button>
          <Link href="/audit" className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-navy-800 hover:bg-navy-50">
            Clear
          </Link>
        </div>
      </form>

      <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-surface-sunken text-left text-xs uppercase tracking-wide text-ink-600">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Who</th>
              <th className="px-4 py-3">What</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line align-top">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-ink-500">
                  Nothing matches.
                </td>
              </tr>
            ) : null}
            {rows.map((entry) => (
              <Row key={entry.id} entry={entry} />
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 ? (
        <nav aria-label="Pages" className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          {current > 1 ? (
            <Link href={pageHref(current - 1) as never} className="font-semibold text-navy-800 hover:underline">
              ← Newer
            </Link>
          ) : null}
          <span className="text-ink-600">
            Page {current} of {pages} · {AUDIT_PAGE_SIZE} per page
          </span>
          {current < pages ? (
            <Link href={pageHref(current + 1) as never} className="font-semibold text-navy-800 hover:underline">
              Older →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}

function Row({ entry }: { entry: AuditEntry }) {
  const path = entityPath(entry.entityType, entry.entityId);
  const failed = entry.action === "signed_in_failed";
  const hasValues = entry.oldValue !== null || entry.newValue !== null;
  return (
    <tr className={failed ? "bg-danger-600/5" : undefined}>
      <td className="whitespace-nowrap px-4 py-3 text-ink-700">
        {formatDateTime(entry.createdAt)}
        {entry.ipAddress ? <div className="text-xs text-ink-500">{entry.ipAddress}</div> : null}
      </td>
      <td className="px-4 py-3">
        {entry.actor ? (
          <Link href={`/users/${entry.actor.id}`} className="font-medium text-navy-900 hover:underline">
            {entry.actor.name}
          </Link>
        ) : (
          <span className="text-ink-500">{failed || entry.action === "signed_in" ? "Not signed in" : "System"}</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className={failed ? "font-medium text-danger-600" : "font-medium text-navy-900"}>{ACTION_WORDS[entry.action as AuditAction] ?? entry.action}</span>{" "}
        {path ? (
          <Link href={path as never} className="text-navy-800 underline-offset-4 hover:underline">
            {entityWords(entry.entityType).toLowerCase()}
          </Link>
        ) : (
          <span className="text-ink-600">{entityWords(entry.entityType).toLowerCase()}</span>
        )}
      </td>
      <td className="px-4 py-3 text-ink-700">
        {entry.note}
        {hasValues ? (
          <details className="mt-1 text-xs">
            <summary className="cursor-pointer text-navy-800">Before and after</summary>
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              <pre className="overflow-x-auto rounded-md bg-surface-sunken p-2">{JSON.stringify(entry.oldValue, null, 1)}</pre>
              <pre className="overflow-x-auto rounded-md bg-surface-sunken p-2">{JSON.stringify(entry.newValue, null, 1)}</pre>
            </div>
          </details>
        ) : null}
      </td>
    </tr>
  );
}
