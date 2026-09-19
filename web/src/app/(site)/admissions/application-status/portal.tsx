import { DocumentVerificationStatus } from "@/generated/prisma/enums";
import {
  APPLICATION_STATUS_COPY,
  DOCUMENT_STATUS_COPY,
} from "@/lib/application-schemas";
import {
  canApplicantUpload,
  describeEvent,
  documentTypesFor,
  type ApplicationConfig,
  type PortalApplication,
} from "@/lib/applications";
import { formatDate } from "@/lib/content";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

import { DocumentUploader } from "../apply/_components/documents-panel";
import { formatBytes } from "../apply/_components/format";
import { signOut, uploadPortalDocument } from "./actions";

/**
 * What an applicant sees after submitting: where the application stands, what
 * the school has said, which documents are in and whether any need attention.
 */

const STATUS_BAND: Record<string, string> = {
  neutral: "bg-surface-sunken text-navy-900",
  info: "bg-navy-900 text-white",
  warning: "bg-warning-50 text-warning-700 ring-1 ring-inset ring-warning-600/30",
  success: "bg-success-50 text-success-700 ring-1 ring-inset ring-success-600/25",
  danger: "bg-danger-50 text-danger-700 ring-1 ring-inset ring-danger-600/30",
};

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Kampala",
  }).format(date);
}

export function Portal({
  application,
  config,
  justSubmitted,
}: {
  application: PortalApplication;
  config: ApplicationConfig;
  justSubmitted: boolean;
}) {
  const status = APPLICATION_STATUS_COPY[application.status];
  const documentTypes = documentTypesFor(config, application.applicationClass?.level ?? null);
  const applicantName = [application.firstName, application.lastName].filter(Boolean).join(" ");
  const unread = application.messages.filter((message) => !message.readAt).length;

  const needsAttention = documentTypes.filter((type) => {
    const existing = application.documents.find((doc) => doc.documentTypeId === type.id) ?? null;
    return (
      canApplicantUpload(application, existing) &&
      (existing !== null || type.isRequired || application.status === "DOCUMENTS_REQUIRED")
    );
  });

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-16">
      <div className="flex flex-col gap-10">
        {justSubmitted ? (
          <Alert tone="success" title="Your application has been submitted">
            Your reference is{" "}
            <strong className="font-mono tracking-wide">{application.referenceNumber}</strong>.
            Please write it down: you will need it, with the applicant&rsquo;s
            surname and date of birth, to check on the application later.
          </Alert>
        ) : null}

        <section
          aria-labelledby="status-heading"
          className={cn(
            "rounded-card p-6 md:p-8",
            status.tone === "info" && "on-dark",
            STATUS_BAND[status.tone],
          )}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-75">
            Current status
          </p>
          {/* Headings default to navy; on a coloured band the label takes the band's colour. */}
          <h2 id="status-heading" className="mt-2 font-serif text-3xl text-inherit">
            {status.label}
          </h2>
          <p className="mt-3 max-w-xl leading-relaxed opacity-90">{status.explanation}</p>
          {application.submittedAt ? (
            <p className="mt-4 text-sm opacity-75">
              Submitted {formatDate(application.submittedAt)}
              {application.decisionAt ? ` · Decided ${formatDate(application.decisionAt)}` : ""}
            </p>
          ) : null}
        </section>

        {application.messages.length > 0 ? (
          <section aria-labelledby="messages-heading">
            <div className="flex items-baseline gap-3">
              <h2 id="messages-heading" className="font-serif text-2xl text-navy-900">
                Messages from the school
              </h2>
              {unread > 0 ? <Badge tone="gold">{unread} new</Badge> : null}
            </div>
            <ul className="mt-5 flex flex-col gap-4">
              {application.messages.map((message) => (
                <li
                  key={message.id}
                  className={cn(
                    "rounded-card border bg-surface-raised p-5",
                    message.readAt ? "border-line" : "border-gold-400",
                  )}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-semibold text-navy-900">{message.subject}</h3>
                    <time
                      dateTime={message.createdAt.toISOString()}
                      className="text-xs text-ink-500"
                    >
                      {formatDateTime(message.createdAt)}
                    </time>
                  </div>
                  <p className="mt-3 whitespace-pre-line text-[0.9375rem] leading-relaxed text-ink-700">
                    {message.body}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {documentTypes.length > 0 ? (
          <section aria-labelledby="documents-heading">
            <h2 id="documents-heading" className="font-serif text-2xl text-navy-900">
              Documents
            </h2>
            {needsAttention.length > 0 ? (
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-600">
                You can upload or replace the documents marked below. Everything
                else is with the school.
              </p>
            ) : null}
            <ul className="mt-5 flex flex-col gap-4">
              {documentTypes.map((type) => {
                const existing =
                  application.documents.find((doc) => doc.documentTypeId === type.id) ?? null;
                const editable = canApplicantUpload(application, existing);
                const docStatus = existing ? DOCUMENT_STATUS_COPY[existing.status] : null;

                return (
                  <DocumentUploader
                    key={type.id}
                    type={type}
                    existing={existing}
                    uploadAction={uploadPortalDocument}
                    editable={editable}
                    note={
                      existing &&
                      (existing.status === DocumentVerificationStatus.REJECTED ||
                        existing.status === DocumentVerificationStatus.REPLACEMENT_REQUIRED)
                        ? (existing.note ?? "The school has asked for this document to be uploaded again.")
                        : null
                    }
                    statusBadge={
                      docStatus ? (
                        <Badge tone={docStatus.tone as BadgeTone}>{docStatus.label}</Badge>
                      ) : null
                    }
                    downloadHref={
                      existing ? `/admissions/application-status/documents/${existing.id}` : null
                    }
                  />
                );
              })}
            </ul>
          </section>
        ) : null}

        {application.events.length > 0 ? (
          <section aria-labelledby="history-heading">
            <h2 id="history-heading" className="font-serif text-2xl text-navy-900">
              History
            </h2>
            <ol className="mt-5 flex flex-col border-l-2 border-line pl-5">
              {application.events.map((event) => (
                <li key={event.id} className="relative pb-5 last:pb-0">
                  <span
                    aria-hidden="true"
                    className="absolute -left-[1.6875rem] top-1.5 size-3 rounded-full bg-gold-400 ring-4 ring-white"
                  />
                  <p className="text-[0.9375rem] text-navy-900">{describeEvent(event)}</p>
                  <time
                    dateTime={event.createdAt.toISOString()}
                    className="text-xs text-ink-500"
                  >
                    {formatDateTime(event.createdAt)}
                  </time>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>

      <aside className="flex h-fit flex-col gap-6 lg:sticky lg:top-32">
        <div className="border border-line bg-surface-raised p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">
            Reference
          </p>
          <p className="mt-1 font-mono text-lg font-semibold tracking-wide text-navy-900">
            {application.referenceNumber}
          </p>
          <dl className="mt-5 flex flex-col gap-3 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">
                Applicant
              </dt>
              <dd className="text-navy-900">{applicantName || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">
                Applying for
              </dt>
              <dd className="text-navy-900">
                {application.applicationClass?.name ?? "—"} · {application.academicYear.name}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">
                Documents
              </dt>
              <dd className="text-navy-900">
                {application.documents.length} uploaded
                {application.documents.length > 0
                  ? ` (${formatBytes(
                      application.documents.reduce((sum, doc) => sum + doc.mediaAsset.size, 0),
                    )})`
                  : ""}
              </dd>
            </div>
          </dl>
          <form action={signOut} className="mt-6">
            <Button type="submit" variant="secondary" size="sm" className="w-full">
              Sign out
            </Button>
          </form>
          <p className="mt-3 text-xs leading-relaxed text-ink-500">
            Sign out if this is a shared computer. Access also expires on its
            own after two hours.
          </p>
        </div>
      </aside>
    </div>
  );
}
