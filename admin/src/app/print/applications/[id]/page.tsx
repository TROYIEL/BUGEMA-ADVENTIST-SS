import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { requirePagePermission } from "@/lib/auth/dal";
import {
  APPLICATION_STATUS_COPY,
  BOARDING_LABELS,
  GENDER_LABELS,
  formatAnswer,
} from "@/lib/application-schemas";
import { getApplicationConfig, readAnswers } from "@/lib/applications";
import { getApplicationForStaff } from "@/lib/applications-admin";
import { formatDate } from "@/lib/content";
import { getSiteSettings, readSetting } from "@/lib/settings";

import { PrintButton } from "@/app/print/print-button";
import { formatDateTime, fullName } from "@/components/applications/format";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: PageProps<"/print/applications/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const application = await getApplicationForStaff(id);
  return { title: application?.referenceNumber ? `Print ${application.referenceNumber}` : "Print application" };
}

const DOCUMENT_STATUS: Record<string, string> = {
  PENDING: "Awaiting review",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  REPLACEMENT_REQUIRED: "Replacement requested",
};

function Row({ label, value }: { label: string; value: ReactNode }) {
  const empty = value === "" || value === null || value === undefined;
  return (
    <div className="grid grid-cols-[11rem_1fr] gap-4 border-b border-line py-1.5 text-[0.9375rem] last:border-0 print:text-[11pt]">
      <dt className="text-ink-600">{label}</dt>
      <dd className={empty ? "text-ink-500" : "text-ink-900"}>{empty ? "—" : value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <h2 className="mb-2 border-b-2 border-navy-900 pb-1 text-base font-semibold uppercase tracking-[0.06em] text-navy-900 print:text-[12pt]">
        {title}
      </h2>
      <dl>{children}</dl>
    </section>
  );
}

/**
 * A print-friendly rendering of one application: black on white, A4-shaped,
 * every answer in reading order, nothing interactive. The browser's own print
 * dialog handles paper and PDF, so no PDF library is needed.
 */
export default async function PrintApplicationPage(props: PageProps<"/print/applications/[id]">) {
  await requirePagePermission("applications:read");

  const { id } = await props.params;
  const [application, config, settings] = await Promise.all([
    getApplicationForStaff(id),
    getApplicationConfig(),
    getSiteSettings(),
  ]);
  if (!application) notFound();

  const schoolName = readSetting(settings, "school.name") ?? "Bugema Adventist Secondary School";
  const answers = readAnswers(application);
  const name = fullName(application);
  const fieldsFor = (step: string) =>
    config.fields
      .filter((field) => field.step === step)
      .map((field) => (
        <Row key={field.id} label={field.label} value={formatAnswer(field, answers[field.key])} />
      ));

  return (
    <main className="mx-auto max-w-[52rem] px-8 py-10 print:max-w-none print:px-0 print:py-0">
      <div className="mb-6 flex items-center justify-between gap-4 print:hidden">
        <Link href={`/applications/${application.id}` as never} className="text-sm text-navy-800 underline underline-offset-4">
          ← Back to the application
        </Link>
        <PrintButton />
      </div>

      <header className="mb-8 border-b-4 border-navy-900 pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-600">{schoolName}</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy-900 print:text-[18pt]">Application for admission</h1>
        <dl className="mt-4 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2 print:text-[10.5pt]">
          <div className="flex gap-2"><dt className="text-ink-600">Reference</dt><dd className="font-mono font-semibold">{application.referenceNumber ?? "—"}</dd></div>
          <div className="flex gap-2"><dt className="text-ink-600">Status</dt><dd>{APPLICATION_STATUS_COPY[application.status].label}</dd></div>
          <div className="flex gap-2"><dt className="text-ink-600">Submitted</dt><dd>{formatDateTime(application.submittedAt)}</dd></div>
          <div className="flex gap-2"><dt className="text-ink-600">Academic year</dt><dd>{application.academicYear.name}</dd></div>
          <div className="flex gap-2"><dt className="text-ink-600">Applying for</dt><dd>{application.applicationClass?.name ?? "—"}</dd></div>
          <div className="flex gap-2"><dt className="text-ink-600">Boarding</dt><dd>{application.boardingPreference ? BOARDING_LABELS[application.boardingPreference] : "—"}</dd></div>
        </dl>
      </header>

      <div className="flex flex-col gap-8">
        <Section title="Applicant">
          <Row label="Full name" value={name} />
          <Row label="Date of birth" value={formatDate(application.dateOfBirth)} />
          <Row label="Gender" value={application.gender ? GENDER_LABELS[application.gender] : ""} />
          <Row label="Nationality" value={application.nationality} />
          <Row label="District" value={application.homeDistrict} />
          <Row label="Home address" value={application.homeAddress} />
          {fieldsFor("APPLICANT")}
        </Section>

        <Section title="Parent or guardian">
          <Row label="Name" value={application.guardianName} />
          <Row label="Relationship" value={application.guardianRelationship} />
          <Row label="Occupation" value={application.guardianOccupation} />
          <Row label="Telephone" value={application.guardianPhone} />
          <Row label="Other telephone" value={application.guardianAltPhone} />
          <Row label="Email" value={application.guardianEmail} />
          <Row label="Address" value={application.guardianAddress} />
          {fieldsFor("GUARDIAN")}
        </Section>

        <Section title="Schooling">
          <Row label="Previous school" value={application.previousSchool} />
          <Row label="Class completed" value={application.previousClass} />
          <Row label="Year completed" value={application.yearCompleted ?? ""} />
          <Row label="Exam index number" value={application.examIndexNumber} />
          <Row label="Results" value={application.examResults ? <span className="whitespace-pre-line">{application.examResults}</span> : ""} />
          {fieldsFor("ACADEMIC")}
        </Section>

        {config.fields.some((field) => !["APPLICANT", "GUARDIAN", "ACADEMIC"].includes(field.step)) ? (
          <Section title="Further questions">
            {config.fields
              .filter((field) => !["APPLICANT", "GUARDIAN", "ACADEMIC"].includes(field.step))
              .map((field) => (
                <Row key={field.id} label={field.label} value={formatAnswer(field, answers[field.key])} />
              ))}
          </Section>
        ) : null}

        <Section title="Documents">
          {application.documents.length === 0 ? (
            <Row label="Uploaded" value="" />
          ) : (
            application.documents.map((document) => (
              <Row
                key={document.id}
                label={document.documentType?.name ?? "Document"}
                value={`${document.mediaAsset.originalName} — ${DOCUMENT_STATUS[document.status] ?? document.status}`}
              />
            ))
          )}
        </Section>

        <Section title="History">
          {application.events.map((event) => (
            <Row
              key={event.id}
              label={formatDateTime(event.createdAt)}
              value={[event.action.replace(/_/g, " "), event.newValue ? `→ ${APPLICATION_STATUS_COPY[event.newValue as keyof typeof APPLICATION_STATUS_COPY]?.label ?? event.newValue}` : "", event.note].filter(Boolean).join("  ")}
            />
          ))}
        </Section>
      </div>

      <footer className="mt-10 border-t border-line pt-3 text-xs text-ink-600 print:text-[9pt]">
        Printed {formatDateTime(new Date())} · {schoolName} · Confidential — contains personal information
      </footer>
    </main>
  );
}
