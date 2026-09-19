"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@bass/ui/alert";

import type { StepFormState } from "../actions";

const INITIAL: StepFormState = { status: "idle" };

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-sm font-semibold text-navy-800 underline-offset-4 hover:underline disabled:opacity-50"
    >
      {pending ? "Sending…" : "Email me a link to continue later"}
    </button>
  );
}

export function ResumeLinkForm({
  action,
  email,
}: {
  action: (previous: StepFormState, formData: FormData) => Promise<StepFormState>;
  email: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.status === "success" && state.message ? (
        <Alert tone="success" className="text-sm">
          {state.message}
        </Alert>
      ) : state.status === "error" && state.message ? (
        <Alert tone="danger" className="text-sm">
          {state.message}
        </Alert>
      ) : (
        <p className="text-sm leading-relaxed text-ink-600">
          Want to finish on another device? We can send a link to{" "}
          <span className="font-medium text-navy-900">{email}</span>.
        </p>
      )}
      {state.status !== "success" ? <SendButton /> : null}
    </form>
  );
}
