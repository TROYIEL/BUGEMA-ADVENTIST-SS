import type { Metadata } from "next";
import Link from "next/link";

import { requirePagePermission } from "@/lib/auth/dal";
import { EmailStatus } from "@/generated/prisma/enums";
import { isMailDeliveryConfigured } from "@/lib/mail";
import { OUTBOX_PAGE_SIZE, countOutbox, isResendable, listOutbox, relatedPath, type OutboxRow } from "@/lib/mail-admin";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Input } from "@/components/ui/field";

import { formatDateTime } from "@/components/applications/format";
import { OUTBOX_BADGES } from "@/components/outbox/badges";
import { OutboxNotice } from "@/components/outbox/notice";

import { resendAllAction, resendMessageAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Outbox" };

type Query = { status?: string; q?: string; page?: string; notice?: string; sent?: string; failed?: string };

const TABS: { key: string; label: string; status?: EmailStatus }[] = [
  { key: "all", label: "All" },
  { key: "QUEUED", label: "Queued", status: EmailStatus.QUEUED },
  { key: "FAILED", label: "Failed", status: EmailStatus.FAILED },
  { key: "SENT", label: "Sent", status: EmailStatus.SENT },
];

/**
 * Every email the system has tried to send, newest first, with what became
 * of it. Queued and failed messages can be retried from here.
 */
export default async function OutboxPage({ searchParams }: { searchParams: Promise<Query> }) {
  await requirePagePermission("settings:write");
  const query = await searchParams;
  const status = query.status && query.status in EmailStatus ? (query.status as EmailStatus) : undefined;
  const filters = { status, q: query.q?.trim() || undefined };
  const page = Math.max(1, Number(query.page) || 1);

  const [{ rows, total, pages, page: current }, counts] = await Promise.all([listOutbox(filters, page), countOutbox()]);
  const configured = isMailDeliveryConfigured();
  const pending = counts.QUEUED + counts.FAILED;

  const href = (overrides: Partial<Query>) => {
    const params = new URLSearchParams();
    const next = { status: query.status, q: query.q, page: undefined, ...overrides };
    for (const [key, value] of Object.entries(next)) if (value) params.set(key, value);
    const qs = params.toString();
    return `/outbox${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="container-admin max-w-6xl py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">Outbox</h1>
          <p className="mt-1 text-sm text-ink-600">
            Every email the system has tried to send. {counts.all.toLocaleString("en-GB")} {counts.all === 1 ? "message" : "messages"}
            {pending > 0 ? `, ${pending} waiting to go out` : ""}.
          </p>
        </div>
        {pending > 0 && configured ? (
          <form action={resendAllAction}>
            <Button type="submit" variant="secondary" size="sm">
              Retry all {pending} waiting
            </Button>
          </form>
        ) : null}
      </header>

      {!configured ? (
        <Alert tone="warning" title="Email is not being delivered" className="mt-6 max-w-3xl">
          No SMTP server is configured, so messages are recorded here but never sent. Set <code>MAIL_DRIVER=smtp</code> and the
          <code> SMTP_*</code> variables; queued messages will then go out on the next retry.
        </Alert>
      ) : null}

      <OutboxNotice notice={query.notice} sent={query.sent} failed={query.failed} />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter by status" className="flex flex-wrap gap-1 rounded-full border border-line bg-white p-1 text-sm">
          {TABS.map((tab) => {
            const active = (tab.status ?? undefined) === status;
            const count = tab.status ? counts[tab.status] : counts.all;
            return (
              <Link
                key={tab.key}
                href={href({ status: tab.status }) as never}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full px-3 py-1.5 font-medium tabular-nums",
                  active ? "bg-navy-900 text-white" : "text-ink-700 hover:bg-navy-50",
                )}
              >
                {tab.label} <span className={active ? "text-white/70" : "text-ink-500"}>{count}</span>
              </Link>
            );
          })}
        </nav>
        <form role="search" className="flex gap-2">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <label className="sr-only" htmlFor="outbox-q">Search subject or address</label>
          <Input id="outbox-q" type="search" name="q" placeholder="Subject or address" defaultValue={query.q ?? ""} className="w-64" />
          <Button type="submit" variant="secondary" size="sm">Search</Button>
        </form>
      </div>

      <div className="mt-4 relative overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-surface-sunken text-left text-xs uppercase tracking-wide text-ink-600">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">To</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line align-top">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-500">
                  {counts.all === 0 ? "No email has been sent yet." : "Nothing matches."}
                </td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <Row key={row.id} row={row} configured={configured} />
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 ? (
        <nav aria-label="Pages" className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          {current > 1 ? (
            <Link href={href({ page: String(current - 1) }) as never} className="font-semibold text-navy-800 hover:underline">
              ← Newer
            </Link>
          ) : null}
          <span className="text-ink-600">
            Page {current} of {pages} · {OUTBOX_PAGE_SIZE} per page · {total.toLocaleString("en-GB")} in this view
          </span>
          {current < pages ? (
            <Link href={href({ page: String(current + 1) }) as never} className="font-semibold text-navy-800 hover:underline">
              Older →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}

function Row({ row, configured }: { row: OutboxRow; configured: boolean }) {
  const badge = OUTBOX_BADGES[row.status];
  const related = relatedPath(row.relatedType, row.relatedId);
  return (
    <tr className={row.status === EmailStatus.FAILED ? "bg-danger-600/5" : undefined}>
      <td className="whitespace-nowrap px-4 py-3 text-ink-700">
        {formatDateTime(row.createdAt)}
        {row.sentAt ? <div className="text-xs text-ink-500">sent {formatDateTime(row.sentAt)}</div> : null}
      </td>
      <td className="px-4 py-3">
        <div className="font-medium text-navy-900">{row.toName ?? row.toAddress}</div>
        {row.toName ? <div className="text-xs text-ink-500">{row.toAddress}</div> : null}
      </td>
      <td className="px-4 py-3">
        <Link href={`/outbox/${row.id}` as never} className="font-medium text-navy-900 underline decoration-navy-900/30 underline-offset-4 hover:decoration-navy-900">
          {row.subject}
        </Link>
        {related ? (
          <div className="text-xs">
            <Link href={related as never} className="text-navy-800 underline decoration-navy-800/30 underline-offset-4 hover:decoration-navy-800">
              Open {row.relatedType?.replace(/_/g, " ")}
            </Link>
          </div>
        ) : null}
        {row.lastError ? <p className="mt-1 max-w-md text-xs text-danger-700">{row.lastError}</p> : null}
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <Badge tone={badge.tone}>{badge.label}</Badge>
        <div className="mt-1 text-xs text-ink-500">
          {row.attempts} {row.attempts === 1 ? "attempt" : "attempts"}
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        {isResendable(row.status) ? (
          <form action={resendMessageAction}>
            <input type="hidden" name="id" value={row.id} />
            <Button type="submit" size="sm" variant={row.status === EmailStatus.FAILED ? "primary" : "secondary"} disabled={!configured}>
              {row.status === EmailStatus.FAILED ? "Resend" : "Send now"}
            </Button>
          </form>
        ) : null}
      </td>
    </tr>
  );
}
