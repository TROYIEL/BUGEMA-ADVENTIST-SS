import type { Metadata } from "next";
import Link from "next/link";

import { ProgramCard } from "@/components/cards/content-cards";
import { ContentPending } from "@/components/site/content-pending";
import { PageHeader } from "@/components/site/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardText, CardTitle } from "@/components/ui/card";
import { RichText } from "@/components/ui/rich-text";
import { ContentStatus } from "@/generated/prisma/enums";
import { getAcademicPrograms, getPageBySlug } from "@/lib/content";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Academics",
  alternates: { canonical: "/academics" },
};

export default async function AcademicsPage() {
  const [page, programs, departments, subjectCount] = await Promise.all([
    getPageBySlug("academics"),
    getAcademicPrograms(),
    db.academicDepartment.findMany({
      where: { status: ContentStatus.PUBLISHED },
      orderBy: { order: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        _count: { select: { subjects: true } },
      },
    }),
    db.subject.count({ where: { status: ContentStatus.PUBLISHED } }),
  ]);

  const nothingPublished =
    programs.length === 0 && departments.length === 0 && subjectCount === 0;

  return (
    <main id="main" className="flex flex-1 flex-col">
      <PageHeader
        title={page?.title ?? "Academics"}
        subtitle={page?.subtitle}
        crumbs={[{ label: "Academics" }]}
      />

      <div className="container-page py-14 md:py-16">
        {page?.body ? <RichText html={page.body} className="mb-12" /> : null}

        {nothingPublished ? (
          <ContentPending what="Details of the academic programmes, departments and subjects offered" />
        ) : null}

        {programs.length > 0 ? (
          <section>
            <h2 className="font-serif text-2xl text-navy-900">Programmes</h2>
            <ul className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {programs.map((program) => (
                <li key={program.id}>
                  <ProgramCard
                    program={program}
                    sizes="(min-width: 1024px) 32vw, (min-width: 768px) 48vw, 100vw"
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {departments.length > 0 ? (
          <section className="mt-16">
            <h2 className="font-serif text-2xl text-navy-900">Departments</h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {departments.map((department) => (
                <li key={department.id}>
                  <Card interactive className="h-full">
                    <CardBody className="flex h-full flex-col gap-2">
                      <CardTitle>
                        <Link
                          href={`/academics/departments/${department.slug}` as never}
                        >
                          {department.name}
                        </Link>
                      </CardTitle>
                      {department.description ? (
                        <CardText className="line-clamp-3">
                          {department.description}
                        </CardText>
                      ) : null}
                      <p className="mt-auto pt-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">
                        {department._count.subjects}{" "}
                        {department._count.subjects === 1 ? "subject" : "subjects"}
                      </p>
                    </CardBody>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-14 flex flex-wrap gap-3">
          {subjectCount > 0 ? (
            <ButtonLink href="/academics/subjects" variant="secondary" withArrow>
              All subjects
            </ButtonLink>
          ) : null}
          <ButtonLink href="/admissions" variant="secondary">
            Admissions
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
