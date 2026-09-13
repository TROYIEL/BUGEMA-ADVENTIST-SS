import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { requirePagePermission } from "@bass/auth/dal";
import { hasPermission } from "@bass/auth/rbac";
import { DocumentVerificationStatus } from "@bass/db/enums";
import {
  APPLICATION_STATUS_COPY,
  BOARDING_LABELS,
  GENDER_LABELS,
  LEVEL_LABELS,
  formatAnswer,
} from "@bass/core/application-schemas";
import { documentTypesFor, getApplicationConfig, readAnswers } from "@bass/core/applications";
import { getApplicationForStaff } from "@bass/core/applications-admin";
import { formatDate } from "@bass/core/content";
import { Alert } from "@bass/ui/alert";
import { Badge } from "@bass/ui/badge";

import {
  DocumentReviewForm,
  MessageForm,
  NoteForm,
  StatusForm,
} from "@/components/applications/forms";
import { formatBytes, formatDateTime, formatDay, fullName } from "@/components/applications/format";
import { DocumentStatusBadge, StatusBadge } from "@/components/applications/status-badge";
import { Timeline } from "@/components/applications/timeline";

import { addNote, changeStatus, review, sendMessage } from "../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const application = await getApplicationForStaff(id);
  return { title: application?.referenceNumber ?? "Application" };
}

function Section({
  title,
  children,
  aside,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h2 className="text-base font-semibold text-navy-900">{title}</h2>
        {aside}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className="grid gap-0.5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-500 sm:pt-0.5">
        {label}
      </dt>
      <dd className={empty ? "text-sm text-ink-400" : "text-sm text-navy-900"}>
        {empty ? "Not given" : value}
      </dd>
    </div>
  );
}

export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePagePermission("applications:read");
  const { id } = await params;

  const [application, config] = await Promise.all([
    getApplicationForStaff(id),
    getApplicationConfig(),
  ]);
  if (!application) notFound();

  const canWrite = hasPermission(user.role, "applications:write");
  const canDecide = hasPermission(user.role, "applications:decide");
  const canReview = hasPermission(user.role, "documents:review");
  const canMessage = hasPermission(user.role, "messages:write");

  const answers = readAnswers(application);
  const documentTypes = documentTypesFor(config, application.applicationClass?.level ?? null);
  const knownTypeIds = new Set(documentTypes.map((type) => type.id));
  // Documents whose type has since been retired or re-levelled still belong
  // to the application and must not vanish from the review.
  const orphanDocuments = application.documents.filter(
    (doc) => !doc.documentType || !knownTypeIds.has(doc.documentType.id),
  );
  const pendingCount = application.documents.filter(
    (doc) => doc.status === DocumentVerificationStatus.PENDING,
  ).length;
  const awaitingApplicant = application.documents.filter(
    (doc) =>
      doc.status === DocumentVerificationStatus.REJECTED ||
      doc.status === DocumentVerificationStatus.REPLACEMENT_REQUIRED,
  ).length;
  const name = fullName(application);

  return (
    <div className="container-admin py-8">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-500">
        <Link href="/applications" className="hover:underline">
          Applications
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="font-mono text-navy-900">{application.referenceNumber}</span>
      </nav>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">{name}</h1>
          <p className="mt-1 text-sm text-ink-600">
            {application.applicationClass?.name ?? "No class"}
            {application.applicationClass ? ` (${LEVEL_LABELS[application.applicationClass.level]})` : ""}
            {" · "}
            {application.academicYear.name}
            {application.boardingPreference
              ? ` · ${BOARDING_LABELS[application.boardingPreference]}`
              : ""}
            {application.submittedAt ? ` · submitted ${formatDay(application.submittedAt)}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={application.status} />
          {application.decisionAt ? (
            <p className="text-xs text-ink-500">
              Decided {formatDay(application.decisionAt)}
              {application.decidedBy ? ` by ${application.decidedBy.name}` : ""}
            </p>
          ) : null}
        </div>
      </header>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Section title="Applicant">
            <dl className="flex flex-col gap-3">
              <Row label="Full name" value={name} />
              <Row label="Date of birth" value={formatDate(application.dateOfBirth)} />
              <Row label="Gender" value={application.gender ? GENDER_LABELS[application.gender] : ""} />
              <Row label="Nationality" value={application.nationality} />
              <Row label="District" value={application.homeDistrict} />
              <Row label="Home address" value={application.homeAddress} />
              {config.fields
                .filter((field) => field.step === "APPLICANT")
                .map((field) => (
                  <Row key={field.id} label={field.label} value={formatAnswer(field, answers[field.key])} />
                ))}
            </dl>
          </Section>

          <Section title="Parent or guardian">
            <dl className="flex flex-col gap-3">
              <Row label="Name" value={application.guardianName} />
              <Row label="Relationship" value={application.guardianRelationship} />
              <Row label="Occupation" value={application.guardianOccupation} />
              <Row
                label="Telephone"
                value={
                  application.guardianPhone ? (
                    <a href={`tel:${application.guardianPhone.replace(/\s+/g, "")}`} className="hover:underline">
                      {application.guardianPhone}
                    </a>
                  ) : ""
                }
              />
              <Row label="Other telephone" value={application.guardianAltPhone} />
              <Row
                label="Email"
                value={
                  application.guardianEmail ? (
                    <a href={`mailto:${application.guardianEmail}`} className="hover:underline">
                      {application.guardianEmail}
                    </a>
                  ) : ""
                }
              />
              <Row label="Address" value={application.guardianAddress} />
              {config.fields
                .filter((field) => field.step === "GUARDIAN")
                .map((field) => (
                  <Row key={field.id} label={field.label} value={formatAnswer(field, answers[field.key])} />
                ))}
            </dl>
          </Section>

          <Section title="Schooling">
            <dl className="flex flex-col gap-3">
              <Row label="Previous school" value={application.previousSchool} />
              <Row label="Class completed" value={application.previousClass} />
              <Row label="Year completed" value={application.yearCompleted ?? ""} />
              <Row label="Exam index number" value={application.examIndexNumber} />
              <Row
                label="Results"
                value={
                  application.examResults ? (
                    <span className="whitespace-pre-line">{application.examResults}</span>
                  ) : ""
                }
              />
              {config.fields
                .filter((field) => field.step === "ACADEMIC")
                .map((field) => (
                  <Row key={field.id} label={field.label} value={formatAnswer(field, answers[field.key])} />
                ))}
            </dl>
          </Section>

          {config.fields.some((field) => !["APPLICANT", "GUARDIAN", "ACADEMIC"].includes(field.step)) ? (
            <Section title="Further questions">
              <dl className="flex flex-col gap-3">
                {config.fields
                  .filter((field) => !["APPLICANT", "GUARDIAN", "ACADEMIC"].includes(field.step))
                  .map((field) => (
                    <Row key={field.id} label={field.label} value={formatAnswer(field, answers[field.key])} />
                  ))}
              </dl>
            </Section>
          ) : null}

          <Section
            title="Documents"
            aside={
              pendingCount > 0 ? (
                <Badge tone="gold">{pendingCount} awaiting review</Badge>
              ) : awaitingApplicant > 0 ? (
                <Badge tone="warning">
                  {awaitingApplicant} waiting on the applicant
                </Badge>
              ) : application.documents.length > 0 ? (
                <Badge tone="success">All reviewed</Badge>
              ) : null
            }
          >
            {documentTypes.length === 0 && application.documents.length === 0 ? (
              <p className="text-sm text-ink-500">No documents are asked for at this level.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {documentTypes.map((type) => {
                  const doc = application.documents.find((entry) => entry.documentType?.id === type.id);
                  return (
                    <DocumentRow
                      key={type.id}
                      title={type.name}
                      required={type.isRequired}
                      doc={doc ?? null}
                      canReview={canReview}
                    />
                  );
                })}
                {orphanDocuments.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    title={doc.documentType?.name ?? "Document (type removed)"}
                    required={false}
                    doc={doc}
                    canReview={canReview}
                  />
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Messages to the applicant"
            aside={
              application.messages.length > 0 ? (
                <span className="text-xs text-ink-500">
                  {application.messages.filter((message) => message.readAt).length} of{" "}
                  {application.messages.length} read
                </span>
              ) : null
            }
          >
            {application.messages.length > 0 ? (
              <ul className="mb-5 flex flex-col gap-3">
                {application.messages.map((message) => (
                  <li key={message.id} className="rounded-md border border-line bg-surface-sunken/60 p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-navy-900">{message.subject}</p>
                      <p className="text-xs text-ink-500">
                        {message.sentBy?.name ?? "Staff"} · {formatDateTime(message.createdAt)}
                        {message.readAt ? ` · read ${formatDateTime(message.readAt)}` : " · unread"}
                      </p>
                    </div>
                    <p className="mt-2 whitespace-pre-line text-sm text-ink-700">{message.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-5 text-sm text-ink-500">No messages have been sent.</p>
            )}
            {canMessage ? (
              <MessageForm
                action={sendMessage.bind(null, application.id)}
                hasEmail={Boolean(application.contactEmail)}
              />
            ) : null}
          </Section>

          <Section title="Internal notes">
            {application.notes.length > 0 ? (
              <ul className="mb-5 flex flex-col gap-3">
                {application.notes.map((note) => (
                  <li key={note.id} className="border-l-2 border-navy-200 pl-3">
                    <p className="whitespace-pre-line text-sm text-ink-800">{note.body}</p>
                    <p className="mt-1 text-xs text-ink-500">
                      {note.author?.name ?? "Staff"} · {formatDateTime(note.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-5 text-sm text-ink-500">No notes yet.</p>
            )}
            {canWrite ? <NoteForm action={addNote.bind(null, application.id)} /> : null}
          </Section>

          <Section title="History">
            <Timeline events={application.events} />
          </Section>
        </div>

        <aside className="flex flex-col gap-6 xl:sticky xl:top-6 xl:self-start">
          <section className="rounded-lg border border-line bg-white">
            <div className="border-b border-line px-5 py-3">
              <h2 className="text-base font-semibold text-navy-900">Status</h2>
            </div>
            <div className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={application.status} />
                {application.decisionAt ? (
                  <span className="text-xs text-ink-500">
                    since {formatDay(application.decisionAt)}
                    {application.decidedBy ? `, by ${application.decidedBy.name}` : ""}
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-ink-500">
                The applicant sees: &ldquo;{APPLICATION_STATUS_COPY[application.status].explanation}&rdquo;
              </p>
              {canWrite ? (
                <div className="mt-5 border-t border-line pt-5">
                  <StatusForm
                    action={changeStatus.bind(null, application.id)}
                    current={application.status}
                    canDecide={canDecide}
                  />
                </div>
              ) : (
                <Alert tone="info" className="mt-4">
                  Your role can view applications but not change them.
                </Alert>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-line bg-white">
            <div className="border-b border-line px-5 py-3">
              <h2 className="text-base font-semibold text-navy-900">At a glance</h2>
            </div>
            <dl className="flex flex-col gap-3 px-5 py-4 text-sm">
              <Row label="Reference" value={<span className="font-mono">{application.referenceNumber}</span>} />
              <Row label="Submitted" value={formatDateTime(application.submittedAt)} />
              <Row label="Last activity" value={formatDateTime(application.lastSavedAt)} />
              <Row
                label="Contact"
                value={
                  application.contactEmail || application.contactPhone ? (
                    <span className="flex flex-col break-all">
                      {application.contactPhone ? <span>{application.contactPhone}</span> : null}
                      {application.contactEmail ? <span>{application.contactEmail}</span> : null}
                    </span>
                  ) : ""
                }
              />
              <Row
                label="Documents"
                value={`${application.documents.length} uploaded${pendingCount ? `, ${pendingCount} to review` : ""}`}
              />
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}

type StaffDocument = NonNullable<
  Awaited<ReturnType<typeof getApplicationForStaff>>
>["documents"][number];

function DocumentRow({
  title,
  required,
  doc,
  canReview,
}: {
  title: string;
  required: boolean;
  doc: StaffDocument | null;
  canReview: boolean;
}) {
  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-navy-900">
            {title}
            {required ? (
              <span className="ml-2 text-xs font-semibold uppercase tracking-[0.06em] text-gold-800">
                Required
              </span>
            ) : null}
          </p>
          {doc ? (
            <p className="mt-1 text-sm text-ink-600">
              <a
                href={`/applications/documents/${doc.id}`}
                target="_blank"
                rel="noopener"
                className="font-medium text-navy-800 underline-offset-4 hover:underline"
              >
                {doc.mediaAsset.originalName}
              </a>
              <span className="text-ink-500">
                {" "}
                · {formatBytes(doc.mediaAsset.size)} · uploaded {formatDateTime(doc.createdAt)}
              </span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-ink-500">Not uploaded.</p>
          )}
          {doc?.reviewedAt ? (
            <p className="mt-1 text-xs text-ink-500">
              Reviewed by {doc.reviewedBy?.name ?? "staff"} · {formatDateTime(doc.reviewedAt)}
            </p>
          ) : null}
          {doc?.note ? (
            <p className="mt-2 border-l-2 border-gold-400 pl-3 text-sm text-ink-700">{doc.note}</p>
          ) : null}
        </div>
        {doc ? <DocumentStatusBadge status={doc.status} /> : <Badge tone="neutral">Missing</Badge>}
      </div>

      {doc && canReview ? (
        <details className="group rounded-md border border-line bg-surface-sunken/60 px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-navy-800">
            {doc.status === DocumentVerificationStatus.PENDING ? "Review this document" : "Change the outcome"}
          </summary>
          <div className="mt-3">
            <DocumentReviewForm
              action={review.bind(null, doc.id)}
              documentId={doc.id}
              current={doc.status}
            />
          </div>
        </details>
      ) : null}
    </li>
  );
}
