import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { requirePagePermission } from "@bass/auth/dal";
import { ContentStatus } from "@bass/db/enums";
import { getAlbum } from "@bass/core/content-admin";
import { listImageChoices } from "@bass/core/media-library";
import { Button } from "@bass/ui/button";
import { Input } from "@bass/ui/field";

import { EditorShell, siteUrl } from "@/components/content/editor-shell";
import { AlbumForm } from "@/components/content/forms";

import {
  addAlbumImagesAction,
  deleteAlbumAction,
  moveAlbumImageAction,
  removeAlbumImageAction,
  saveAlbumAction,
  updateAlbumImageAction,
} from "../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const album = await getAlbum(id);
  return { title: album ? `Edit: ${album.title}` : "Album" };
}

export default async function EditAlbumPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  await requirePagePermission("content:write");
  const [{ id }, { saved }] = await Promise.all([params, searchParams]);
  const [album, choices] = await Promise.all([getAlbum(id), listImageChoices()]);
  if (!album) notFound();

  const inAlbum = new Set(album.images.map((image) => image.media.id));
  const available = choices.filter((choice) => !inAlbum.has(choice.id));

  return (
    <EditorShell
      crumbs={[{ label: "Gallery", href: "/gallery" }, { label: album.title }]}
      title={album.title}
      saved={saved === "1"}
      viewHref={album.status === ContentStatus.PUBLISHED ? siteUrl(`/gallery/${album.slug}`) : null}
      deleteAction={deleteAlbumAction}
      deleteId={album.id}
      deleteNote="Removes the album. The photographs stay in the media library."
    >
      <div className="flex flex-col gap-8">
        <AlbumForm
          action={saveAlbumAction.bind(null, album.id)}
          values={{
            title: album.title,
            slug: album.slug,
            description: album.description ?? "",
            category: album.category ?? "",
            status: album.status,
            coverImageId: album.coverImageId ?? "",
          }}
          choices={choices}
          isNew={false}
        />

        {/* ---- Photographs in the album ---------------------------------- */}
        <section className="rounded-lg border border-line bg-white">
          <div className="border-b border-line px-5 py-3">
            <h2 className="text-base font-semibold text-navy-900">Photographs</h2>
            <p className="mt-0.5 text-sm text-ink-600">
              {album.images.length === 0 ? "None yet. Add some below." : `${album.images.length} in this order. Captions are optional.`}
            </p>
          </div>
          {album.images.length > 0 ? (
            <ol className="divide-y divide-line">
              {album.images.map((image, index) => (
                <li key={image.id} className="grid gap-4 px-5 py-4 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-center">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-surface-sunken">
                    <Image src={`/media/${image.media.storageKey}`} alt={image.media.alt ?? ""} fill sizes="7rem" className="object-cover" />
                  </div>
                  <form action={updateAlbumImageAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="albumId" value={album.id} />
                    <input type="hidden" name="imageId" value={image.id} />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <label htmlFor={`caption-${image.id}`} className="text-xs font-semibold text-ink-600">
                        {image.media.alt ?? image.media.originalName}
                      </label>
                      <Input id={`caption-${image.id}`} name="caption" placeholder="Caption (optional)" defaultValue={image.caption ?? ""} />
                    </div>
                    <Button type="submit" size="sm" variant="secondary">Save caption</Button>
                  </form>
                  <div className="flex items-center gap-1">
                    {(["up", "down"] as const).map((direction) => (
                      <form key={direction} action={moveAlbumImageAction}>
                        <input type="hidden" name="albumId" value={album.id} />
                        <input type="hidden" name="imageId" value={image.id} />
                        <input type="hidden" name="direction" value={direction} />
                        <button
                          type="submit"
                          disabled={direction === "up" ? index === 0 : index === album.images.length - 1}
                          aria-label={`Move photograph ${index + 1} ${direction}`}
                          className="grid size-8 place-items-center rounded-md border border-line text-navy-800 hover:bg-navy-50 disabled:opacity-30"
                        >
                          {direction === "up" ? "↑" : "↓"}
                        </button>
                      </form>
                    ))}
                    <form action={removeAlbumImageAction}>
                      <input type="hidden" name="albumId" value={album.id} />
                      <input type="hidden" name="imageId" value={image.id} />
                      <button type="submit" aria-label={`Remove photograph ${index + 1} from the album`} className="ml-1 px-2 py-1 text-sm font-semibold text-danger-600 hover:underline">
                        Remove
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ol>
          ) : null}
        </section>

        {/* ---- Add from the library -------------------------------------- */}
        <section className="rounded-lg border border-line bg-white">
          <div className="border-b border-line px-5 py-3">
            <h2 className="text-base font-semibold text-navy-900">Add photographs</h2>
            <p className="mt-0.5 text-sm text-ink-600">
              Tick the ones to add from the media library. Upload new ones there first.
            </p>
          </div>
          {available.length === 0 ? (
            <p className="px-5 py-4 text-sm text-ink-500">Every photograph in the library is already in this album.</p>
          ) : (
            <form action={addAlbumImagesAction} className="px-5 py-4">
              <input type="hidden" name="albumId" value={album.id} />
              <ul className="grid gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {available.map((choice) => (
                  <li key={choice.id}>
                    <label className="group/pick block cursor-pointer">
                      <span className="relative block aspect-[4/3] overflow-hidden rounded-md border border-line bg-surface-sunken has-[:checked]:border-navy-700 has-[:checked]:ring-2 has-[:checked]:ring-navy-600/40">
                        <input type="checkbox" name="mediaIds" value={choice.id} className="absolute left-2 top-2 z-10 size-4 accent-navy-800" />
                        <Image src={`/media/${choice.storageKey}`} alt={choice.alt ?? ""} fill sizes="12rem" className="object-cover" />
                      </span>
                      <span className="mt-1 block truncate text-xs text-ink-600">{choice.alt ?? choice.originalName}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <Button type="submit" size="sm">Add the ticked photographs</Button>
              </div>
            </form>
          )}
        </section>
      </div>
    </EditorShell>
  );
}
