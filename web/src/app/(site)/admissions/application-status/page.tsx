import type { Metadata } from "next";

import { PageHeader } from "@/components/site/page-header";
import { ButtonLink } from "@bass/ui/button";
import { getPortalApplicationId } from "@bass/auth/applicant";
import {
  getApplicationConfig,
  getPortalApplication,
  markMessagesRead,
} from "@bass/core/applications";
import { getSiteSettings, readSetting } from "@bass/core/settings";

import { LookupForm } from "./lookup-form";
import { Portal } from "./portal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Check your application",
  alternates: { canonical: "/admissions/application-status" },
  // Nothing here should be indexed; it is a lookup for individual applicants.
  robots: { index: false, follow: true },
};

/**
 * Applicant status: the portal when the visitor holds a valid access cookie,
 * otherwise the lookup form that issues one.
 */
export default async function ApplicationStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const [{ submitted }, settings, applicationId] = await Promise.all([
    searchParams,
    getSiteSettings(),
    getPortalApplicationId(),
  ]);

  const application = applicationId ? await getPortalApplication(applicationId) : null;
  const admissionsEmail = readSetting(settings, "admissions.email");
  const admissionsPhone = readSetting(settings, "admissions.phone");

  if (application) {
    const config = await getApplicationConfig();
    // The applicant is looking at the messages now; unread badges elsewhere
    // (and the school's own view) should reflect that from the next request.
    if (application.messages.some((message) => !message.readAt)) {
      await markMessagesRead(application.id);
    }

    return (
      <main id="main" className="flex flex-1 flex-col">
        <PageHeader
          title="Your application"
          eyebrow={application.referenceNumber}
          crumbs={[
            { label: "Admissions", href: "/admissions" },
            { label: "Your application" },
          ]}
          size="compact"
        />
        <div className="container-page py-10 md:py-14">
          <Portal application={application} config={config} justSubmitted={submitted === "1"} />
        </div>
      </main>
    );
  }

  return (
    <main id="main" className="flex flex-1 flex-col">
      <PageHeader
        title="Check your application"
        crumbs={[
          { label: "Admissions", href: "/admissions" },
          { label: "Check your application" },
        ]}
        size="compact"
      />

      <div className="container-page py-14 md:py-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
          <div className="max-w-2xl">
            <p className="text-lg leading-relaxed text-ink-600">
              Enter the reference from your confirmation, together with the
              applicant&rsquo;s surname and date of birth exactly as they were
              given on the form.
            </p>
            <div className="mt-8">
              <LookupForm />
            </div>
          </div>

          <aside className="flex h-fit flex-col gap-6">
            <div className="border border-line bg-surface-raised p-6">
              <h2 className="font-serif text-lg text-navy-900">Lost your reference?</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">
                If you gave an email address, the confirmation email carries
                both the reference and a direct link. Otherwise the admissions
                office can look it up for you.
              </p>
              {admissionsPhone || admissionsEmail ? (
                <dl className="mt-4 flex flex-col gap-3 text-sm">
                  {admissionsPhone ? (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">
                        Telephone
                      </dt>
                      <dd>
                        <a
                          href={`tel:${admissionsPhone.replace(/\s+/g, "")}`}
                          className="text-navy-900 hover:underline"
                        >
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
              ) : (
                <div className="mt-4">
                  <ButtonLink href="/contact" variant="secondary" size="sm">
                    Contact the school
                  </ButtonLink>
                </div>
              )}
            </div>

            <div className="bg-navy-900 p-6 text-white">
              <h2 className="font-serif text-lg">Not applied yet?</h2>
              <ButtonLink href="/admissions/apply" variant="on-dark" withArrow className="mt-4 w-full">
                Apply for admission
              </ButtonLink>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
