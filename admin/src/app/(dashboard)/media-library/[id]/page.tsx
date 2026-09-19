import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requirePagePermission } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/rbac";
import { getMediaAsset, listFolders, mediaUsage } from "@/lib/media-library";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { formatBytes, formatDateTime } from "@/components/applications/format";
import { DetailsForm } from "@/components/media-library/forms";

import { deleteMedia, updateMedia } from "../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const asset = await getMediaAsset(id);
  return { title: asset ? (asset.alt ?? asset.originalName) : "Photograph" };
}

export default async function MediaAssetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ inuse?: string }>;
}) {
  const user = await requirePagePermission("media:read");
  const [{ id }, { inuse }] = await Promise.all([params, searchParams]);
  const [asset, folders] = await Promise.all([getMediaAsset(id), listFolders()]);
  if (!asset) notFound();
  const usage = await mediaUsage(id);
  const canWrite = hasPermission(user.role, "media:write");
  const canDelete = hasPermission(user.role, "media:delete");

  return (
    <div className="container-admin py-8">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-500">
        <Link href="/media-library" className="hover:underline">Media library</Link>
        <span aria-hidden="true"> / </span>
        <Link href={`/media-library?folder=${encodeURIComponent(asset.folder)}` as never} className="hover:underline">{asset.folder}</Link>
        <span aria-hidden="true"> / </span>
        <span className="text-navy-900">{asset.originalName}</span>
      </nav>
      <h1 className="mt-3 text-2xl font-semibold text-navy-900">{asset.alt ?? asset.originalName}</h1>

      {inuse === "1" ? (
        <Alert tone="warning" className="mt-4 max-w-3xl" title="Not deleted">
          This photograph is still in use. Change or remove it in the places listed
          under &ldquo;Where it is used&rdquo;, then delete it.
        </Alert>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex flex-col gap-6">
          <div className="overflow-hidden rounded-lg border border-line bg-navy-950">
            <div className="relative aspect-[4/3]">
              <Image
                src={`/media/${asset.storageKey}`}
                alt={asset.alt ?? ""}
                fill
                sizes="(min-width: 1024px) 60vw, 100vw"
                className="object-contain"
              />
            </div>
          </div>

          <section className="rounded-lg border border-line bg-white">
            <div className="border-b border-line px-5 py-3">
              <h2 className="text-base font-semibold text-navy-900">Details</h2>
            </div>
            <div className="px-5 py-5">
              {canWrite ? (
                <DetailsForm
                  action={updateMedia.bind(null, asset.id)}
                  folders={folders}
                  values={{ alt: asset.alt ?? "", caption: asset.caption ?? "", folder: asset.folder }}
                />
              ) : (
                <dl className="flex flex-col gap-2 text-sm">
                  <div><dt className="font-semibold text-ink-600">Description</dt><dd className="text-navy-900">{asset.alt ?? "—"}</dd></div>
                  <div><dt className="font-semibold text-ink-600">Caption</dt><dd className="text-navy-900">{asset.caption ?? "—"}</dd></div>
                </dl>
              )}
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <section className="rounded-lg border border-line bg-white">
            <div className="border-b border-line px-5 py-3">
              <h2 className="text-base font-semibold text-navy-900">File</h2>
            </div>
            <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-2 px-5 py-4 text-sm">
              <dt className="text-ink-600">Name</dt><dd className="break-all text-navy-900">{asset.originalName}</dd>
              <dt className="text-ink-600">Size</dt><dd className="text-navy-900">{asset.width && asset.height ? `${asset.width}×${asset.height} · ` : ""}{formatBytes(asset.size)}</dd>
              <dt className="text-ink-600">Format</dt><dd className="text-navy-900">{asset.mimeType.replace("image/", "").toUpperCase()}</dd>
              <dt className="text-ink-600">Uploaded</dt><dd className="text-navy-900">{formatDateTime(asset.createdAt)}{asset.uploadedBy ? ` by ${asset.uploadedBy.name}` : ""}</dd>
              <dt className="text-ink-600">Address</dt><dd className="break-all font-mono text-xs text-navy-900">/media/{asset.storageKey}</dd>
            </dl>
          </section>

          <section className="rounded-lg border border-line bg-white">
            <div className="border-b border-line px-5 py-3">
              <h2 className="text-base font-semibold text-navy-900">Where it is used</h2>
            </div>
            <div className="px-5 py-4 text-sm">
              {usage.length === 0 ? (
                <p className="text-ink-600">Nowhere yet. It can be deleted safely.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {usage.map((entry, index) => (
                    <li key={index} className="text-navy-900">
                      <span className="text-ink-600">{entry.where}:</span> {entry.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {canDelete ? (
              <div className="border-t border-line px-5 py-4">
                <form action={deleteMedia}>
                  <input type="hidden" name="id" value={asset.id} />
                  <Button type="submit" variant="danger" size="sm" disabled={usage.length > 0}>
                    Delete photograph
                  </Button>
                </form>
                <p className="mt-2 text-xs text-ink-500">
                  {usage.length > 0 ? "Remove it from the places above first." : "Removes the file as well. This cannot be undone."}
                </p>
              </div>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
