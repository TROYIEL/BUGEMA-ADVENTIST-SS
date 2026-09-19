import type { ApplicationStatus, DocumentVerificationStatus } from "@/generated/prisma/enums";
import {
  APPLICATION_STATUS_COPY,
  DOCUMENT_STATUS_COPY,
} from "@/lib/application-schemas";
import { Badge, type BadgeTone } from "@/components/ui/badge";

/** Staff-facing labels are shorter and more literal than the applicant's. */
export const STAFF_STATUS_LABELS: Record<ApplicationStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  DOCUMENTS_REQUIRED: "Documents needed",
  SHORTLISTED: "Shortlisted",
  ACCEPTED: "Accepted",
  CONDITIONALLY_ACCEPTED: "Conditional",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <Badge tone={APPLICATION_STATUS_COPY[status].tone as BadgeTone}>
      {STAFF_STATUS_LABELS[status]}
    </Badge>
  );
}

export function DocumentStatusBadge({ status }: { status: DocumentVerificationStatus }) {
  const copy = DOCUMENT_STATUS_COPY[status];
  return <Badge tone={copy.tone as BadgeTone}>{copy.label}</Badge>;
}
