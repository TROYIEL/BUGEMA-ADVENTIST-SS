import "server-only";

import {
  absoluteUrl,
  escapeHtml,
  getNotificationAddress,
  sendMail,
} from "./mail";

/**
 * The three emails the application process sends. Each is plain, short and
 * safe to read aloud over a telephone, because that is how a good number of
 * parents will hear it.
 *
 * Every function returns quietly. Mail failures are recorded on the outbox
 * row; they must never surface as a failed submission.
 */

const SCHOOL = "Bugema Adventist Secondary School";

function layout(body: string): string {
  return `
    <div style="font-family: Georgia, 'Times New Roman', serif; color: #14213d; max-width: 36rem; line-height: 1.55;">
      ${body}
      <p style="margin-top: 2rem; color: #6b7280; font-size: 0.875rem;">${SCHOOL}</p>
    </div>
  `;
}

export function portalAccessUrl(accessToken: string): string {
  return absoluteUrl(`/admissions/application-status/access/${encodeURIComponent(accessToken)}`);
}

export function draftResumeUrl(draftToken: string): string {
  return absoluteUrl(`/admissions/apply/resume?token=${encodeURIComponent(draftToken)}`);
}

export async function sendSubmissionConfirmation({
  to,
  toName,
  applicantName,
  referenceNumber,
  accessToken,
  applicationId,
}: {
  to: string;
  toName: string | null;
  applicantName: string;
  referenceNumber: string;
  accessToken: string;
  applicationId: string;
}): Promise<void> {
  const link = portalAccessUrl(accessToken);

  await sendMail({
    to,
    toName: toName ?? undefined,
    subject: `Application received — ${referenceNumber}`,
    relatedType: "application",
    relatedId: applicationId,
    html: layout(`
      <p>Thank you. The application for <strong>${escapeHtml(applicantName)}</strong> has been received by the admissions office.</p>
      <p>Your application reference is:</p>
      <p style="font-size: 1.5rem; font-weight: bold; letter-spacing: 0.05em;">${escapeHtml(referenceNumber)}</p>
      <p>Please keep it. You will need it, together with the applicant's surname and date of birth, to check the application's progress.</p>
      <p>You can also open the application directly with this link:</p>
      <p><a href="${link}">${link}</a></p>
      <p>Anyone with this link can see the application, so please do not forward it.</p>
    `),
  });
}

export async function sendAdminNewApplicationNotice({
  applicantName,
  referenceNumber,
  className,
  applicationId,
}: {
  applicantName: string;
  referenceNumber: string;
  className: string | null;
  applicationId: string;
}): Promise<void> {
  const notify = await getNotificationAddress("application");
  if (!notify) return;

  await sendMail({
    to: notify,
    subject: `New application: ${referenceNumber}`,
    relatedType: "application",
    relatedId: applicationId,
    html: layout(`
      <p>A new application has been submitted through the website.</p>
      <p><strong>Reference:</strong> ${escapeHtml(referenceNumber)}<br>
         <strong>Applicant:</strong> ${escapeHtml(applicantName)}<br>
         <strong>Class:</strong> ${escapeHtml(className ?? "Not specified")}</p>
      <p>Open the administration system to review it.</p>
    `),
  });
}

/** Where an applicant goes to see the detail: the lookup page, never a token link. */
function portalNote(referenceNumber: string): string {
  const url = absoluteUrl("/admissions/application-status");
  return `<p>To see the full application, go to <a href="${url}">${url}</a> and enter reference <strong>${escapeHtml(referenceNumber)}</strong> with the applicant's surname and date of birth.</p>`;
}

export async function sendStatusUpdate({
  to,
  toName,
  applicantName,
  referenceNumber,
  statusLabel,
  explanation,
  note,
  applicationId,
}: {
  to: string;
  toName: string | null;
  applicantName: string;
  referenceNumber: string;
  statusLabel: string;
  explanation: string;
  note: string | null;
  applicationId: string;
}): Promise<void> {
  await sendMail({
    to,
    toName: toName ?? undefined,
    subject: `${referenceNumber}: ${statusLabel}`,
    relatedType: "application",
    relatedId: applicationId,
    html: layout(`
      <p>The application for <strong>${escapeHtml(applicantName)}</strong> (${escapeHtml(referenceNumber)}) has been updated.</p>
      <p style="font-size: 1.25rem; font-weight: bold;">${escapeHtml(statusLabel)}</p>
      <p>${escapeHtml(explanation)}</p>
      ${note ? `<p style="border-left: 3px solid #d4a72c; padding-left: 0.75rem;">${escapeHtml(note).replace(/\n/g, "<br>")}</p>` : ""}
      ${portalNote(referenceNumber)}
    `),
  });
}

export async function sendApplicantMessageEmail({
  to,
  toName,
  referenceNumber,
  subject,
  body,
  applicationId,
}: {
  to: string;
  toName: string | null;
  referenceNumber: string;
  subject: string;
  body: string;
  applicationId: string;
}): Promise<void> {
  await sendMail({
    to,
    toName: toName ?? undefined,
    subject: `${referenceNumber}: ${subject}`,
    relatedType: "application",
    relatedId: applicationId,
    html: layout(`
      <p>A message from the admissions office about application ${escapeHtml(referenceNumber)}:</p>
      <p style="font-weight: bold;">${escapeHtml(subject)}</p>
      <p>${escapeHtml(body).replace(/\n/g, "<br>")}</p>
      ${portalNote(referenceNumber)}
    `),
  });
}

export async function sendDraftResumeLink({
  to,
  toName,
  draftToken,
  applicationId,
}: {
  to: string;
  toName: string | null;
  draftToken: string;
  applicationId: string;
}): Promise<void> {
  const link = draftResumeUrl(draftToken);

  await sendMail({
    to,
    toName: toName ?? undefined,
    subject: "Continue your application",
    relatedType: "application",
    relatedId: applicationId,
    html: layout(`
      <p>You asked for a link to carry on with an application to ${SCHOOL}.</p>
      <p><a href="${link}">${link}</a></p>
      <p>Open it on any device to pick up where you left off. The link works until the application is submitted, and anyone with it can edit the application, so please do not forward it.</p>
    `),
  });
}
