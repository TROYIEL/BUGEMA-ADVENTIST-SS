import type { Metadata } from "next";

import { PageHeader } from "@/components/site/page-header";
import { Alert } from "@bass/ui/alert";
import { ButtonLink } from "@bass/ui/button";
import { db } from "@bass/db";
import { getSiteSettings, readBooleanSetting, readSetting } from "@bass/core/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Apply for admission",
  alternates: { canonical: "/admissions/apply" },
};

/**
 * Applications are gated on two switches that must BOTH be on: the site-wide
 * `admissions.isOpen` setting, and the active academic year accepting
 * applications. Either can be turned off independently — closing the intake
 * for one year should not require changing a global setting.
 *
 * The closed branch below is the permanent, correct behaviour. The multi-step
 * application wizard that fills the open branch is built in milestone 3.
 */
export default async function ApplyPage() {
  const [settings, activeYear] = await Promise.all([
    getSiteSettings(),
    db.academicYear.findFirst({
      where: { isActive: true },
      select: {
        name: true,
        isAcceptingApplications: true,
        applicationOpensAt: true,
        applicationClosesAt: true,
      },
    }),
  ]);

  const isOpen =
    readBooleanSetting(settings, "admissions.isOpen") &&
    Boolean(activeYear?.isAcceptingApplications);

  const admissionsEmail = readSetting(settings, "admissions.email");
  const admissionsPhone = readSetting(settings, "admissions.phone");

  return (
    <main id="main" className="flex flex-1 flex-col">
      <PageHeader
        title="Apply for admission"
        crumbs={[
          { label: "Admissions", href: "/admissions" },
          { label: "Apply" },
        ]}
      />

      <div className="container-page max-w-3xl py-14 md:py-16">
        {isOpen ? (
          <Alert tone="info" title="The online application form is being finalised">
            Applications are open
            {activeYear ? ` for ${activeYear.name}` : ""}, but the online form is
            not yet available on this site. Please contact the admissions office
            to apply in the meantime.
          </Alert>
        ) : (
          <Alert tone="info" title="Applications are not open at the moment">
            Online applications are currently closed
            {activeYear ? ` for ${activeYear.name}` : ""}. Contact the school
            office for the next intake dates, and they will let you know when
            applications reopen.
          </Alert>
        )}

        <div className="mt-10 flex flex-col gap-4">
          {admissionsPhone ? (
            <p className="text-ink-700">
              <span className="font-semibold text-navy-900">Telephone: </span>
              <a href={`tel:${admissionsPhone.replace(/\s+/g, "")}`} className="hover:underline">
                {admissionsPhone}
              </a>
            </p>
          ) : null}
          {admissionsEmail ? (
            <p className="text-ink-700">
              <span className="font-semibold text-navy-900">Email: </span>
              <a href={`mailto:${admissionsEmail}`} className="hover:underline">
                {admissionsEmail}
              </a>
            </p>
          ) : null}
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <ButtonLink href="/admissions/requirements" withArrow>
            Entry requirements
          </ButtonLink>
          <ButtonLink href="/contact" variant="secondary">
            Contact the school
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
