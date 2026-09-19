"use client";

import { useActionState } from "react";

import { submitEnquiry, type ContactState } from "@/app/(site)/contact/actions";
import { Alert } from "@bass/ui/alert";
import { Button } from "@bass/ui/button";
import { Field, Input, Textarea } from "@bass/ui/field";

const INITIAL: ContactState = { status: "idle" };

export function ContactForm() {
  const [state, formAction, pending] = useActionState(submitEnquiry, INITIAL);

  if (state.status === "success") {
    return (
      <Alert tone="success" title="Message sent">
        {state.message}
      </Alert>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.status === "error" && state.message ? (
        <Alert tone="danger">{state.message}</Alert>
      ) : null}

      {/* Honeypot. Hidden from people, and explicitly removed from the
          accessibility tree and the tab order so it never traps a real user. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-px w-px overflow-hidden">
        <label htmlFor="website">Leave this field empty</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="name" label="Your name" error={state.fieldErrors?.name} required>
          {(props) => (
            <Input {...props} name="name" autoComplete="name" defaultValue={state.values?.name} />
          )}
        </Field>

        <Field id="email" label="Email address" error={state.fieldErrors?.email} required>
          {(props) => (
            <Input {...props} name="email" type="email" autoComplete="email" defaultValue={state.values?.email} />
          )}
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="phone" label="Telephone" hint="Optional" error={state.fieldErrors?.phone}>
          {(props) => (
            <Input {...props} name="phone" type="tel" autoComplete="tel" defaultValue={state.values?.phone} required={false} />
          )}
        </Field>

        <Field id="subject" label="Subject" error={state.fieldErrors?.subject} required>
          {(props) => (
            <Input {...props} name="subject" defaultValue={state.values?.subject} />
          )}
        </Field>
      </div>

      <Field id="message" label="Message" error={state.fieldErrors?.message} required>
        {(props) => (
          <Textarea {...props} name="message" rows={6} defaultValue={state.values?.message} />
        )}
      </Field>

      <div className="mt-1">
        <Button type="submit" size="lg" disabled={pending} withArrow>
          {pending ? "Sending…" : "Send message"}
        </Button>
      </div>
    </form>
  );
}
