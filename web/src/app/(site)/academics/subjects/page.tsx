import type { Metadata } from "next";
import Link from "next/link";

import { ContentPending } from "@/components/site/content-pending";
import { PageHeader } from "@/components/site/page-header";
import { Badge } from "@/components/ui/badge";
import { ContentStatus, StudyLevel } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Subjects",
  alternates: { canonical: "/academics/subjects" },
};

const GROUPS: { level: StudyLevel; heading: string }[] = [
  { level: StudyLevel.O_LEVEL, heading: "O-level subjects" },
  { level: StudyLevel.A_LEVEL, heading: "A-level subjects" },
];

export default async function SubjectsPage() {
  const subjects = await db.subject.findMany({
    where: { status: ContentStatus.PUBLISHED },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      level: true,
      isCore: true,
      department: { select: { slug: true, name: true } },
    },
  });

  return (
    <main id="main" className="flex flex-1 flex-col">
      <PageHeader
        title="Subjects"
        crumbs={[{ label: "Academics", href: "/academics" }, { label: "Subjects" }]}
      />

      <div className="container-page py-14 md:py-16">
        {subjects.length === 0 ? (
          <ContentPending what="The list of subjects offered at each level" />
        ) : (
          GROUPS.map((group) => {
            // BOTH belongs in each list, since it is taught at both levels.
            const inGroup = subjects.filter(
              (subject) =>
                subject.level === group.level || subject.level === StudyLevel.BOTH,
            );
            if (inGroup.length === 0) return null;

            return (
              <section key={group.level} className="mb-14 last:mb-0">
                <h2 className="font-serif text-2xl text-navy-900">{group.heading}</h2>
                <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {inGroup.map((subject) => (
                    <li
                      key={`${group.level}-${subject.id}`}
                      id={subject.slug}
                      className="flex flex-col gap-2 border border-line bg-surface-raised p-5 scroll-mt-28"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-serif text-lg text-navy-900">
                          {subject.name}
                        </h3>
                        {subject.isCore ? <Badge tone="gold">Core</Badge> : null}
                      </div>
                      {subject.description ? (
                        <p className="text-sm leading-relaxed text-ink-600">
                          {subject.description}
                        </p>
                      ) : null}
                      {subject.department ? (
                        <Link
                          href={`/academics/departments/${subject.department.slug}` as never}
                          className="mt-auto pt-2 text-xs font-semibold uppercase tracking-[0.08em] text-navy-700 hover:underline"
                        >
                          {subject.department.name}
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>
    </main>
  );
}
