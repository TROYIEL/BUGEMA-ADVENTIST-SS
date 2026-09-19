import type { Metadata } from "next";
import Link from "next/link";

import { MediaImage } from "@/components/media-image";
import { PageHeader } from "@/components/site/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ContentStatus } from "@/generated/prisma/enums";
import { MEDIA_SELECT } from "@/lib/content";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gallery",
  alternates: { canonical: "/gallery" },
};

export default async function GalleryIndexPage() {
  const albums = await db.galleryAlbum.findMany({
    where: { status: ContentStatus.PUBLISHED },
    orderBy: { order: "asc" },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      coverImage: { select: MEDIA_SELECT },
      _count: { select: { images: true } },
    },
  });

  return (
    <main id="main" className="flex flex-1 flex-col">
      <PageHeader title="Gallery" crumbs={[{ label: "Gallery" }]} />

      <div className="container-page py-14 md:py-16">
        {albums.length === 0 ? (
          <EmptyState
            title="No albums yet"
            description="Photographs of school life will be published here."
          />
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {albums.map((album) => (
              <li key={album.id}>
                <article className="group relative isolate flex min-h-[18rem] flex-col justify-end overflow-hidden bg-navy-900">
                  {album.coverImage ? (
                    <div className="absolute inset-0 -z-10">
                      <MediaImage
                        asset={album.coverImage}
                        alt=""
                        sizes="(min-width: 1024px) 32vw, (min-width: 640px) 48vw, 100vw"
                        fill
                        className="object-cover transition-transform duration-500 ease-[var(--ease-out-soft)] group-hover:scale-[1.04]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/60 to-transparent" />
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-1.5 p-6">
                    <h2 className="font-serif text-2xl text-white">
                      <Link
                        href={`/gallery/${album.slug}` as never}
                        className="before:absolute before:inset-0"
                      >
                        {album.title}
                      </Link>
                    </h2>
                    <p className="text-sm text-navy-100">
                      {album._count.images}{" "}
                      {album._count.images === 1 ? "photograph" : "photographs"}
                    </p>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
