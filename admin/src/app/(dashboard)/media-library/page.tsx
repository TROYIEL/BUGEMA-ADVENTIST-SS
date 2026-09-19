import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { requirePagePermission } from "@bass/auth/dal";
import { hasPermission } from "@bass/auth/rbac";
import { listFolders, listMediaAssets } from "@bass/core/media-library";
import { Alert } from "@bass/ui/alert";
import { Button } from "@bass/ui/button";
import { cn } from "@bass/ui/cn";
import { EmptyState } from "@bass/ui/empty-state";
import { Input, Label } from "@bass/ui/field";
import { Pagination, parsePageParam } from "@bass/ui/pagination";

import { formatBytes } from "@/components/applications/format";
import { UploadForm } from "@/components/media-library/forms";

import { uploadMedia } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Media library" };

type Search = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw ? raw : undefined;
}

/**
 * Every photograph the website may show, newest first. Uploads land here
 * and are then picked from here by hero slides, pages, news and the rest.
 */
export default async function MediaLibraryPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requirePagePermission("media:read");
  const search = await searchParams;
  const filters = { folder: one(search.folder), q: one(search.q)?.slice(0, 120) };
  const page = parsePageParam(search.page);

  const [{ rows, total, totalPages }, folders] = await Promise.all([
    listMediaAssets(filters, page),
    listFolders(),
  ]);
  const canWrite = hasPermission(user.role, "media:write");
  const query: Record<string, string | undefined> = { folder: filters.folder, q: filters.q };

  return (
    <div className="container-admin py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">Media library</h1>
          <p className="mt-1 text-sm text-ink-600">
            {total} {total === 1 ? "photograph" : "photographs"}
            {filters.folder ? ` in "${filters.folder}"` : ""}
            {filters.q ? ` matching "${filters.q}"` : ""}.
          </p>
        </div>
      </header>

      {one(search.deleted) === "1" ? (
        <Alert tone="success" className="mt-6 max-w-3xl">
          Photograph deleted.
        </Alert>
      ) : null}

      {canWrite ? (
        <details className="group/upload mt-6 rounded-lg border border-line bg-white" open={total === 0}>
          <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-navy-800 hover:bg-navy-50">
            <span className="group-open/upload:hidden">+ Upload photographs</span>
            <span className="hidden group-open/upload:inline">Upload photographs</span>
          </summary>
          <div className="border-t border-line px-5 py-5">
            <UploadForm action={uploadMedia} folders={folders} defaultFolder={filters.folder ?? "campus"} />
          </div>
        </details>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <FolderChip href="/media-library" active={!filters.folder} label="All" count={total} q={filters.q} />
        {folders
          .filter((folder) => folder.count > 0)
          .map((folder) => (
            <FolderChip
              key={folder.name}
              href={`/media-library?folder=${encodeURIComponent(folder.name)}`}
              active={filters.folder === folder.name}
              label={folder.name}
              count={folder.count}
              q={filters.q}
            />
          ))}
      </div>

      <form method="get" action="/media-library" className="mt-4 flex flex-wrap items-end gap-3">
        {filters.folder ? <input type="hidden" name="folder" value={filters.folder} /> : null}
        <div className="flex min-w-64 flex-col gap-1.5">
          <Label htmlFor="q">Search</Label>
          <Input id="q" name="q" type="search" placeholder="File name or description" defaultValue={filters.q ?? ""} />
        </div>
        <Button type="submit" size="md">Search</Button>
        {filters.q ? (
          <Link href={filters.folder ? `/media-library?folder=${encodeURIComponent(filters.folder)}` : "/media-library"} className="px-2 py-2 text-sm font-semibold text-navy-800 underline-offset-4 hover:underline">
            Clear
          </Link>
        ) : null}
      </form>

      {rows.length === 0 ? (
        <EmptyState
          className="mt-6"
          title={total === 0 && !filters.q ? "No photographs yet" : "Nothing matches"}
          description={total === 0 && !filters.q ? "Upload the school's photographs to use them across the website." : "Try another folder or search."}
        />
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
          {rows.map((asset) => (
            <li key={asset.id} className="group/card overflow-hidden rounded-lg border border-line bg-white">
              <Link href={`/media-library/${asset.id}`} className="block">
                <span className="relative block aspect-[4/3] bg-surface-sunken">
                  <Image
                    src={`/media/${asset.storageKey}`}
                    alt={asset.alt ?? ""}
                    fill
                    sizes="(min-width: 1536px) 16vw, (min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
                    className="object-cover transition-transform duration-300 group-hover/card:scale-[1.03]"
                  />
                  {!asset.alt ? (
                    <span className="absolute left-2 top-2 rounded-full bg-warning-50 px-2 py-0.5 text-[0.6875rem] font-semibold text-warning-700 ring-1 ring-inset ring-warning-600/30">
                      No description
                    </span>
                  ) : null}
                </span>
                <span className="block p-3">
                  <span className="block truncate text-sm font-medium text-navy-900">{asset.alt ?? asset.originalName}</span>
                  <span className="mt-0.5 block truncate text-xs text-ink-500">
                    {asset.folder} · {asset.width && asset.height ? `${asset.width}×${asset.height} · ` : ""}{formatBytes(asset.size)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination currentPage={page} totalPages={totalPages} basePath="/media-library" searchParams={query} />
    </div>
  );
}

function FolderChip({ href, active, label, count, q }: { href: string; active: boolean; label: string; count: number; q?: string }) {
  const target = q ? `${href}${href.includes("?") ? "&" : "?"}q=${encodeURIComponent(q)}` : href;
  return (
    <Link
      href={target as never}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors",
        active ? "bg-navy-800 text-white ring-navy-800" : "bg-white text-navy-800 ring-line-strong hover:bg-navy-50",
      )}
    >
      {label}
      <span className={cn("text-xs tabular-nums", active ? "text-navy-100" : "text-ink-500")}>{count}</span>
    </Link>
  );
}
