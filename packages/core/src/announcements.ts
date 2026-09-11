import "server-only";

import { cache } from "react";

import { AnnouncementPlacement } from "@bass/db/enums";
import { db } from "@bass/db";

export type ActiveAnnouncement = {
  id: string;
  title: string;
  body: string | null;
  linkLabel: string | null;
  linkHref: string | null;
};

/**
 * The highest-priority announcement currently in its date window.
 *
 * GLOBAL announcements show everywhere; a placement-specific one takes
 * precedence on its own section.
 */
export const getActiveAnnouncement = cache(
  async (
    placement: AnnouncementPlacement = AnnouncementPlacement.GLOBAL,
  ): Promise<ActiveAnnouncement | null> => {
    const now = new Date();

    const placements =
      placement === AnnouncementPlacement.GLOBAL
        ? [AnnouncementPlacement.GLOBAL]
        : [placement, AnnouncementPlacement.GLOBAL];

    const announcements = await db.announcement.findMany({
      where: {
        isActive: true,
        placement: { in: placements },
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        body: true,
        linkLabel: true,
        linkHref: true,
        placement: true,
      },
      take: 5,
    });

    if (announcements.length === 0) return null;

    // Prefer a placement-specific announcement over a global one at equal priority.
    const specific = announcements.find((item) => item.placement === placement);
    return specific ?? announcements[0];
  },
);
