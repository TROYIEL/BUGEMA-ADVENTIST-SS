"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { ApplicationStatus, DocumentVerificationStatus } from "@bass/db/enums";
import { Alert } from "@bass/ui/alert";
import { Button } from "@bass/ui/button";
import { Field, Input, Textarea } from "@bass/ui/field";
import { Picker } from "@bass/ui/picker";

import type { ActionState } from "@/app/(dashboard)/applications/actions";
import { STAFF_STATUS_LABELS } from "./status-badge";

/**
 * The four things staff do to an application. Each is a small form bound to
 * its Server Action; the page around them is server-rendered and refreshes
 * through revalidatePath when an action succeeds.
 */

const INITIAL: ActionState = { status: "idle" };

type BoundAction = (previous: ActionState, formData: FormData) => Promise<ActionState>;

function Message({ state }: { state: ActionState }) {
  if (state.status === "error" && state.message) return <Alert tone="danger">{state.message}</Alert>;
  if (state.status === "success" && state.message) return <Alert tone="success">{state.message}</Alert>;
  return null;
}

function Submit({
  label,
  pendingLabel,
  variant = "primary",
  size = "md",
}: {
  label: string;
  pendingLabel: string;
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

const PROGRESS: ApplicationStatus[] = [
  ApplicationStatus.SUBMITTED,
  ApplicationStatus.UNDER_REVIEW,
  ApplicationStatus.DOCUMENTS_REQUIRED,
  ApplicationStatus.SHORTLISTED,
  ApplicationStatus.WITHDRAWN,
];

const OUTCOMES: ApplicationStatus[] = [
  ApplicationStatus.ACCEPTED,
  ApplicationStatus.CONDITIONALLY_ACCEPTED,
  ApplicationStatus.REJECTED,
];

export function StatusForm({
  action,
  current,
  canDecide,
}: {
  action: BoundAction;
  current: ApplicationStatus;
  canDecide: boolean;
}) {
  const [state, formAction] = useActionState(action, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <Message state={state} />

      <Field id="status" label="Change status to" error={state.fieldErrors?.status}>
        {(props) => (
          <Picker
            {...props}
            name="status"
            options={[
              ...PROGRESS.filter((status) => status !== current).map((status) => ({
                value: status,
                label: STAFF_STATUS_LABELS[status],
                group: "Progress",
              })),
              ...OUTCOMES.filter((status) => status !== current).map((status) => ({
                value: status,
                label: STAFF_STATUS_LABELS[status],
                group: canDecide ? "Decision" : "Decision (your role cannot decide)",
                disabled: !canDecide,
              })),
            ]}
          />
        )}
      </Field>

      <Field
        id="status-note"
        label="Note"
        hint="Optional. A reason, a condition of the offer, or what to do next."
        error={state.fieldErrors?.note}
      >
        {(props) => <Textarea {...props} name="note" rows={3} required={false} />}
      </Field>

      <fieldset className="flex flex-col gap-1.5 text-sm">
        <legend className="mb-1 text-sm font-semibold text-navy-900">Who sees the note</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="noteAudience" value="applicant" defaultChecked className="accent-navy-800" />
          The applicant — shown in their portal and emailed with the new status
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="noteAudience" value="internal" className="accent-navy-800" />
          Staff only — kept as an internal note
        </label>
      </fieldset>

      <div>
        <Submit label="Update status" pendingLabel="Updating…" />
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Document review
// ---------------------------------------------------------------------------

export function DocumentReviewForm({
  action,
  documentId,
  current,
}: {
  action: BoundAction;
  documentId: string;
  current: DocumentVerificationStatus;
}) {
  const [state, formAction] = useActionState(action, INITIAL);

  const options: { value: DocumentVerificationStatus; label: string }[] = [
    { value: DocumentVerificationStatus.VERIFIED, label: "Verified — it is what it should be" },
    { value: DocumentVerificationStatus.REPLACEMENT_REQUIRED, label: "Replacement needed — unclear, wrong page, out of date" },
    { value: DocumentVerificationStatus.REJECTED, label: "Not accepted — wrong document altogether" },
    { value: DocumentVerificationStatus.PENDING, label: "Put back for review" },
  ];

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      <Message state={state} />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <Field id={`decision-${documentId}`} label="Outcome" error={state.fieldErrors?.decision}>
          {(props) => (
            <Picker
              {...props}
              name="decision"
              options={options
                .filter((option) => option.value !== current)
                .map((option) => ({ value: option.value, label: option.label }))}
            />
          )}
        </Field>
        <Submit label="Save" pendingLabel="Saving…" size="md" variant="secondary" />
      </div>
      <Field
        id={`note-${documentId}`}
        label="Note to the applicant"
        hint="Required when asking for a replacement or rejecting: say what to send instead."
        error={state.fieldErrors?.note}
      >
        {(props) => <Textarea {...props} name="note" rows={2} required={false} />}
      </Field>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Internal notes
// ---------------------------------------------------------------------------

export function NoteForm({ action }: { action: BoundAction }) {
  const [state, formAction] = useActionState(action, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      <Message state={state} />
      <Field id="note-body" label="Add a note" hint="Only staff see notes." error={state.fieldErrors?.body}>
        {(props) => <Textarea {...props} name="body" rows={3} required={false} />}
      </Field>
      <div>
        <Submit label="Add note" pendingLabel="Adding…" variant="secondary" size="sm" />
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Messages to the applicant
// ---------------------------------------------------------------------------

export function MessageForm({ action, hasEmail }: { action: BoundAction; hasEmail: boolean }) {
  const [state, formAction] = useActionState(action, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      <Message state={state} />
      {!hasEmail ? (
        <Alert tone="warning">
          This applicant gave no email address. The message will appear in their
          portal but nothing will be sent; telephone them to say it is there.
        </Alert>
      ) : null}
      <Field id="message-subject" label="Subject" error={state.fieldErrors?.subject} required>
        {(props) => <Input {...props} name="subject" />}
      </Field>
      <Field id="message-body" label="Message" error={state.fieldErrors?.body} required>
        {(props) => <Textarea {...props} name="body" rows={5} />}
      </Field>
      <div>
        <Submit label={hasEmail ? "Send message" : "Post to portal"} pendingLabel="Sending…" />
      </div>
    </form>
  );
}
