import type { Metadata } from "next";

import { requirePagePermission } from "@/lib/auth/dal";
import { isAnnouncementLive, listAnnouncements } from "@/lib/content-admin";
import { PLACEMENT_LABELS } from "@/lib/content-shared";
import { Badge } from "@/components/ui/badge";

import { formatDateTime } from "@/components/applications/format";
import { ConfigRow, ConfigSection, DeleteControl } from "@/components/config/layout";
import { AnnouncementForm } from "@/components/content/forms";
import { toDateTimeInput } from "@/lib/forms";

import { deleteAnnouncementAction, saveAnnouncementAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Announcements" };

/**
 * The bar above the website's header. The highest-priority announcement in
 * its date window shows; one aimed at a section beats a general one there.
 */
export default async function AnnouncementsPage() {
  await requirePagePermission("announcements:write");
  const rows = await listAnnouncements();
  const live = rows.filter((row) => isAnnouncementLive(row)).length;

  return (
    <div className="container-admin max-w-5xl py-8">
      <header>
        <h1 className="text-2xl font-semibold text-navy-900">Announcements</h1>
        <p className="mt-1 text-sm text-ink-600">
          The bar above the website&rsquo;s header. {live === 0 ? "Nothing is showing at the moment." : `${live} showing now.`}{" "}
          Where several could show, the higher priority wins, and one aimed at a section beats a general one on that section.
        </p>
      </header>
      <div className="mt-6">
        <ConfigSection
          id="announcements"
          title="Announcements"
          hint="Showing ones first. Give an announcement dates and it looks after itself."
          add={
            <AnnouncementForm
              action={saveAnnouncementAction.bind(null, null)}
              values={{ title: "", body: "", linkLabel: "", linkHref: "", placement: "GLOBAL", priority: "0", startsAt: "", endsAt: "", isActive: true }}
              submitLabel="Add announcement"
            />
          }
        >
          {rows.map((row) => (
            <ConfigRow
              key={row.id}
              title={row.title}
              muted={!isAnnouncementLive(row)}
              badges={
                <>
                  {isAnnouncementLive(row) ? <Badge tone="success">Showing</Badge> : row.isActive ? <Badge tone="info">Outside its dates</Badge> : <Badge tone="neutral">Off</Badge>}
                  <Badge tone="navy">{PLACEMENT_LABELS[row.placement]}</Badge>
                </>
              }
              meta={[
                row.body,
                row.linkLabel ? `Link: ${row.linkLabel}` : null,
                row.priority ? `priority ${row.priority}` : null,
                row.startsAt ? `from ${formatDateTime(row.startsAt)}` : null,
                row.endsAt ? `until ${formatDateTime(row.endsAt)}` : null,
              ].filter(Boolean).join(" · ")}
              editor={
                <AnnouncementForm
                  action={saveAnnouncementAction.bind(null, row.id)}
                  values={{
                    title: row.title,
                    body: row.body ?? "",
                    linkLabel: row.linkLabel ?? "",
                    linkHref: row.linkHref ?? "",
                    placement: row.placement,
                    priority: String(row.priority),
                    startsAt: toDateTimeInput(row.startsAt),
                    endsAt: toDateTimeInput(row.endsAt),
                    isActive: row.isActive,
                  }}
                  submitLabel="Save"
                />
              }
              controls={<DeleteControl action={deleteAnnouncementAction} id={row.id} label={row.title} />}
            />
          ))}
        </ConfigSection>
      </div>
    </div>
  );
}
