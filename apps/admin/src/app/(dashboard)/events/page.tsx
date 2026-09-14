import type { Metadata } from "next";

import { requirePagePermission } from "@bass/auth/dal";
import { ContentStatus } from "@bass/db/enums";
import { listEvents } from "@bass/core/content-admin";
import { Alert } from "@bass/ui/alert";

import { ContentHeader, ContentTable } from "@/components/content/content-table";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Events" };

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function EventsListPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePagePermission("content:write");
  const search = await searchParams;
  const status = one(search.status);
  const filters = { status: status && status in ContentStatus ? (status as ContentStatus) : undefined, q: one(search.q) };
  const rows = await listEvents(filters);

  return (
    <div className="container-admin py-8">
      <ContentHeader title="Events" count={rows.length} noun="event" basePath="/events" newLabel="New event" />
      {one(search.deleted) === "1" ? <Alert tone="success" className="mt-6 max-w-3xl">Event deleted.</Alert> : null}
      <ContentTable basePath="/events" noun="event" rows={rows} status={filters.status} q={filters.q} publicPrefix="/events/" newLabel="New event" />
    </div>
  );
}
