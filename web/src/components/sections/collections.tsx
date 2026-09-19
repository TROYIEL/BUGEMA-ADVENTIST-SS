import Link from "next/link";

import {
  EventCard,
  NewsCard,
  ProgramCard,
} from "@/components/cards/content-cards";
import { MediaImage } from "@/components/media-image";
import type { BlockContent } from "@/components/sections/blocks";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/card";
import {
  getAcademicPrograms,
  getGalleryPreview,
  getLatestNews,
  getUpcomingEvents,
} from "@/lib/content";

/**
 * Sections backed by a collection.
 *
 * Each returns `null` when the collection is empty. A "Latest news" heading
 * above nothing looks broken; on a school site that has not published yet, the
 * honest presentation is to omit the section entirely.
 */

function SectionFooterLink({
  label,
  href,
}: {
  label?: string | null;
  href?: string | null;
}) {
  if (!label || !href) return null;

  return (
    <div className="mt-10">
      <ButtonLink href={href as never} variant="secondary" withArrow>
        {label}
      </ButtonLink>
    </div>
  );
}

export async function NewsSection({
  content,
  limit,
}: {
  content: BlockContent;
  limit: number;
}) {
  const articles = await getLatestNews(limit);
  if (articles.length === 0) return null;

  return (
    <section className="container-page py-16 md:py-20">
      <SectionHeading
        eyebrow={content.eyebrow}
        title={content.title ?? "Latest news"}
        description={content.subtitle}
      />

      <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <li key={article.id}>
            <NewsCard
              article={article}
              sizes="(min-width: 1024px) 32vw, (min-width: 640px) 48vw, 100vw"
            />
          </li>
        ))}
      </ul>

      <SectionFooterLink label={content.ctaLabel} href={content.ctaHref} />
    </section>
  );
}

export async function EventsSection({
  content,
  limit,
}: {
  content: BlockContent;
  limit: number;
}) {
  const events = await getUpcomingEvents(limit);
  if (events.length === 0) return null;

  return (
    <section className="bg-surface-sunken py-16 md:py-20">
      <div className="container-page">
        <SectionHeading
          eyebrow={content.eyebrow}
          title={content.title ?? "Upcoming events"}
          description={content.subtitle}
        />

        <ul className="mt-10 grid gap-4 lg:grid-cols-3">
          {events.map((event) => (
            <li key={event.id}>
              <EventCard event={event} />
            </li>
          ))}
        </ul>

        <SectionFooterLink label={content.ctaLabel} href={content.ctaHref} />
      </div>
    </section>
  );
}

export async function GallerySection({
  content,
  limit,
}: {
  content: BlockContent;
  limit: number;
}) {
  const images = await getGalleryPreview(limit);
  if (images.length === 0) return null;

  return (
    <section className="container-page py-16 md:py-20">
      <SectionHeading
        eyebrow={content.eyebrow}
        title={content.title ?? "Gallery"}
        description={content.subtitle}
      />

      {/* A deliberately uneven mosaic: the first frame is larger, so the grid
          reads as an edited selection rather than a contact sheet. */}
      <ul className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
        {images.map((image, index) => (
          <li
            key={image.id}
            className={index === 0 ? "col-span-2 row-span-2" : undefined}
          >
            <Link
              href={`/gallery/${image.album.slug}` as never}
              className="group relative block overflow-hidden"
            >
              <MediaImage
                asset={image.media}
                sizes={
                  index === 0
                    ? "(min-width: 768px) 50vw, 100vw"
                    : "(min-width: 768px) 25vw, 50vw"
                }
                className="aspect-square w-full object-cover transition-transform duration-500 ease-[var(--ease-out-soft)] group-hover:scale-105"
              />
              <span className="absolute inset-0 bg-navy-950/0 transition-colors group-hover:bg-navy-950/25" />
              {image.caption ? (
                <span className="sr-only">{image.caption}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>

      <SectionFooterLink label={content.ctaLabel} href={content.ctaHref} />
    </section>
  );
}

export async function AcademicProgramsSection({
  content,
  limit,
}: {
  content: BlockContent;
  limit: number;
}) {
  const programs = await getAcademicPrograms(limit);
  if (programs.length === 0) return null;

  return (
    <section className="container-page py-16 md:py-20">
      <SectionHeading
        eyebrow={content.eyebrow}
        title={content.title ?? "Academics"}
        description={content.subtitle}
      />

      <ul className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {programs.map((program) => (
          <li key={program.id}>
            <ProgramCard
              program={program}
              sizes="(min-width: 1024px) 32vw, (min-width: 768px) 48vw, 100vw"
            />
          </li>
        ))}
      </ul>

      <SectionFooterLink label={content.ctaLabel} href={content.ctaHref} />
    </section>
  );
}
