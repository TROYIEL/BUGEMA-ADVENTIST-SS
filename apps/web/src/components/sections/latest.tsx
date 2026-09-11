import type { BlockContent } from "@/components/sections/blocks";
import { LatestTabs, type LatestItem } from "@/components/sections/latest-tabs";
import { ButtonLink } from "@bass/ui/button";
import { SectionHeading } from "@bass/ui/card";
import { formatDate, getLatestNews, getUpcomingEvents } from "@bass/core/content";

/**
 * News and events in one tabbed grid, matching the reference's combined
 * "what's the latest" block. Renders nothing when the school has published
 * neither — a heading above an empty grid looks broken.
 */
export async function LatestSection({
  content,
  limit,
}: {
  content: BlockContent;
  limit: number;
}) {
  const half = Math.max(2, Math.ceil(limit / 2));
  const [news, events] = await Promise.all([
    getLatestNews(half),
    getUpcomingEvents(half),
  ]);

  if (news.length === 0 && events.length === 0) return null;

  // Interleaved so the default "show all" view alternates rather than
  // presenting all the news first and all the events after it.
  const newsItems: LatestItem[] = news.map((article) => ({
    id: `news-${article.id}`,
    kind: "news",
    title: article.title,
    href: `/news/${article.slug}`,
    label: "Latest news",
    dateLabel: article.publishedAt ? formatDate(article.publishedAt) : null,
    image: article.featuredImage
      ? {
          storageKey: article.featuredImage.storageKey,
          alt: article.featuredImage.alt,
          blurDataUrl: article.featuredImage.blurDataUrl,
        }
      : null,
  }));

  const eventItems: LatestItem[] = events.map((event) => ({
    id: `event-${event.id}`,
    kind: "event",
    title: event.title,
    href: `/events/${event.slug}`,
    label: "Upcoming event",
    dateLabel: formatDate(event.startDate),
    image: event.image
      ? {
          storageKey: event.image.storageKey,
          alt: event.image.alt,
          blurDataUrl: event.image.blurDataUrl,
        }
      : null,
  }));

  const items: LatestItem[] = [];
  for (let index = 0; index < Math.max(newsItems.length, eventItems.length); index++) {
    if (newsItems[index]) items.push(newsItems[index]);
    if (eventItems[index]) items.push(eventItems[index]);
  }

  return (
    <section className="container-page py-14 md:py-16">
      <SectionHeading
        eyebrow={content.eyebrow}
        title={content.title ?? "What's the latest at BASS?"}
        description={content.subtitle}
      />

      <LatestTabs items={items} />

      {content.ctaLabel && content.ctaHref ? (
        <div className="mt-10">
          <ButtonLink href={content.ctaHref as never} variant="secondary" withArrow>
            {content.ctaLabel}
          </ButtonLink>
        </div>
      ) : null}
    </section>
  );
}
