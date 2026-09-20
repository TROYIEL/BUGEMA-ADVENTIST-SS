"use client";

import { Send } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import type { FormState } from "@/lib/forms";

const INITIAL: FormState = { status: "idle" };

/**
 * The reply box at the foot of an enquiry thread. Submits to the Server
 * Action; on success the form is cleared and the new reply appears above it
 * (the action revalidates the page). On error the text is echoed back, since
 * React resets a form after any action.
 */
export function ReplyForm({
  enquiryId,
  recipient,
  action,
  deliveryConfigured,
}: {
  enquiryId: string;
  recipient: string;
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  deliveryConfigured: boolean;
}) {
  const [state, formAction] = useActionState(action, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  const draft = typeof state.values?.body === "string" ? state.values.body : "";

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={enquiryId} />
      <Field
        id="reply-body"
        label={`Reply to ${recipient}`}
        hint="Sent by email from the school's address, with the original message quoted underneath. Plain text; a blank line starts a new paragraph."
        error={state.fieldErrors?.body}
      >
        {(props) => (
          <Textarea
            {...props}
            name="body"
            rows={7}
            required
            maxLength={5000}
            defaultValue={draft}
            placeholder="Dear …"
          />
        )}
      </Field>

      {state.status === "success" && state.message ? (
        <Alert tone={state.message.startsWith("Reply sent") ? "success" : "warning"}>{state.message}</Alert>
      ) : null}
      {state.status === "error" && state.message ? <Alert tone="danger">{state.message}</Alert> : null}
      {!deliveryConfigured ? (
        <p className="text-xs text-ink-500">
          No mail server is configured, so the reply will be saved and queued rather than sent now.
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        <SendButton />
      </div>
    </form>
  );
}

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Send aria-hidden="true" className="size-4" />
      {pending ? "Sending…" : "Send reply"}
    </Button>
  );
}
