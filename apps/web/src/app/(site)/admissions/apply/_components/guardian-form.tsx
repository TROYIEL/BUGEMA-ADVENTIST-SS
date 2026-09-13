"use client";

import { RELATIONSHIP_OPTIONS, type FormFieldDefinition } from "@bass/core/application-schemas";
import { Field, Input, Select, Textarea } from "@bass/ui/field";

import type { StepFormState } from "../actions";
import {
  DynamicFields,
  Fieldset,
  FormFooter,
  FormMessage,
  useStepForm,
  type FormValues,
} from "./form-parts";

export function GuardianForm({
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

      <Fieldset
        legend="Parent or guardian"
        hint="The person the school should speak to about this application."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="guardianName" label="Full name" error={form.error("guardianName")} required>
            {(props) => (
              <Input
                {...props}
                name="guardianName"
                autoComplete="name"
                defaultValue={form.value("guardianName")}
              />
            )}
          </Field>
          <Field
            id="guardianRelationship"
            label="Relationship to the applicant"
            error={form.error("guardianRelationship")}
            required
          >
            {(props) => (
              <Select
                {...props}
                name="guardianRelationship"
                defaultValue={form.value("guardianRelationship")}
              >
                <option value="">Choose…</option>
                {RELATIONSHIP_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <Field
          id="guardianOccupation"
          label="Occupation"
          hint="Optional"
          error={form.error("guardianOccupation")}
        >
          {(props) => (
            <Input
              {...props}
              name="guardianOccupation"
              autoComplete="organization-title"
              defaultValue={form.value("guardianOccupation")}
              required={false}
              className="sm:max-w-[calc(50%-0.625rem)]"
            />
          )}
        </Field>
      </Fieldset>

      <Fieldset
        legend="How to reach you"
        hint="We will use these to contact you about the application. An email address lets us send you the reference number and a link to check progress."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="guardianPhone"
            label="Telephone"
            error={form.error("guardianPhone")}
            required
          >
            {(props) => (
              <Input
                {...props}
                name="guardianPhone"
                type="tel"
                autoComplete="tel"
                defaultValue={form.value("guardianPhone")}
              />
            )}
          </Field>
          <Field
            id="guardianAltPhone"
            label="Another telephone"
            hint="Optional"
            error={form.error("guardianAltPhone")}
          >
            {(props) => (
              <Input
                {...props}
                name="guardianAltPhone"
                type="tel"
                autoComplete="off"
                defaultValue={form.value("guardianAltPhone")}
                required={false}
              />
            )}
          </Field>
        </div>

        <Field
          id="guardianEmail"
          label="Email address"
          hint="Optional, but strongly recommended."
          error={form.error("guardianEmail")}
        >
          {(props) => (
            <Input
              {...props}
              name="guardianEmail"
              type="email"
              autoComplete="email"
              defaultValue={form.value("guardianEmail")}
              required={false}
              className="sm:max-w-[calc(50%-0.625rem)]"
            />
          )}
        </Field>

        <Field
          id="guardianAddress"
          label="Postal or physical address"
          hint="Optional"
          error={form.error("guardianAddress")}
        >
          {(props) => (
            <Textarea
              {...props}
              name="guardianAddress"
              rows={3}
              defaultValue={form.value("guardianAddress")}
              required={false}
            />
          )}
        </Field>
      </Fieldset>

      {fields.length > 0 ? (
        <Fieldset legend="More about the family">
          <DynamicFields fields={fields} form={form} />
        </Fieldset>
      ) : null}

      <FormFooter backHref={backHref} />
    </form>
  );
}
