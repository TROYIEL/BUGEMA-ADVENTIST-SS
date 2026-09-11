import type { Metadata } from "next";

import { PageHeader } from "@/components/site/page-header";
import { Alert } from "@bass/ui/alert";
import { ButtonLink } from "@bass/ui/button";

export const metadata: Metadata = {
  title: "Check your application",
  alternates: { canonical: "/admissions/application-status" },
  // Nothing here should be indexed; it is a lookup for individual applicants.
  robots: { index: false, follow: true },
};

/**
 * Applicant status lookup.
 *
 * The secure lookup — reference number plus surname and date of birth, or a
 * single-use link issued at submission — is built in milestone 3, together
 * with the applicant portal it leads to.
 */
export default function ApplicationStatusPage() {
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

      <div className="container-page max-w-2xl py-14 md:py-16">
        <Alert tone="info" title="Not yet available">
          Once you have submitted an application you will be able to check its
          progress here using your application reference. Applications are not
          open at the moment.
        </Alert>

        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/admissions" withArrow>
            Admissions
          </ButtonLink>
          <ButtonLink href="/contact" variant="secondary">
            Contact the school
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
