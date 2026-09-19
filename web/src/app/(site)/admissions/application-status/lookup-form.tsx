"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

import { lookup, type LookupState } from "./actions";

const INITIAL: LookupState = { status: "idle" };

export function LookupForm() {
  const [state, formAction, pending] = useActionState(lookup, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.status === "error" && state.message ? (
        <Alert tone="danger">{state.message}</Alert>
      ) : null}

      <Field
        id="referenceNumber"
        label="Application reference"
        hint="On your confirmation email, for example BASS-2026-000123."
        error={state.fieldErrors?.referenceNumber}
        required
      >
        {(props) => (
          <Input
            {...props}
            name="referenceNumber"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            defaultValue={state.values?.referenceNumber}
            className="font-mono uppercase tracking-wide"
          />
        )}
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="lastName"
          label="Applicant's surname"
          error={state.fieldErrors?.lastName}
          required
        >
          {(props) => (
            <Input {...props} name="lastName" autoComplete="off" defaultValue={state.values?.lastName} />
          )}
        </Field>
        <Field
          id="dateOfBirth"
          label="Applicant's date of birth"
          error={state.fieldErrors?.dateOfBirth}
          required
        >
          {(props) => (
            <Input {...props} name="dateOfBirth" type="date" defaultValue={state.values?.dateOfBirth} />
          )}
        </Field>
      </div>

      <div className="mt-1">
        <Button type="submit" size="lg" disabled={pending} withArrow>
          {pending ? "Checking…" : "Check application"}
        </Button>
      </div>
    </form>
  );
}
