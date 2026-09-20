import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requirePagePermission } from "@/lib/auth/dal";
import { EmailStatus } from "@/generated/prisma/enums";
import { isMailDeliveryConfigured } from "@/lib/mail";
import { getOutboxMessage, isResendable, relatedPath } from "@/lib/mail-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { formatDateTime } from "@/components/applications/format";
import { OUTBOX_BADGES } from "@/components/outbox/badges";
import { OutboxNotice } from "@/components/outbox/notice";

import { resendMessageAction } from "../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const row = await getOutboxMessage(id);
  return { title: row ? row.subject : "Message" };
}

/** One message as it was (or will be) sent, with its delivery history. */
export default async function OutboxMessagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  await requirePagePermission("settings:write");
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const row = await getOutboxMessage(id);
  if (!row) notFound();

  const badge = OUTBOX_BADGES[row.status];
  const related = relatedPath(row.relatedType, row.relatedId);
  const configured = isMailDeliveryConfigured();

  return (
    <div className="container-admin max-w-5xl py-8">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-500">
        <Link href="/outbox" className="hover:underline">Outbox</Link>
        <span aria-hidden="true"> / </span>
        <span className="text-navy-900">{row.subject}</span>
      </nav>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">{row.subject}</h1>
          <p className="mt-1 text-sm text-ink-600">
            To <span className="font-medium text-navy-900">{row.toName ? `${row.toName} <${row.toAddress}>` : row.toAddress}</span>
            {" · "}created {formatDateTime(row.createdAt)}
          </p>
        </div>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </div>

      <OutboxNotice notice={query.notice} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <article className="overflow-hidden rounded-lg border border-line bg-white">
          <div className="border-b border-line bg-surface-sunken px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-600">
            Message as sent
          </div>
          {/* Our own template output, but rendered in an isolated frame all the
              same: nothing in it may run scripts or reach this page. */}
          <iframe
            title="Message preview"
            sandbox=""
            srcDoc={row.html}
            className="h-[36rem] w-full bg-white"
          />
          {row.text ? (
            <details className="border-t border-line px-4 py-3 text-sm">
              <summary className="cursor-pointer font-medium text-navy-800">Plain-text version</summary>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-ink-700">{row.text}</pre>
            </details>
          ) : null}
        </article>

        <aside className="flex flex-col gap-4 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg border border-line bg-white p-4">
            <dt className="text-ink-600">Status</dt>
            <dd><Badge tone={badge.tone}>{badge.label}</Badge></dd>
            <dt className="text-ink-600">Attempts</dt>
            <dd className="text-navy-900">{row.attempts}</dd>
            <dt className="text-ink-600">Sent</dt>
            <dd className="text-navy-900">{row.sentAt ? formatDateTime(row.sentAt) : <span className="text-ink-500">Not yet</span>}</dd>
            {related ? (
              <>
                <dt className="text-ink-600">About</dt>
                <dd>
                  <Link href={related as never} className="text-navy-800 underline decoration-navy-800/30 underline-offset-4 hover:decoration-navy-800">
                    Open {row.relatedType?.replace(/_/g, " ")}
                  </Link>
                </dd>
              </>
            ) : null}
          </dl>

          {row.lastError ? (
            <div className="rounded-lg border border-danger-600/25 bg-danger-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-danger-700">Last error</p>
              <p className="mt-1 break-words text-danger-700">{row.lastError}</p>
            </div>
          ) : null}

          {isResendable(row.status) ? (
            <form action={resendMessageAction} className="flex flex-col gap-2">
              <input type="hidden" name="id" value={row.id} />
              <input type="hidden" name="back" value="detail" />
              <Button type="submit" variant={row.status === EmailStatus.FAILED ? "primary" : "secondary"} disabled={!configured} withArrow>
                {row.status === EmailStatus.FAILED ? "Resend now" : "Send now"}
              </Button>
              {!configured ? <p className="text-xs text-ink-500">Delivery is not configured; see the notice on the outbox page.</p> : null}
            </form>
          ) : (
            <p className="text-xs text-ink-500">This message was delivered and will not be sent again.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
