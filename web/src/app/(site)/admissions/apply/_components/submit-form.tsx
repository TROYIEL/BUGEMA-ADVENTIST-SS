"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import type { SubmitFormState } from "../actions";

const INITIAL: SubmitFormState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} withArrow>
      {pending ? "Submitting…" : "Submit application"}
    </Button>
  );
}

/**
 * The declaration and the submit button. Everything above it on the review
 * page is server-rendered; only this needs to hold state.
 */
export function SubmitForm({
  action,
  backHref,
}: {
  action: (previous: SubmitFormState, formData: FormData) => Promise<SubmitFormState>;
  backHref: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL);
  const declarationError = state.fieldErrors?.declaration;

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {state.status === "error" && state.message ? (
        <Alert tone="danger">
          {state.message}
          {state.fixStep ? (
            <>
              {" "}
              <Link
                href={`/admissions/apply/${state.fixStep.slug}`}
                className="font-semibold underline underline-offset-4"
              >
                Go to &ldquo;{state.fixStep.title}&rdquo;
              </Link>
            </>
          ) : null}
        </Alert>
      ) : null}

      <div className="rounded-card border border-line bg-surface-sunken p-5">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="declaration"
            aria-invalid={Boolean(declarationError)}
            aria-describedby={declarationError ? "declaration-error" : undefined}
            className="mt-1 size-4 shrink-0 accent-navy-800"
          />
          <span className="text-[0.9375rem] leading-relaxed text-navy-900">
            I confirm that the information given in this application is true and
            complete to the best of my knowledge, and I understand that the school
            may ask to see the original documents.
          </span>
        </label>
        {declarationError ? (
          <p id="declaration-error" className="mt-2 pl-7 text-sm font-medium text-danger-600">
            {declarationError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-line pt-6">
        <SubmitButton />
        <Link
          href={backHref as never}
          className="text-sm font-semibold text-navy-800 underline-offset-4 hover:underline"
        >
          Back
        </Link>
      </div>

      <p className="text-sm leading-relaxed text-ink-500">
        Once submitted, the application can no longer be edited. You will
        receive a reference number to check its progress.
      </p>
    </form>
  );
}
