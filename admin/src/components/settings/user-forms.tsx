"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { PASSWORD_RULE } from "@/lib/auth/password-policy";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_ORDER } from "@/lib/auth/rbac";
import { UserRole } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Picker } from "@/components/ui/picker";

import { FormMessage, SaveBar, Section, useContentForm, type BoundAction, type Values } from "@/components/content/fields";
import type { FormState } from "@/lib/forms";

const ROLE_OPTIONS = ROLE_ORDER.map((role) => ({ value: role, label: ROLE_LABELS[role], description: ROLE_DESCRIPTIONS[role] }));

/** Name, email and role; a new account also gets its first password here. */
export function UserForm({ action, values, isNew, isSelf }: { action: BoundAction; values: Values; isNew: boolean; isSelf: boolean }) {
  const form = useContentForm(action, values);
  return (
    <form action={form.formAction} className="flex flex-col gap-6" noValidate>
      <FormMessage state={form.state} />
      <Section title="Account">
        <div className="grid gap-5 md:grid-cols-2">
          <Field id="name" label="Name" error={form.error("name")} required>
            {(props) => <Input {...props} name="name" defaultValue={form.text("name")} autoComplete="off" />}
          </Field>
          <Field id="email" label="Email" hint="Used to sign in." error={form.error("email")} required>
            {(props) => <Input {...props} name="email" type="email" defaultValue={form.text("email")} autoComplete="off" />}
          </Field>
        </div>
        <Field
          id="role"
          label="Role"
          hint={isSelf ? "Your own role can only be changed by another super administrator." : "What the person can do. Changing it signs them out everywhere."}
          error={form.error("role")}
          required
        >
          {(props) => <Picker {...props} name="role" defaultValue={form.text("role") || UserRole.STAFF} options={ROLE_OPTIONS} disabled={isSelf} />}
        </Field>
      </Section>
      {isNew ? (
        <Section title="First password" hint={`${PASSWORD_RULE} Pass it on privately; they can change it once signed in.`}>
          <PasswordFields form={form} />
        </Section>
      ) : null}
      <SaveBar isNew={isNew} backHref="/users" noun="account" />
    </form>
  );
}

function PasswordFields({ form }: { form: ReturnType<typeof useContentForm> }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Field id="password" label="Password" error={form.error("password")} required>
        {(props) => <Input {...props} name="password" type="password" autoComplete="new-password" />}
      </Field>
      <Field id="confirm" label="Confirm password" error={form.error("confirm")} required>
        {(props) => <Input {...props} name="confirm" type="password" autoComplete="new-password" />}
      </Field>
    </div>
  );
}

const INITIAL: FormState = { status: "idle" };

/** An administrator setting someone else's password. */
export function ResetPasswordForm({ action }: { action: (previous: FormState, formData: FormData) => Promise<FormState> }) {
  const [state, formAction] = useActionState(action, INITIAL);
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <div className="grid gap-5 md:grid-cols-2">
        <Field id="reset-password" label="New password" hint={PASSWORD_RULE} error={state.fieldErrors?.password} required>
          {(props) => <Input {...props} name="password" type="password" autoComplete="new-password" />}
        </Field>
        <Field id="reset-confirm" label="Confirm" error={state.fieldErrors?.confirm} required>
          {(props) => <Input {...props} name="confirm" type="password" autoComplete="new-password" />}
        </Field>
      </div>
      <div>
        <Submit label="Set password" />
      </div>
    </form>
  );
}

/** A person changing their own password. */
export function ChangePasswordForm({ action }: { action: (previous: FormState, formData: FormData) => Promise<FormState> }) {
  const [state, formAction] = useActionState(action, INITIAL);
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <Field id="current" label="Current password" error={state.fieldErrors?.current} required>
        {(props) => <Input {...props} name="current" type="password" autoComplete="current-password" />}
      </Field>
      <div className="grid gap-5 md:grid-cols-2">
        <Field id="password" label="New password" hint={PASSWORD_RULE} error={state.fieldErrors?.password} required>
          {(props) => <Input {...props} name="password" type="password" autoComplete="new-password" />}
        </Field>
        <Field id="confirm" label="Confirm" error={state.fieldErrors?.confirm} required>
          {(props) => <Input {...props} name="confirm" type="password" autoComplete="new-password" />}
        </Field>
      </div>
      <div>
        <Submit label="Change password" />
      </div>
    </form>
  );
}

/** A person changing their own name. */
export function OwnNameForm({ action, name }: { action: (previous: FormState, formData: FormData) => Promise<FormState>; name: string }) {
  const [state, formAction] = useActionState(action, INITIAL);
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <Field id="own-name" label="Name" hint="As it appears in the audit log and on anything you send." error={state.fieldErrors?.name} required>
        {(props) => <Input {...props} name="name" defaultValue={typeof state.values?.name === "string" ? state.values.name : name} />}
      </Field>
      <div>
        <Submit label="Save name" />
      </div>
    </form>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}
