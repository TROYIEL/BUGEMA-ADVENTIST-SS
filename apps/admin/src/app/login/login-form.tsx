"use client";

import { useActionState } from "react";

import { loginAction, type LoginState } from "@/app/login/actions";
import { Alert } from "@bass/ui/alert";
import { Button } from "@bass/ui/button";
import { Field, Input } from "@bass/ui/field";

const INITIAL: LoginState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <Field id="email" label="Email address" error={state.fieldErrors?.email} required>
        {(props) => (
          <Input
            {...props}
            name="email"
            type="email"
            autoComplete="username"
            autoFocus
            spellCheck={false}
          />
        )}
      </Field>

      <Field id="password" label="Password" error={state.fieldErrors?.password} required>
        {(props) => (
          <Input {...props} name="password" type="password" autoComplete="current-password" />
        )}
      </Field>

      <Button type="submit" size="lg" disabled={pending} withArrow className="mt-1 w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
