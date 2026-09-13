"use client";

import type { FormFieldDefinition } from "@bass/core/application-schemas";

import type { StepFormState } from "../actions";
import {
  DynamicFields,
  FormFooter,
  FormMessage,
  useStepForm,
  type FormValues,
} from "./form-parts";

/** Nothing but the school's own questions. Only shown when there are some. */
export function AdditionalForm({
  action,
  saved,
  fields,
  backHref,
}: {
  action: (previous: StepFormState, formData: FormData) => Promise<StepFormState>;
  saved: FormValues;
  fields: FormFieldDefinition[];
  backHref: string;
}) {
  const form = useStepForm(action, saved);

  return (
    <form action={form.formAction} className="flex flex-col gap-6" noValidate>
      <FormMessage state={form.state} />
      <DynamicFields fields={fields} form={form} />
      <FormFooter backHref={backHref} />
    </form>
  );
}
