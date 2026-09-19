import type { Metadata } from "next";

import { requirePagePermission } from "@/lib/auth/dal";
import { ContentStatus } from "@/generated/prisma/enums";
import { listPages } from "@/lib/content-admin";
import { Alert } from "@/components/ui/alert";

import { ContentHeader, ContentTable } from "@/components/content/content-table";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pages" };

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function PagesPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePagePermission("content:write");
  const search = await searchParams;
  const status = one(search.status);
  const filters = { status: status && status in ContentStatus ? (status as ContentStatus) : undefined, q: one(search.q) };
  const rows = await listPages(filters);

  return (
    <div className="container-admin py-8">
      <ContentHeader title="Pages" count={rows.length} noun="page" basePath="/pages" newLabel="New page" />
      {one(search.deleted) === "1" ? <Alert tone="success" className="mt-6 max-w-3xl">Page deleted.</Alert> : null}
      <ContentTable basePath="/pages" noun="page" rows={rows} status={filters.status} q={filters.q} publicPrefix="/" newLabel="New page" />
    </div>
  );
}
