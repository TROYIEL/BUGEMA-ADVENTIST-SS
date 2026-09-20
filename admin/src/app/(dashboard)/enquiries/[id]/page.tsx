import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requirePagePermission } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/rbac";
import { EnquiryStatus } from "@/generated/prisma/enums";
import { isMailDeliveryConfigured } from "@/lib/mail";
import { getEnquiry, listEnquiryReplies, markEnquiryRead } from "@/lib/school-admin";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";

import { formatDateTime } from "@/components/applications/format";
import { ENQUIRY_BADGES } from "@/components/school/enquiry-badges";
import { ReplyForm } from "@/components/school/reply-form";

import { deleteEnquiryAction, replyToEnquiryAction, setEnquiryStatusAction } from "../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const row = await getEnquiry(id);
  return { title: row ? row.subject : "Enquiry" };
}

export default async function EnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("messages:read");
  const { id } = await params;
  const canWrite = hasPermission(user.role, "messages:write");
  // Opening it is reading it; a page render may not write, so this is a
  // deliberate exception kept to one idempotent update.
  if (canWrite) await markEnquiryRead(id, user.id);
  const row = await getEnquiry(id);
  if (!row) notFound();
  const replies = await listEnquiryReplies(id);

  const replySubject = encodeURIComponent(`Re: ${row.subject}`);
  const replyBody = encodeURIComponent(`\n\n----\nOn ${formatDateTime(row.createdAt)}, ${row.name} wrote:\n${row.body}`);

  const statusButton = (status: EnquiryStatus, label: string, variant: "secondary" | "danger" = "secondary") =>
    row.status === status ? null : (
      <form key={status} action={setEnquiryStatusAction}>
        <input type="hidden" name="id" value={row.id} />
        <input type="hidden" name="status" value={status} />
        <Button type="submit" size="sm" variant={variant}>{label}</Button>
      </form>
    );

  return (
    <div className="container-admin max-w-4xl py-8">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-500">
        <Link href="/enquiries" className="hover:underline">Enquiries</Link>
        <span aria-hidden="true"> / </span>
        <span className="text-navy-900">{row.subject}</span>
      </nav>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">{row.subject}</h1>
          <p className="mt-1 text-sm text-ink-600">
            From <span className="font-medium text-navy-900">{row.name}</span> · {formatDateTime(row.createdAt)}
            {row.handledBy ? ` · handled by ${row.handledBy.name}` : ""}
          </p>
        </div>
        <Badge tone={ENQUIRY_BADGES[row.status].tone}>{ENQUIRY_BADGES[row.status].label}</Badge>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <article className="rounded-lg border border-line bg-white">
          <div className="border-b border-line px-5 py-3 text-sm">
            <p><span className="text-ink-600">Email:</span> <a href={`mailto:${row.email}`} className="text-navy-900 hover:underline">{row.email}</a></p>
            {row.phone ? <p><span className="text-ink-600">Telephone:</span> <a href={`tel:${row.phone.replace(/\s+/g, "")}`} className="text-navy-900 hover:underline">{row.phone}</a></p> : null}
          </div>
          <p className="whitespace-pre-line px-5 py-5 text-[0.9375rem] leading-relaxed text-ink-800">{row.body}</p>
        </article>

        {/* The thread continues below the message: every reply the school has
            sent, newest last, then the box to write the next one. */}
        <div className="flex flex-col gap-4 lg:col-start-1">
          {replies.map((reply) => {
            const fate = reply.outbox?.status;
            return (
              <article key={reply.id} className="ml-6 rounded-lg border border-navy-200 bg-navy-50/50 sm:ml-12">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-navy-200/70 px-5 py-2.5 text-sm">
                  <p>
                    <span className="font-medium text-navy-900">{reply.sentBy?.name ?? "The school"}</span>
                    <span className="text-ink-600"> replied · {formatDateTime(reply.createdAt)}</span>
                  </p>
                  {fate === "SENT" ? (
                    <Badge tone="success">Sent by email</Badge>
                  ) : fate === "FAILED" ? (
                    <Link href={`/outbox/${reply.outbox!.id}` as never} className="underline decoration-danger-600/40 underline-offset-4">
                      <Badge tone="danger">Email failed — see outbox</Badge>
                    </Link>
                  ) : fate === "QUEUED" ? (
                    <Link href={`/outbox/${reply.outbox!.id}` as never} className="underline decoration-gold-600/40 underline-offset-4">
                      <Badge tone="gold">Queued, not yet sent</Badge>
                    </Link>
                  ) : (
                    <Badge tone="neutral">Saved</Badge>
                  )}
                </div>
                <p className="whitespace-pre-line px-5 py-4 text-[0.9375rem] leading-relaxed text-ink-800">{reply.body}</p>
              </article>
            );
          })}

          {canWrite ? (
            <section aria-label="Reply" className="rounded-lg border border-line bg-white p-5">
              <ReplyForm
                enquiryId={row.id}
                recipient={`${row.name} <${row.email}>`}
                action={replyToEnquiryAction}
                deliveryConfigured={isMailDeliveryConfigured()}
              />
            </section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-4 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <ButtonLink href={`mailto:${row.email}?subject=${replySubject}&body=${replyBody}` as never} variant="secondary" size="sm">
            Reply from your own mail program instead
          </ButtonLink>
          <p className="text-xs text-ink-500">Replies written below are sent from the school&rsquo;s address and kept on this page. Archive the enquiry once it is dealt with.</p>
          {canWrite ? (
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              {statusButton(EnquiryStatus.ARCHIVED, "Archive")}
              {statusButton(EnquiryStatus.UNREAD, "Mark unread")}
              {statusButton(EnquiryStatus.READ, "Mark read")}
              {statusButton(EnquiryStatus.SPAM, "Spam", "danger")}
            </div>
          ) : null}
          {canWrite ? (
            <form action={deleteEnquiryAction} className="border-t border-line pt-4">
              <input type="hidden" name="id" value={row.id} />
              <button type="submit" className="text-sm font-semibold text-danger-600 hover:underline">Delete permanently</button>
            </form>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
