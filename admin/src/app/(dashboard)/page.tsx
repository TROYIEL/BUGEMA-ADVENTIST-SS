import type { Metadata } from "next";
import { CalendarDays, FileCheck2, FileText, FolderOpen, Inbox, Newspaper, Send, Settings, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { ApplicationStatus, ContentStatus, EnquiryStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/dal";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_PERMISSIONS, hasPermission } from "@/lib/auth/rbac";
import { getSiteSettings, getUnconfiguredSettings } from "@/lib/settings";
import { isMailDeliveryConfigured } from "@/lib/mail";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { ButtonLink } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Dashboard" };

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  attention = false,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: LucideIcon;
  /** Where the number leads; the whole tile becomes the link. */
  href?: string;
  /** True when the number is work waiting for someone, not just a total. */
  attention?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">{label}</p>
        <span
          aria-hidden="true"
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full",
            attention && Number(value) > 0 ? "bg-gold-100 text-gold-800" : "bg-navy-50 text-navy-700",
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-1.5 text-3xl font-semibold tabular-nums text-navy-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-500">{hint}</p> : null}
    </>
  );
  const className = "block rounded-lg border border-line bg-white p-4";
  return href ? (
    <Link href={href as never} className={cn(className, "transition-colors hover:border-navy-300 hover:bg-navy-50/40")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export default async function DashboardPage() {
  // Enforced here, server-side — not in the layout, and not only in proxy.ts.
  const user = await requirePagePermission("admin:access");

  const [
    settings,
    applicationsTotal,
    applicationsNew,
    applicationsDecided,
    newsPublished,
    newsDrafts,
    eventsUpcoming,
    mediaCount,
    enquiriesUnread,
    queuedMail,
  ] = await Promise.all([
    getSiteSettings(),
    db.application.count({ where: { status: { not: ApplicationStatus.DRAFT } } }),
    db.application.count({ where: { status: ApplicationStatus.SUBMITTED } }),
    db.application.count({
      where: {
        status: {
          in: [
            ApplicationStatus.ACCEPTED,
            ApplicationStatus.CONDITIONALLY_ACCEPTED,
            ApplicationStatus.REJECTED,
          ],
        },
      },
    }),
    db.newsArticle.count({ where: { status: ContentStatus.PUBLISHED } }),
    db.newsArticle.count({ where: { status: ContentStatus.DRAFT } }),
    db.event.count({
      where: { status: ContentStatus.PUBLISHED, startDate: { gte: new Date() } },
    }),
    db.mediaAsset.count(),
    db.contactEnquiry.count({ where: { status: EnquiryStatus.UNREAD } }),
    db.emailOutbox.count({ where: { status: { in: ["QUEUED", "FAILED"] } } }),
  ]);

  const outstanding = getUnconfiguredSettings(settings);
  const mailConfigured = isMailDeliveryConfigured();

  // The overview mirrors the role, exactly as the sidebar does. A content
  // editor has no business seeing applicant figures — even aggregate counts
  // say something about the school's intake — so those tiles are not rendered
  // for them at all, rather than rendered and hidden with CSS.
  const canSeeApplications = hasPermission(user.role, "applications:read");
  const canSeeEnquiries = hasPermission(user.role, "messages:read");
  const canSeeMedia = hasPermission(user.role, "media:read");
  const canSeeSettings = hasPermission(user.role, "settings:write");

  return (
    <div className="container-admin py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">
            Welcome, {user.name}
          </h1>
          <p className="mt-1 text-sm text-ink-600">{ROLE_DESCRIPTIONS[user.role]}</p>
        </div>
        <Badge tone="navy">{ROLE_LABELS[user.role]}</Badge>
      </header>

      <section aria-label="Overview" className="mt-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {canSeeApplications ? (
            <>
              <StatCard
                label="Applications"
                value={applicationsTotal}
                hint={`${applicationsNew} awaiting first review`}
                icon={FileText}
                href="/applications"
              />
              <StatCard
                label="Decided"
                value={applicationsDecided}
                hint="Accepted, conditional or rejected"
                icon={FileCheck2}
                href="/applications"
              />
            </>
          ) : null}
          <StatCard
            label="News published"
            value={newsPublished}
            hint={newsDrafts > 0 ? `${newsDrafts} in draft` : "No drafts"}
            icon={Newspaper}
            href="/news"
          />
          <StatCard label="Upcoming events" value={eventsUpcoming} icon={CalendarDays} href="/events" />
          {canSeeMedia ? <StatCard label="Media files" value={mediaCount} icon={FolderOpen} href="/media-library" /> : null}
          {canSeeEnquiries ? (
            <StatCard
              label="Unread enquiries"
              value={enquiriesUnread}
              hint={enquiriesUnread > 0 ? "Needs a reply" : "All caught up"}
              icon={Inbox}
              href="/enquiries?status=UNREAD"
              attention
            />
          ) : null}
          {canSeeSettings ? (
            <>
              <StatCard
                label="Mail waiting"
                value={queuedMail}
                hint={mailConfigured ? "Queued or failed — see Outbox" : "Not being delivered"}
                icon={Send}
                href="/outbox"
                attention
              />
              <StatCard
                label="Settings to complete"
                value={outstanding.length}
                hint={outstanding.length === 0 ? "All filled in" : "Awaiting real values"}
                icon={Settings}
                href="/settings"
                attention
              />
            </>
          ) : null}
        </div>
      </section>

      {canSeeSettings && !mailConfigured && queuedMail > 0 ? (
        <Alert tone="warning" title="Email is not being delivered" className="mt-6 max-w-3xl">
          {queuedMail} {queuedMail === 1 ? "message is" : "messages are"} sitting in
          the <Link href="/outbox" className="font-semibold underline">outbox</Link>. No SMTP server is configured, so
          nothing has actually been sent. Set the SMTP_* variables to start delivery.
        </Alert>
      ) : null}

      {canSeeSettings && outstanding.length > 0 ? (
        <section className="mt-8 max-w-4xl rounded-lg border border-line bg-white p-5">
          <h2 className="text-base font-semibold text-navy-900">Complete your site</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-600">
            {outstanding.length} settings still need real values from the school.
            Until they are filled in the public website leaves them out rather
            than showing a placeholder.{" "}
            <Link href="/settings" className="font-semibold text-navy-800 underline-offset-4 hover:underline">
              Fill them in
            </Link>
            .
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {outstanding.slice(0, 14).map(({ key, definition }) => (
              <li key={key}>
                <Badge tone="warning">{definition.label}</Badge>
              </li>
            ))}
            {outstanding.length > 14 ? (
              <li>
                <Badge tone="neutral">+{outstanding.length - 14} more</Badge>
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      {canSeeApplications ? (
        <section className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/applications" size="sm" withArrow>
            Review applications
          </ButtonLink>
          {hasPermission(user.role, "documents:review") ? (
            <ButtonLink href="/documents" size="sm" variant="secondary">
              Documents to review
            </ButtonLink>
          ) : null}
        </section>
      ) : null}

      <p className="mt-6 text-xs text-ink-500">
        You have {ROLE_PERMISSIONS[user.role].length} permissions.
      </p>
    </div>
  );
}
