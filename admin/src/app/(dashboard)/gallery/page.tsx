import type { Metadata } from "next";

import { requirePagePermission } from "@/lib/auth/dal";
import { ContentStatus } from "@/generated/prisma/enums";
import { listAlbums } from "@/lib/content-admin";
import { Alert } from "@/components/ui/alert";

import { ContentHeader, ContentTable } from "@/components/content/content-table";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Gallery" };

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function GalleryListPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePagePermission("content:write");
  const search = await searchParams;
  const status = one(search.status);
  const filters = { status: status && status in ContentStatus ? (status as ContentStatus) : undefined, q: one(search.q) };
  const rows = await listAlbums(filters);

  return (
    <div className="container-admin py-8">
      <ContentHeader title="Gallery" count={rows.length} noun="album" basePath="/gallery" newLabel="New album" />
      {one(search.deleted) === "1" ? <Alert tone="success" className="mt-6 max-w-3xl">Album deleted.</Alert> : null}
      <ContentTable basePath="/gallery" noun="album" rows={rows} status={filters.status} q={filters.q} publicPrefix="/gallery/" newLabel="New album" />
    </div>
  );
}
