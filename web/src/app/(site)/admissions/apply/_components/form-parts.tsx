"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { FormFieldType } from "@/generated/prisma/enums";
import type { FormFieldDefinition } from "@/lib/application-schemas";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/components/ui/cn";

import type { StepFormState } from "../actions";

/**
 * Pieces shared by every step of the application form.
 *
 * Each step is an ordinary <form action> posting to a Server Action, so it
 * works before JavaScript loads and on a slow connection. useActionState only
 * adds the pending state and carries validation errors back.
 */

export const INITIAL_STATE: StepFormState = { status: "idle" };

export type FormValues = Record<string, string | string[] | boolean>;

/** A step's inputs read their defaults from what was saved, or what was just rejected. */
export function useStepForm(
  action: (previous: StepFormState, formData: FormData) => Promise<StepFormState>,
  saved: FormValues,
) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  const values = state.values ?? saved;

  return {
    state,
    formAction,
    pending,
    value(name: string): string {
      const value = values[name];
      return typeof value === "string" ? value : "";
    },
    list(name: string): string[] {
      const value = values[name];
      return Array.isArray(value) ? value : [];
    },
    checked(name: string): boolean {
      return values[name] === true;
    },
    error(name: string): string | undefined {
      return state.fieldErrors?.[name];
    },
  };
}

export function FormMessage({ state }: { state: StepFormState }) {
  if (state.status === "error" && state.message) {
    return <Alert tone="danger">{state.message}</Alert>;
  }
  if (state.status === "success" && state.message) {
    return <Alert tone="success">{state.message}</Alert>;
  }
  return null;
}

/** Back is a link, not a button: nothing typed on this step is kept by going back. */
export function FormFooter({
  backHref,
  submitLabel = "Save and continue",
  pendingLabel = "Saving…",
}: {
  backHref?: string | null;
  submitLabel?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <div className="mt-2 flex flex-wrap items-center gap-4 border-t border-line pt-6">
      <Button type="submit" size="lg" disabled={pending} withArrow>
        {pending ? pendingLabel : submitLabel}
      </Button>
      {backHref ? (
        <Link
          href={backHref as never}
          className="text-sm font-semibold text-navy-800 underline-offset-4 hover:underline"
        >
          Back
        </Link>
      ) : null}
    </div>
  );
}

export function Fieldset({
  legend,
  hint,
  children,
  className,
}: {
  legend: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  // A legend is not a flex item, so the gap does not apply to it; it carries
  // its own margin instead.
  return (
    <fieldset className={cn("flex flex-col gap-5", className)}>
      <legend className="mb-3 font-serif text-xl text-navy-900">{legend}</legend>
      {hint ? <p className="-mt-1 text-sm leading-relaxed text-ink-600">{hint}</p> : null}
      {children}
    </fieldset>
  );
}

/**
 * Radios as a row of cards. The legend, hint and error are wired the same way
 * Field does it, so a screen reader hears them with the group.
 */
export function RadioGroup({
  name,
  legend,
  hint,
  options,
  value,
  error,
  required = false,
}: {
  name: string;
  legend: string;
  hint?: string;
  options: { value: string; label: string; description?: string }[];
  value: string;
  error?: string;
  required?: boolean;
}) {
  const hintId = hint ? `${name}-hint` : undefined;
  const errorId = error ? `${name}-error` : undefined;

  return (
    <fieldset
      aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
      aria-invalid={Boolean(error)}
      className="flex flex-col gap-2"
    >
      <legend className="text-sm font-semibold text-navy-900">
        {legend}
        {required ? (
          <>
            {" "}
            <span className="text-danger-600" aria-hidden="true">
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        ) : null}
      </legend>
      {hint ? (
        <p id={hintId} className="text-sm text-ink-500">
          {hint}
        </p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-card border bg-surface-raised px-3.5 py-3 transition-colors",
              "has-[:checked]:border-navy-700 has-[:checked]:bg-navy-50 hover:border-navy-300",
              error ? "border-danger-600" : "border-line-strong",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={value === option.value}
              className="mt-0.5 size-4 accent-navy-800"
            />
            <span className="flex flex-col">
              <span className="text-[0.9375rem] font-medium text-navy-900">{option.label}</span>
              {option.description ? (
                <span className="text-xs text-ink-500">{option.description}</span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
      {error ? (
        <p id={errorId} className="text-sm font-medium text-danger-600">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/**
 * The school's own questions, rendered from their stored definitions. The
 * input name carries an `answer:` prefix so a question keyed "email" cannot
 * collide with the guardian's email field on the same form.
 */
export function DynamicFields({
  fields,
  form,
}: {
  fields: FormFieldDefinition[];
  form: ReturnType<typeof useStepForm>;
}) {
  if (fields.length === 0) return null;

  return (
    <>
      {fields.map((field) => {
        const name = `answer:${field.key}`;
        const id = `field-${field.key}`;
        const error = form.error(name);
        const hint = field.helpText ?? undefined;

        if (field.fieldType === FormFieldType.CHECKBOX) {
          return (
            <div key={field.id} className="flex flex-col gap-1.5">
              <label className="flex items-start gap-3">
                <input
                  id={id}
                  type="checkbox"
                  name={name}
                  defaultChecked={form.checked(name)}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? `${id}-error` : undefined}
                  className="mt-1 size-4 accent-navy-800"
                />
                <span className="text-[0.9375rem] text-navy-900">
                  {field.label}
                  {field.isRequired ? (
                    <span className="text-danger-600" aria-hidden="true">
                      {" "}
                      *
                    </span>
                  ) : null}
                  {hint ? <span className="block text-sm text-ink-500">{hint}</span> : null}
                </span>
              </label>
              {error ? (
                <p id={`${id}-error`} className="text-sm font-medium text-danger-600">
                  {error}
                </p>
              ) : null}
            </div>
          );
        }

        if (field.fieldType === FormFieldType.RADIO) {
          return (
            <RadioGroup
              key={field.id}
              name={name}
              legend={field.label}
              hint={hint}
              options={field.options}
              value={form.value(name)}
              error={error}
              required={field.isRequired}
            />
          );
        }

        if (field.fieldType === FormFieldType.MULTISELECT) {
          const chosen = form.list(name);
          return (
            <fieldset key={field.id} className="flex flex-col gap-2">
              <legend className="text-sm font-semibold text-navy-900">
                {field.label}
                {field.isRequired ? (
                  <span className="text-danger-600" aria-hidden="true">
                    {" "}
                    *
                  </span>
                ) : null}
              </legend>
              {hint ? <p className="text-sm text-ink-500">{hint}</p> : null}
              <div className="grid gap-2 sm:grid-cols-2">
                {field.options.map((option) => (
                  <label key={option.value} className="flex items-center gap-3 text-[0.9375rem]">
                    <input
                      type="checkbox"
                      name={name}
                      value={option.value}
                      defaultChecked={chosen.includes(option.value)}
                      className="size-4 accent-navy-800"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              {error ? <p className="text-sm font-medium text-danger-600">{error}</p> : null}
            </fieldset>
          );
        }

        return (
          <Field
            key={field.id}
            id={id}
            label={field.label}
            hint={hint}
            error={error}
            required={field.isRequired}
          >
            {(props) => {
              if (field.fieldType === FormFieldType.SELECT) {
                return (
                  <Select {...props} name={name} defaultValue={form.value(name)}>
                    <option value="">Choose…</option>
                    {field.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                );
              }
              if (field.fieldType === FormFieldType.TEXTAREA) {
                return <Textarea {...props} name={name} rows={4} defaultValue={form.value(name)} />;
              }
              return (
                <Input
                  {...props}
                  name={name}
                  type={inputType(field.fieldType)}
                  inputMode={field.fieldType === FormFieldType.NUMBER ? "numeric" : undefined}
                  defaultValue={form.value(name)}
                />
              );
            }}
          </Field>
        );
      })}
    </>
  );
}

function inputType(type: FormFieldType): string {
  switch (type) {
    case FormFieldType.DATE:
      return "date";
    case FormFieldType.EMAIL:
      return "email";
    case FormFieldType.PHONE:
      return "tel";
    case FormFieldType.NUMBER:
      return "number";
    default:
      return "text";
  }
}
