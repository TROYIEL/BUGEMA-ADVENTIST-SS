import type { Metadata } from "next";

import { ApplicationStatus, ContentStatus, EnquiryStatus } from "@bass/db/enums";
import { db } from "@bass/db";
import { requirePagePermission } from "@bass/auth/dal";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_PERMISSIONS, hasPermission } from "@bass/auth/rbac";
import { getSiteSettings, getUnconfiguredSettings } from "@bass/core/settings";
import { isMailDeliveryConfigured } from "@bass/core/mail";
import { Alert } from "@bass/ui/alert";
import { Badge } from "@bass/ui/badge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Dashboard" };

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">
        {label}
      </p>
      <p className="mt-1.5 text-3xl font-semibold tabular-nums text-navy-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-500">{hint}</p> : null}
    </div>
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
    db.emailOutbox.count({ where: { status: "QUEUED" } }),
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
              />
              <StatCard
                label="Decided"
                value={applicationsDecided}
                hint="Accepted, conditional or rejected"
              />
            </>
          ) : null}
          <StatCard
            label="News published"
            value={newsPublished}
            hint={newsDrafts > 0 ? `${newsDrafts} in draft` : "No drafts"}
          />
          <StatCard label="Upcoming events" value={eventsUpcoming} />
          {canSeeMedia ? <StatCard label="Media files" value={mediaCount} /> : null}
          {canSeeEnquiries ? (
            <StatCard
              label="Unread enquiries"
              value={enquiriesUnread}
              hint={enquiriesUnread > 0 ? "Needs a reply" : "All caught up"}
            />
          ) : null}
          {canSeeSettings ? (
            <>
              <StatCard
                label="Mail queued"
                value={queuedMail}
                hint={mailConfigured ? "Sending is configured" : "Not being delivered"}
              />
              <StatCard
                label="Settings to complete"
                value={outstanding.length}
                hint={outstanding.length === 0 ? "All filled in" : "Awaiting real values"}
              />
            </>
          ) : null}
        </div>
      </section>

      {canSeeSettings && !mailConfigured && queuedMail > 0 ? (
        <Alert tone="warning" title="Email is not being delivered" className="mt-6 max-w-3xl">
          {queuedMail} {queuedMail === 1 ? "message is" : "messages are"} sitting in
          the outbox. No SMTP server is configured, so nothing has actually been
          sent. Set the SMTP_* variables to start delivery.
        </Alert>
      ) : null}

      {canSeeSettings && outstanding.length > 0 ? (
        <section className="mt-8 max-w-4xl rounded-lg border border-line bg-white p-5">
          <h2 className="text-base font-semibold text-navy-900">Complete your site</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-600">
            {outstanding.length} settings still need real values from the school.
            Until they are filled in the public website leaves them out rather
            than showing a placeholder.
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

      <Alert tone="info" title="Milestone 4" className="mt-8 max-w-3xl">
        The management modules in the sidebar — applications, content, media,
        staff and settings — are built next. Everything shown above is live data
        from the database.
      </Alert>

      <p className="mt-6 text-xs text-ink-500">
        You have {ROLE_PERMISSIONS[user.role].length} permissions.
      </p>
    </div>
  );
}
