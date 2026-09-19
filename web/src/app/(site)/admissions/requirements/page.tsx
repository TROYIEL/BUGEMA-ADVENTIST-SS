import type { Metadata } from "next";

import { ContentPending } from "@/components/site/content-pending";
import { PageHeader } from "@/components/site/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { RichText } from "@/components/ui/rich-text";
import { ContentStatus, StudyLevel } from "@/generated/prisma/enums";
import { getPageBySlug } from "@/lib/content";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Entry requirements",
  alternates: { canonical: "/admissions/requirements" },
};

const LEVEL_LABELS: Record<StudyLevel, string> = {
  [StudyLevel.O_LEVEL]: "O-level",
  [StudyLevel.A_LEVEL]: "A-level",
  [StudyLevel.BOTH]: "All levels",
};

export default async function RequirementsPage() {
  const [page, requirements, documentTypes] = await Promise.all([
    getPageBySlug("admissions/requirements"),
    db.admissionRequirement.findMany({
      where: { status: ContentStatus.PUBLISHED },
      orderBy: { order: "asc" },
      select: { id: true, title: true, description: true, level: true },
    }),
    db.documentType.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      select: { id: true, name: true, description: true, isRequired: true },
    }),
  ]);

  return (
    <main id="main" className="flex flex-1 flex-col">
      <PageHeader
        title={page?.title ?? "Entry requirements"}
        subtitle={page?.subtitle}
        crumbs={[
          { label: "Admissions", href: "/admissions" },
          { label: "Entry requirements" },
        ]}
      />

      <div className="container-page py-14 md:py-16">
        {page?.body ? <RichText html={page.body} className="mb-10" /> : null}

        {requirements.length === 0 ? (
          <ContentPending what="The entry requirements for each level" />
        ) : (
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {requirements.map((requirement) => (
              <li key={requirement.id} className="flex flex-col gap-2 py-6">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-serif text-xl text-navy-900">
                    {requirement.title}
                  </h2>
                  <Badge tone="navy">{LEVEL_LABELS[requirement.level]}</Badge>
                </div>
                {requirement.description ? (
                  <p className="max-w-2xl leading-relaxed text-ink-600">
                    {requirement.description}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {documentTypes.length > 0 ? (
          <section className="mt-14">
            <h2 className="font-serif text-2xl text-navy-900">
              Documents you can upload
            </h2>
            <p className="mt-2 max-w-2xl leading-relaxed text-ink-600">
              These can be attached to an online application. Only documents
              marked required must be supplied before submitting.
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {documentTypes.map((type) => (
                <li
                  key={type.id}
                  className="flex items-start justify-between gap-3 border border-line bg-surface-raised p-4"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-navy-900">{type.name}</span>
                    {type.description ? (
                      <span className="text-sm text-ink-600">{type.description}</span>
                    ) : null}
                  </div>
                  <Badge tone={type.isRequired ? "warning" : "neutral"}>
                    {type.isRequired ? "Required" : "Optional"}
                  </Badge>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-12 flex flex-wrap gap-3">
          <ButtonLink href="/admissions/apply" withArrow>
            Apply for admission
          </ButtonLink>
          <ButtonLink href="/contact" variant="secondary">
            Ask a question
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
