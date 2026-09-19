import type { Metadata } from "next";

import { EventCard } from "@/components/cards/content-cards";
import { PageHeader } from "@/components/site/page-header";
import { EmptyState } from "@bass/ui/empty-state";
import { ContentStatus } from "@bass/db/enums";
import { db } from "@bass/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Events",
  alternates: { canonical: "/events" },
};

const EVENT_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  startDate: true,
  endDate: true,
  startTime: true,
  location: true,
} as const;

export default async function EventsPage() {
  const now = new Date();

  const [upcoming, past] = await Promise.all([
    db.event.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        OR: [{ endDate: { gte: now } }, { startDate: { gte: now } }],
      },
      orderBy: { startDate: "asc" },
      select: EVENT_SELECT,
    }),
    db.event.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        startDate: { lt: now },
        OR: [{ endDate: null }, { endDate: { lt: now } }],
      },
      orderBy: { startDate: "desc" },
      take: 6,
      select: EVENT_SELECT,
    }),
  ]);

  return (
    <main id="main" className="flex flex-1 flex-col">
      <PageHeader title="Events" crumbs={[{ label: "Events" }]} />

      <div className="container-page py-14 md:py-16">
        <h2 className="font-serif text-2xl text-navy-900">Upcoming</h2>

        {upcoming.length === 0 ? (
          <EmptyState
            className="mt-6"
            title="No upcoming events"
            description="Open days, examinations and school events will be listed here once they are scheduled."
          />
        ) : (
          <ul className="mt-6 grid gap-4 lg:grid-cols-2">
            {upcoming.map((event) => (
              <li key={event.id}>
                <EventCard event={event} />
              </li>
            ))}
          </ul>
        )}

        {past.length > 0 ? (
          <>
            <h2 className="mt-16 font-serif text-2xl text-navy-900">Recent events</h2>
            <ul className="mt-6 grid gap-4 lg:grid-cols-2">
              {past.map((event) => (
                <li key={event.id}>
                  <EventCard event={event} />
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </main>
  );
}
