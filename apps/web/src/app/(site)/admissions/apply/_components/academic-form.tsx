"use client";

import type { FormFieldDefinition } from "@bass/core/application-schemas";
import { Field, Input, Textarea } from "@bass/ui/field";

import type { StepFormState } from "../actions";
import {
  DynamicFields,
  Fieldset,
  FormFooter,
  FormMessage,
  useStepForm,
  type FormValues,
} from "./form-parts";

export function AcademicForm({
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
    <form action={form.formAction} className="flex flex-col gap-10" noValidate>
      <FormMessage state={form.state} />

      <Fieldset legend="Current or most recent school">
        <Field
          id="previousSchool"
          label="Name of school"
          error={form.error("previousSchool")}
          required
        >
          {(props) => (
            <Input
              {...props}
              name="previousSchool"
              autoComplete="off"
              defaultValue={form.value("previousSchool")}
            />
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="previousClass"
            label="Class completed or being completed"
            hint="For example P7, S4 or S6."
            error={form.error("previousClass")}
            required
          >
            {(props) => (
              <Input
                {...props}
                name="previousClass"
                autoComplete="off"
                defaultValue={form.value("previousClass")}
              />
            )}
          </Field>
          <Field
            id="yearCompleted"
            label="Year completed"
            hint="Optional — leave blank if still there."
            error={form.error("yearCompleted")}
          >
            {(props) => (
              <Input
                {...props}
                name="yearCompleted"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                autoComplete="off"
                defaultValue={form.value("yearCompleted")}
                required={false}
              />
            )}
          </Field>
        </div>
      </Fieldset>

      <Fieldset
        legend="Examinations"
        hint="If the applicant has sat PLE or UCE, give the details here. Result slips can be uploaded on the documents step."
      >
        <Field
          id="examIndexNumber"
          label="Examination index number"
          hint="Optional"
          error={form.error("examIndexNumber")}
        >
          {(props) => (
            <Input
              {...props}
              name="examIndexNumber"
              autoComplete="off"
              defaultValue={form.value("examIndexNumber")}
              required={false}
              className="sm:max-w-[calc(50%-0.625rem)]"
            />
          )}
        </Field>
        <Field
          id="examResults"
          label="Results"
          hint="Optional. Aggregate or grades, as they appear on the result slip."
          error={form.error("examResults")}
        >
          {(props) => (
            <Textarea
              {...props}
              name="examResults"
              rows={4}
              defaultValue={form.value("examResults")}
              required={false}
            />
          )}
        </Field>
      </Fieldset>

      {fields.length > 0 ? (
        <Fieldset legend="More about schooling">
          <DynamicFields fields={fields} form={form} />
        </Fieldset>
      ) : null}

      <FormFooter backHref={backHref} />
    </form>
  );
}
