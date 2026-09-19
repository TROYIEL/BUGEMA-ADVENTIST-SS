import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MediaImage } from "@/components/media-image";
import { PageHeader } from "@/components/site/page-header";
import { Badge } from "@bass/ui/badge";
import { RichText } from "@bass/ui/rich-text";
import { ContentStatus, StudyLevel } from "@bass/db/enums";
import { MEDIA_SELECT } from "@bass/core/content";
import { db } from "@bass/db";

export const dynamic = "force-dynamic";

const LEVEL_LABELS: Record<StudyLevel, string> = {
  [StudyLevel.O_LEVEL]: "O-level",
  [StudyLevel.A_LEVEL]: "A-level",
  [StudyLevel.BOTH]: "O- and A-level",
};

async function getDepartment(slug: string) {
  return db.academicDepartment.findFirst({
    where: { slug, status: ContentStatus.PUBLISHED },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      body: true,
      image: { select: MEDIA_SELECT },
      head: { select: { name: true, position: true } },
      subjects: {
        where: { status: ContentStatus.PUBLISHED },
        orderBy: { order: "asc" },
        select: { id: true, name: true, description: true, level: true },
      },
    },
  });
}

export async function generateMetadata(
  props: PageProps<"/academics/departments/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const department = await getDepartment(slug);
  if (!department) return {};

  return {
    title: department.name,
    ...(department.description ? { description: department.description } : {}),
    alternates: { canonical: `/academics/departments/${department.slug}` },
  };
}

export default async function DepartmentPage(
  props: PageProps<"/academics/departments/[slug]">,
) {
  const { slug } = await props.params;
  const department = await getDepartment(slug);
  if (!department) notFound();

  return (
    <main id="main" className="flex flex-1 flex-col">
      <PageHeader
        title={department.name}
        subtitle={department.description}
        image={department.image}
        crumbs={[
          { label: "Academics", href: "/academics" },
          { label: "Departments", href: "/academics/departments" },
          { label: department.name },
        ]}
      />

      <div className="container-page py-14 md:py-16">
        {department.head ? (
          <p className="mb-8 text-sm text-ink-600">
            <span className="font-semibold text-navy-900">
              {department.head.position}:
            </span>{" "}
            {department.head.name}
          </p>
        ) : null}

        <RichText html={department.body} />

        {department.subjects.length > 0 ? (
          <section className="mt-12">
            <h2 className="font-serif text-2xl text-navy-900">Subjects</h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {department.subjects.map((subject) => (
                <li
                  key={subject.id}
                  className="flex flex-col gap-2 border border-line bg-surface-raised p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-serif text-lg text-navy-900">{subject.name}</h3>
                    <Badge tone="navy">{LEVEL_LABELS[subject.level]}</Badge>
                  </div>
                  {subject.description ? (
                    <p className="text-sm leading-relaxed text-ink-600">
                      {subject.description}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {department.image ? (
          <MediaImage
            asset={department.image}
            sizes="(min-width: 1024px) 70vw, 100vw"
            className="mt-12 aspect-[16/9] w-full object-cover"
          />
        ) : null}
      </div>
    </main>
  );
}
