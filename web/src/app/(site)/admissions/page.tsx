import type { Metadata } from "next";

import { ContentPending } from "@/components/site/content-pending";
import { PageHeader } from "@/components/site/page-header";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { RichText } from "@/components/ui/rich-text";
import { ContentStatus } from "@/generated/prisma/enums";
import { getPageBySlug } from "@/lib/content";
import { db } from "@/lib/db";
import { getSiteSettings, readBooleanSetting, readSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admissions",
  alternates: { canonical: "/admissions" },
};

export default async function AdmissionsPage() {
  const [page, settings, requirements, activeYear] = await Promise.all([
    getPageBySlug("admissions"),
    getSiteSettings(),
    db.admissionRequirement.findMany({
      where: { status: ContentStatus.PUBLISHED },
      orderBy: { order: "asc" },
      take: 5,
      select: { id: true, title: true, description: true },
    }),
    db.academicYear.findFirst({
      where: { isActive: true },
      select: { name: true, isAcceptingApplications: true, applicationClosesAt: true },
    }),
  ]);

  const isOpen =
    readBooleanSetting(settings, "admissions.isOpen") &&
    Boolean(activeYear?.isAcceptingApplications);
  const introduction = readSetting(settings, "admissions.introduction");
  const admissionsEmail = readSetting(settings, "admissions.email");
  const admissionsPhone = readSetting(settings, "admissions.phone");
  const prospectus = readSetting(settings, "admissions.prospectusUrl");

  return (
    <main id="main" className="flex flex-1 flex-col">
      <PageHeader
        title={page?.title ?? "Admissions"}
        subtitle={page?.subtitle ?? introduction}
        crumbs={[{ label: "Admissions" }]}
      />

      <div className="container-page py-14 md:py-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
          <div>
            {isOpen ? (
              <Alert tone="success" title={`Applications are open${activeYear ? ` for ${activeYear.name}` : ""}`}>
                You can apply online. Your application can be saved and resumed
                at any point before you submit it.
              </Alert>
            ) : (
              <Alert tone="info" title="Applications are not open at the moment">
                Online applications are currently closed
                {activeYear ? ` for ${activeYear.name}` : ""}. Please contact the
                school office for the next intake dates.
              </Alert>
            )}

            {page?.body ? <RichText html={page.body} className="mt-10" /> : null}

            <section className="mt-12">
              <h2 className="font-serif text-2xl text-navy-900">
                Entry requirements
              </h2>

              {requirements.length === 0 ? (
                <div className="mt-6">
                  <ContentPending what="The school's entry requirements" />
                </div>
              ) : (
                <>
                  <ul className="mt-6 flex flex-col divide-y divide-line border-y border-line">
                    {requirements.map((requirement) => (
                      <li key={requirement.id} className="flex flex-col gap-1.5 py-5">
                        <h3 className="font-semibold text-navy-900">
                          {requirement.title}
                        </h3>
                        {requirement.description ? (
                          <p className="text-[0.9375rem] leading-relaxed text-ink-600">
                            {requirement.description}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6">
                    <ButtonLink href="/admissions/requirements" variant="secondary" withArrow>
                      All requirements
                    </ButtonLink>
                  </div>
                </>
              )}
            </section>
          </div>

          <aside className="flex h-fit flex-col gap-6">
            <div className="bg-navy-900 p-6 text-white">
              <h2 className="font-serif text-xl">Apply online</h2>
              <p className="mt-2 text-sm leading-relaxed text-navy-100">
                {isOpen
                  ? "Complete the application form online. You can save your progress and return to it later."
                  : "Applications will reopen for the next intake."}
              </p>
              <ButtonLink
                href="/admissions/apply"
                variant="on-dark"
                withArrow
                className="mt-5 w-full"
              >
                {isOpen ? "Start an application" : "Application information"}
              </ButtonLink>
              <ButtonLink
                href="/admissions/application-status"
                variant="on-dark-outline"
                className="mt-3 w-full"
              >
                Check an application
              </ButtonLink>
            </div>

            {(admissionsEmail || admissionsPhone || prospectus) && (
              <div className="border border-line bg-surface-raised p-6">
                <h2 className="font-serif text-lg text-navy-900">Admissions office</h2>
                <dl className="mt-4 flex flex-col gap-3 text-sm">
                  {admissionsPhone ? (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">
                        Telephone
                      </dt>
                      <dd>
                        <a href={`tel:${admissionsPhone.replace(/\s+/g, "")}`} className="text-navy-900 hover:underline">
                          {admissionsPhone}
                        </a>
                      </dd>
                    </div>
                  ) : null}
                  {admissionsEmail ? (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">
                        Email
                      </dt>
                      <dd>
                        <a href={`mailto:${admissionsEmail}`} className="text-navy-900 hover:underline">
                          {admissionsEmail}
                        </a>
                      </dd>
                    </div>
                  ) : null}
                </dl>
                {prospectus ? (
                  <ButtonLink href={prospectus as never} variant="secondary" className="mt-5 w-full">
                    Download prospectus
                  </ButtonLink>
                ) : null}
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
