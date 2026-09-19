import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MediaImage } from "@/components/media-image";
import { PageHeader } from "@/components/site/page-header";
import { ButtonLink } from "@/components/ui/button";
import { RichText } from "@/components/ui/rich-text";
import { ContentStatus } from "@/generated/prisma/enums";
import { MEDIA_SELECT, formatDateRange } from "@/lib/content";
import { db } from "@/lib/db";
import { richTextToPlainText, truncate } from "@/lib/sanitize";
import { getSiteUrl } from "@/lib/site-url";

import { JsonLdScript, eventJsonLd } from "@/components/seo/json-ld";

export const dynamic = "force-dynamic";

async function getEvent(slug: string) {
  return db.event.findFirst({
    where: { slug, status: ContentStatus.PUBLISHED },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      body: true,
      startDate: true,
      endDate: true,
      startTime: true,
      endTime: true,
      location: true,
      registrationUrl: true,
      seoTitle: true,
      seoDescription: true,
      image: { select: MEDIA_SELECT },
    },
  });
}

export async function generateMetadata(
  props: PageProps<"/events/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const event = await getEvent(slug);
  if (!event) return {};

  const description =
    event.seoDescription ??
    event.description ??
    truncate(richTextToPlainText(event.body), 155);

  return {
    title: event.seoTitle ?? event.title,
    ...(description ? { description } : {}),
    alternates: { canonical: `/events/${event.slug}` },
  };
}

export default async function EventPage(props: PageProps<"/events/[slug]">) {
  const { slug } = await props.params;
  const event = await getEvent(slug);
  if (!event) notFound();

  const details: [string, string][] = [
    ["Date", formatDateRange(event.startDate, event.endDate)],
  ];
  if (event.startTime) {
    details.push([
      "Time",
      event.endTime ? `${event.startTime} – ${event.endTime}` : event.startTime,
    ]);
  }
  if (event.location) details.push(["Location", event.location]);

  const structuredData = eventJsonLd({
    siteUrl: getSiteUrl(),
    path: `/events/${event.slug}`,
    name: event.title,
    description: event.description ?? truncate(richTextToPlainText(event.body), 155),
    imageUrl: event.image ? `/media/${event.image.storageKey}` : null,
    startDate: event.startDate,
    endDate: event.endDate,
    location: event.location,
  });

  return (
    <main id="main" className="flex flex-1 flex-col">
      <JsonLdScript data={structuredData} />
      <PageHeader
        title={event.title}
        subtitle={event.description}
        crumbs={[{ label: "Events", href: "/events" }, { label: event.title }]}
        size="compact"
      />

      <div className="container-page grid gap-10 py-12 md:py-16 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          {event.image ? (
            <MediaImage
              asset={event.image}
              sizes="(min-width: 1024px) 60vw, 100vw"
              priority
              className="mb-8 aspect-[16/9] w-full object-cover"
            />
          ) : null}
          <RichText html={event.body} />
        </div>

        <aside className="h-fit border border-line bg-surface-raised p-6">
          <h2 className="font-serif text-lg text-navy-900">Event details</h2>
          <dl className="mt-4 flex flex-col gap-3 text-sm">
            {details.map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">
                  {label}
                </dt>
                <dd className="text-navy-900">{value}</dd>
              </div>
            ))}
          </dl>

          {event.registrationUrl ? (
            <ButtonLink
              href={event.registrationUrl as never}
              withArrow
              className="mt-6 w-full"
            >
              Register
            </ButtonLink>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
