import type { Metadata } from "next";

import { MediaImage } from "@/components/media-image";
import { ContentPending } from "@/components/site/content-pending";
import { PageHeader } from "@/components/site/page-header";
import { RichText } from "@/components/ui/rich-text";
import { MEDIA_SELECT, getPageBySlug } from "@/lib/content";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leadership",
  alternates: { canonical: "/about/leadership" },
};

export default async function LeadershipPage() {
  const [page, leadership, staff] = await Promise.all([
    getPageBySlug("about/leadership"),
    db.staffProfile.findMany({
      where: { isVisible: true, isLeadership: true },
      orderBy: { order: "asc" },
      select: {
        id: true,
        name: true,
        position: true,
        bio: true,
        photo: { select: MEDIA_SELECT },
      },
    }),
    db.staffProfile.findMany({
      where: { isVisible: true, isLeadership: false },
      orderBy: { order: "asc" },
      select: {
        id: true,
        name: true,
        position: true,
        department: true,
        photo: { select: MEDIA_SELECT },
      },
    }),
  ]);

  return (
    <main id="main" className="flex flex-1 flex-col">
      <PageHeader
        title={page?.title ?? "Leadership"}
        subtitle={page?.subtitle}
        crumbs={[
          { label: "About the school", href: "/about" },
          { label: "Leadership" },
        ]}
      />

      <div className="container-page py-14 md:py-16">
        {page?.body ? <RichText html={page.body} className="mb-12" /> : null}

        {leadership.length === 0 && staff.length === 0 ? (
          <ContentPending what="Profiles of the school's leadership team" />
        ) : null}

        {leadership.length > 0 ? (
          <ul className="flex flex-col gap-12">
            {leadership.map((person) => (
              <li key={person.id} className="grid gap-6 md:grid-cols-[12rem_minmax(0,1fr)]">
                {person.photo ? (
                  <MediaImage
                    asset={person.photo}
                    alt={`${person.name}, ${person.position}`}
                    sizes="(min-width: 768px) 12rem, 100vw"
                    className="aspect-[3/4] w-full object-cover"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="grid aspect-[3/4] w-full place-items-center bg-navy-900"
                  >
                    <span className="font-serif text-3xl text-white/30">
                      {person.name.charAt(0)}
                    </span>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <h2 className="font-serif text-2xl text-navy-900">{person.name}</h2>
                  <p className="text-sm font-semibold uppercase tracking-[0.08em] text-gold-700">
                    {person.position}
                  </p>
                  {person.bio ? (
                    <p className="mt-2 max-w-2xl leading-relaxed text-ink-600">
                      {person.bio}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {staff.length > 0 ? (
          <section className="mt-16">
            <h2 className="font-serif text-2xl text-navy-900">Staff</h2>
            <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {staff.map((person) => (
                <li key={person.id} className="flex flex-col gap-2">
                  {person.photo ? (
                    <MediaImage
                      asset={person.photo}
                      alt={`${person.name}, ${person.position}`}
                      sizes="(min-width: 1024px) 22vw, (min-width: 640px) 45vw, 100vw"
                      className="aspect-square w-full object-cover"
                    />
                  ) : null}
                  <p className="font-semibold text-navy-900">{person.name}</p>
                  <p className="text-sm text-ink-600">{person.position}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}
