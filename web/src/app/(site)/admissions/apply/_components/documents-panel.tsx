"use client";

import { useActionState, useId } from "react";
import { useFormStatus } from "react-dom";

import type { ApplicationDocumentRow, DocumentTypeConfig } from "@/lib/applications";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

import type { StepFormState } from "../actions";
import { FormFooter, FormMessage, INITIAL_STATE } from "./form-parts";
import { acceptedSummary, formatBytes } from "./format";

/**
 * One upload form per document type. Each is independent: a rejected passport
 * photograph does not disturb a report card that was already accepted, and a
 * slow connection uploads one file at a time rather than all of them at once.
 */

function UploadButton({ replace }: { replace: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={replace ? "secondary" : "primary"} disabled={pending}>
      {pending ? "Uploading…" : replace ? "Replace file" : "Upload"}
    </Button>
  );
}

function RemoveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-sm font-semibold text-danger-600 underline-offset-4 hover:underline disabled:opacity-50"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}

export function DocumentUploader({
  type,
  existing,
  uploadAction,
  removeAction,
  /** Whether the applicant may replace or remove what is already there. */
  editable = true,
  /** Plain-language note from staff about why a replacement is needed. */
  note,
  statusBadge,
  /** Where the applicant can open what they uploaded, once it is served by an authorised route. */
  downloadHref,
}: {
  type: DocumentTypeConfig;
  existing: ApplicationDocumentRow | null;
  uploadAction: (previous: StepFormState, formData: FormData) => Promise<StepFormState>;
  removeAction?: (formData: FormData) => Promise<void>;
  editable?: boolean;
  note?: string | null;
  statusBadge?: React.ReactNode;
  downloadHref?: string | null;
}) {
  const [state, formAction] = useActionState(uploadAction, INITIAL_STATE);
  const inputId = useId();

  return (
    <li
      className={cn(
        "flex flex-col gap-4 rounded-card border bg-surface-raised p-5",
        existing ? "border-line" : type.isRequired ? "border-gold-400" : "border-line",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold text-navy-900">{type.name}</h3>
          {type.description ? (
            <p className="text-sm leading-relaxed text-ink-600">{type.description}</p>
          ) : null}
          <p className="text-xs text-ink-500">
            {acceptedSummary(type.acceptedMimeTypes)} · up to {formatBytes(type.maxSizeBytes)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {statusBadge}
          {!existing ? (
            <Badge tone={type.isRequired ? "gold" : "neutral"}>
              {type.isRequired ? "Required" : "Optional"}
            </Badge>
          ) : null}
        </div>
      </div>

      {note ? (
        <Alert tone="warning" className="text-sm">
          {note}
        </Alert>
      ) : null}

      {existing ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-sm">
          <div className="flex min-w-0 items-center gap-2">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="size-5 shrink-0 text-success-600">
              <circle cx="10" cy="10" r="8.25" strokeWidth="1.5" stroke="currentColor" opacity="0.35" />
              <path d="m5.5 10.5 3 3 6-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {downloadHref ? (
              <a
                href={downloadHref}
                target="_blank"
                rel="noopener"
                className="truncate font-medium text-navy-900 underline-offset-4 hover:underline"
              >
                {existing.mediaAsset.originalName}
              </a>
            ) : (
              <span className="truncate font-medium text-navy-900">
                {existing.mediaAsset.originalName}
              </span>
            )}
            <span className="shrink-0 text-ink-500">{formatBytes(existing.mediaAsset.size)}</span>
          </div>
          {editable && removeAction ? (
            <form action={removeAction}>
              <input type="hidden" name="documentId" value={existing.id} />
              <RemoveButton />
            </form>
          ) : null}
        </div>
      ) : null}

      {/* No encType on the form: React sets multipart itself for a function action. */}
      {editable ? (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="documentTypeId" value={type.id} />
          <FormMessage state={state} />
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor={inputId} className="sr-only">
              {existing ? `Replace ${type.name}` : `Choose file for ${type.name}`}
            </label>
            <input
              id={inputId}
              type="file"
              name="file"
              required
              accept={type.acceptedMimeTypes.join(",")}
              className="block max-w-full text-sm text-ink-700 file:mr-3 file:rounded-full file:border-0 file:bg-navy-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-navy-800 hover:file:bg-navy-100"
            />
            <UploadButton replace={Boolean(existing)} />
          </div>
        </form>
      ) : null}
    </li>
  );
}

function ContinueForm({
  completeAction,
  backHref,
}: {
  completeAction: (previous: StepFormState, formData: FormData) => Promise<StepFormState>;
  backHref: string;
}) {
  const [state, formAction] = useActionState(completeAction, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <FormFooter backHref={backHref} submitLabel="Continue to review" pendingLabel="Checking…" />
    </form>
  );
}

export function DocumentsPanel({
  types,
  documents,
  uploadAction,
  removeAction,
  completeAction,
  backHref,
}: {
  types: DocumentTypeConfig[];
  documents: ApplicationDocumentRow[];
  uploadAction: (previous: StepFormState, formData: FormData) => Promise<StepFormState>;
  removeAction: (formData: FormData) => Promise<void>;
  completeAction: (previous: StepFormState, formData: FormData) => Promise<StepFormState>;
  backHref: string;
}) {
  return (
    <div className="flex flex-col gap-8">
      <ul className="flex flex-col gap-4">
        {types.map((type) => (
          <DocumentUploader
            key={type.id}
            type={type}
            existing={documents.find((doc) => doc.documentTypeId === type.id) ?? null}
            uploadAction={uploadAction}
            removeAction={removeAction}
          />
        ))}
      </ul>

      {/* Keyed on the set of documents, so a "please upload X" message clears
          itself the moment X is uploaded rather than lingering until the next click. */}
      <ContinueForm
        key={documents.map((doc) => doc.id).join("|")}
        completeAction={completeAction}
        backHref={backHref}
      />
    </div>
  );
}
