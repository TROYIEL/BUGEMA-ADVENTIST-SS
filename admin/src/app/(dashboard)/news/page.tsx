import type { Metadata } from "next";

import { requirePagePermission } from "@bass/auth/dal";
import { ContentStatus } from "@bass/db/enums";
import { listNews } from "@bass/core/content-admin";
import { Alert } from "@bass/ui/alert";

import { ContentHeader, ContentTable } from "@/components/content/content-table";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "News" };

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function NewsListPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePagePermission("content:write");
  const search = await searchParams;
  const status = one(search.status);
  const filters = { status: status && status in ContentStatus ? (status as ContentStatus) : undefined, q: one(search.q) };
  const rows = await listNews(filters);

  return (
    <div className="container-admin py-8">
      <ContentHeader title="News" count={rows.length} noun="story" basePath="/news" newLabel="New story" />
      {one(search.deleted) === "1" ? <Alert tone="success" className="mt-6 max-w-3xl">Story deleted.</Alert> : null}
      <ContentTable basePath="/news" noun="story" rows={rows} status={filters.status} q={filters.q} publicPrefix="/news/" newLabel="New story" />
    </div>
  );
}
