import type { Metadata } from "next";
import Link from "next/link";

import { MediaImage } from "@/components/media-image";
import { PageHeader } from "@/components/site/page-header";
import { EmptyState } from "@bass/ui/empty-state";
import { ContentStatus } from "@bass/db/enums";
import { MEDIA_SELECT } from "@bass/core/content";
import { db } from "@bass/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Departments",
  alternates: { canonical: "/academics/departments" },
};

export default async function DepartmentsPage() {
  const departments = await db.academicDepartment.findMany({
    where: { status: ContentStatus.PUBLISHED },
    orderBy: { order: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      image: { select: MEDIA_SELECT },
      head: { select: { name: true, position: true } },
      _count: { select: { subjects: true } },
    },
  });

  return (
    <main id="main" className="flex flex-1 flex-col">
      <PageHeader
        title="Departments"
        crumbs={[{ label: "Academics", href: "/academics" }, { label: "Departments" }]}
      />

      <div className="container-page py-14 md:py-16">
        {departments.length === 0 ? (
          <EmptyState
            title="No departments published yet"
            description="The school's academic departments will be listed here."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {departments.map((department) => (
              <li key={department.id}>
                <Link
                  href={`/academics/departments/${department.slug}` as never}
                  className="group grid gap-6 py-8 md:grid-cols-[14rem_minmax(0,1fr)]"
                >
                  {department.image ? (
                    <MediaImage
                      asset={department.image}
                      alt=""
                      sizes="(min-width: 768px) 14rem, 100vw"
                      className="aspect-[4/3] w-full object-cover"
                    />
                  ) : null}
                  <div className="flex flex-col gap-2">
                    <h2 className="font-serif text-2xl text-navy-900 group-hover:underline">
                      {department.name}
                    </h2>
                    {department.head ? (
                      <p className="text-sm text-ink-500">
                        {department.head.position}: {department.head.name}
                      </p>
                    ) : null}
                    {department.description ? (
                      <p className="max-w-2xl leading-relaxed text-ink-600">
                        {department.description}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-gold-700">
                      {department._count.subjects}{" "}
                      {department._count.subjects === 1 ? "subject" : "subjects"}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
