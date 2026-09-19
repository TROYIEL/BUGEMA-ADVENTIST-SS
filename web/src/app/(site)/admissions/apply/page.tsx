import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/site/page-header";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { getDraftToken } from "@/lib/auth/applicant";
import {
  documentTypesFor,
  findDraft,
  furthestStep,
  getAdmissionsWindow,
  getApplicationConfig,
  visibleSteps,
} from "@/lib/applications";
import { formatDate } from "@/lib/content";
import { getSiteSettings, readSetting } from "@/lib/settings";

import { startApplication } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Apply for admission",
  alternates: { canonical: "/admissions/apply" },
};

/**
 * The front door of the application.
 *
 * Applications are gated on two switches that must BOTH be on: the site-wide
 * `admissions.isOpen` setting, and the active academic year accepting
 * applications. Either can be turned off independently.
 *
 * A visitor with a draft in progress is sent straight back to the step they
 * reached; nobody should have to find "continue" on a page they have already
 * read.
 */
export default async function ApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, settings, window, config, token] = await Promise.all([
    searchParams,
    getSiteSettings(),
    getAdmissionsWindow(),
    getApplicationConfig(),
    getDraftToken(),
  ]);

  const draft = token && window.isOpen ? await findDraft(token) : null;
  if (draft) {
    const steps = visibleSteps(config, draft);
    redirect(`/admissions/apply/${furthestStep(steps, draft.currentStep).slug}`);
  }

  const admissionsEmail = readSetting(settings, "admissions.email");
  const admissionsPhone = readSetting(settings, "admissions.phone");
  const requiredDocuments = documentTypesFor(config, null).filter((type) => type.isRequired);
  const optionalDocuments = documentTypesFor(config, null).filter((type) => !type.isRequired);
  const largestUploadMb = Math.round(
    Math.max(0, ...config.documentTypes.map((type) => type.maxSizeBytes)) / (1024 * 1024),
  );

  return (
    <main id="main" className="flex flex-1 flex-col">
      <PageHeader
        title="Apply for admission"
        eyebrow={window.year ? `Applications for ${window.year.name}` : null}
        crumbs={[
          { label: "Admissions", href: "/admissions" },
          { label: "Apply" },
        ]}
      />

      <div className="container-page max-w-3xl py-14 md:py-16">
        {!window.isOpen ? (
          <>
            <Alert tone="info" title="Applications are not open at the moment">
              Online applications are currently closed
              {window.year ? ` for ${window.year.name}` : ""}. Contact the school
              office for the next intake dates, and they will let you know when
              applications reopen.
            </Alert>
            {token ? (
              <p className="mt-4 text-sm text-ink-600">
                An application you started has been kept and will be here when
                applications reopen.
              </p>
            ) : null}
          </>
        ) : (
          <>
            {error === "busy" ? (
              <Alert tone="warning" className="mb-8">
                Several applications have been started from this connection in
                a short time. Please wait a little and try again.
              </Alert>
            ) : null}

            <section>
              <h2 className="font-serif text-2xl text-navy-900">Before you begin</h2>
              <p className="mt-3 leading-relaxed text-ink-600">
                The form takes about fifteen minutes. Your answers are saved at
                the end of each step, so you can stop and come back on this
                device. On the parent or guardian step you can also ask for a
                link by email to continue on another device.
              </p>

              <h3 className="mt-8 font-semibold text-navy-900">You will be asked for</h3>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 leading-relaxed text-ink-600">
                <li>the applicant&rsquo;s full name, date of birth and nationality;</li>
                <li>the class being applied for, and whether day or boarding;</li>
                <li>a parent or guardian&rsquo;s name and telephone number;</li>
                <li>the applicant&rsquo;s current or most recent school.</li>
              </ul>

              {requiredDocuments.length > 0 || optionalDocuments.length > 0 ? (
                <>
                  <h3 className="mt-8 font-semibold text-navy-900">Documents</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">
                    Have these ready as clear photographs or PDF scans. Each file
                    can be up to {largestUploadMb}&nbsp;MB.
                  </p>
                  <ul className="mt-3 flex flex-col gap-2">
                    {[...requiredDocuments, ...optionalDocuments].map((type) => (
                      <li
                        key={type.id}
                        className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line pb-2 text-[0.9375rem]"
                      >
                        <span className="text-navy-900">{type.name}</span>
                        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">
                          {type.isRequired ? "Required" : "If you have it"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {window.year?.applicationClosesAt ? (
                <p className="mt-8 text-sm text-ink-600">
                  Applications close on{" "}
                  <strong className="text-navy-900">
                    {formatDate(window.year.applicationClosesAt)}
                  </strong>
                  .
                </p>
              ) : null}
            </section>

            <form action={startApplication} className="mt-10 flex flex-wrap items-center gap-4">
              <Button type="submit" size="lg" withArrow>
                Start an application
              </Button>
              <Link
                href="/admissions/application-status"
                className="text-sm font-semibold text-navy-800 underline-offset-4 hover:underline"
              >
                Already applied? Check your application
              </Link>
            </form>
          </>
        )}

        {admissionsPhone || admissionsEmail ? (
          <div className="mt-12 border-t border-line pt-8">
            <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-ink-500">
              Need help?
            </h2>
            <div className="mt-3 flex flex-col gap-2 text-ink-700">
              {admissionsPhone ? (
                <p>
                  <span className="font-semibold text-navy-900">Telephone: </span>
                  <a href={`tel:${admissionsPhone.replace(/\s+/g, "")}`} className="hover:underline">
                    {admissionsPhone}
                  </a>
                </p>
              ) : null}
              {admissionsEmail ? (
                <p>
                  <span className="font-semibold text-navy-900">Email: </span>
                  <a href={`mailto:${admissionsEmail}`} className="hover:underline">
                    {admissionsEmail}
                  </a>
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {!window.isOpen ? (
          <div className="mt-10 flex flex-wrap gap-3">
            <ButtonLink href="/admissions/requirements" withArrow>
              Entry requirements
            </ButtonLink>
            <ButtonLink href="/contact" variant="secondary">
              Contact the school
            </ButtonLink>
          </div>
        ) : null}
      </div>
    </main>
  );
}
