import Link from "next/link";

import { AnnouncementPlacement } from "@bass/db/enums";
import { getActiveAnnouncement } from "@bass/core/announcements";

/**
 * Site-wide announcement strip. Renders nothing at all when no announcement is
 * live, rather than reserving empty space.
 */
export async function AnnouncementBar({
  placement = AnnouncementPlacement.GLOBAL,
}: {
  placement?: AnnouncementPlacement;
}) {
  const announcement = await getActiveAnnouncement(placement);
  if (!announcement) return null;

  return (
    <div className="bg-gold-500 text-navy-950">
      <div className="container-page flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-2.5 text-center text-sm">
        <p className="font-semibold">{announcement.title}</p>
        {announcement.body ? (
          <p className="text-navy-900/85">{announcement.body}</p>
        ) : null}
        {announcement.linkHref && announcement.linkLabel ? (
          <Link
            href={announcement.linkHref as never}
            className="inline-flex items-center gap-1.5 border-b-2 border-navy-950/40 pb-0.5 font-semibold hover:border-navy-950"
          >
            {announcement.linkLabel}
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-3.5">
              <path
                d="M2 8h11M9 4l4 4-4 4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
