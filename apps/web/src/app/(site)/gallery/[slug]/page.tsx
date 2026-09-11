import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GalleryGrid } from "@/components/gallery/lightbox";
import { PageHeader } from "@/components/site/page-header";
import { EmptyState } from "@bass/ui/empty-state";
import { ContentStatus } from "@bass/db/enums";
import { db } from "@bass/db";

export const dynamic = "force-dynamic";

async function getAlbum(slug: string) {
  return db.galleryAlbum.findFirst({
    where: { slug, status: ContentStatus.PUBLISHED },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      images: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          caption: true,
          media: {
            select: {
              storageKey: true,
              alt: true,
              width: true,
              height: true,
              blurDataUrl: true,
            },
          },
        },
      },
    },
  });
}

export async function generateMetadata(
  props: PageProps<"/gallery/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const album = await getAlbum(slug);
  if (!album) return {};

  return {
    title: album.title,
    ...(album.description ? { description: album.description } : {}),
    alternates: { canonical: `/gallery/${album.slug}` },
  };
}

export default async function GalleryAlbumPage(
  props: PageProps<"/gallery/[slug]">,
) {
  const { slug } = await props.params;
  const album = await getAlbum(slug);
  if (!album) notFound();

  const images = album.images.map((image) => ({
    id: image.id,
    caption: image.caption,
    storageKey: image.media.storageKey,
    alt: image.media.alt,
    width: image.media.width,
    height: image.media.height,
    blurDataUrl: image.media.blurDataUrl,
  }));

  return (
    <main id="main" className="flex flex-1 flex-col">
      <PageHeader
        title={album.title}
        subtitle={album.description}
        crumbs={[{ label: "Gallery", href: "/gallery" }, { label: album.title }]}
        size="compact"
      />

      <div className="container-page py-12 md:py-16">
        {images.length === 0 ? (
          <EmptyState title="This album is empty" />
        ) : (
          <GalleryGrid images={images} />
        )}
      </div>
    </main>
  );
}
