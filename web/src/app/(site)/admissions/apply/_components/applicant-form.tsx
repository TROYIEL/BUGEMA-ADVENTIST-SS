"use client";

import { BoardingPreference, Gender } from "@/generated/prisma/enums";
import {
  BOARDING_LABELS,
  GENDER_LABELS,
  LEVEL_LABELS,
  type FormFieldDefinition,
} from "@/lib/application-schemas";
import type { ClassOption } from "@/lib/applications";
import { Field, Input, Select, Textarea } from "@/components/ui/field";

import type { StepFormState } from "../actions";
import {
  DynamicFields,
  Fieldset,
  FormFooter,
  FormMessage,
  RadioGroup,
  useStepForm,
  type FormValues,
} from "./form-parts";

export function ApplicantForm({
  action,
  saved,
  classes,
  fields,
}: {
  action: (previous: StepFormState, formData: FormData) => Promise<StepFormState>;
  saved: FormValues;
  classes: ClassOption[];
  fields: FormFieldDefinition[];
}) {
  const form = useStepForm(action, saved);

  return (
    <form action={form.formAction} className="flex flex-col gap-10" noValidate>
      <FormMessage state={form.state} />

      <Fieldset legend="Applying for">
        <Field
          id="applicationClassId"
          label="Class"
          error={form.error("applicationClassId")}
          required
        >
          {(props) => (
            <Select
              {...props}
              name="applicationClassId"
              defaultValue={form.value("applicationClassId")}
            >
              <option value="">Choose a class…</option>
              {classes.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name} ({LEVEL_LABELS[entry.level]})
                </option>
              ))}
            </Select>
          )}
        </Field>

        <RadioGroup
          name="boardingPreference"
          legend="Day or boarding"
          options={[
            { value: BoardingPreference.BOARDING, label: BOARDING_LABELS.BOARDING },
            { value: BoardingPreference.DAY, label: BOARDING_LABELS.DAY },
            { value: BoardingPreference.UNDECIDED, label: BOARDING_LABELS.UNDECIDED },
          ]}
          value={form.value("boardingPreference")}
          error={form.error("boardingPreference")}
          required
        />
      </Fieldset>

      <Fieldset
        legend="The applicant"
        hint="Names as they appear on the birth certificate or previous school records."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="firstName" label="First name" error={form.error("firstName")} required>
            {(props) => (
              <Input
                {...props}
                name="firstName"
                autoComplete="off"
                defaultValue={form.value("firstName")}
              />
            )}
          </Field>
          <Field id="middleName" label="Middle name" hint="Optional" error={form.error("middleName")}>
            {(props) => (
              <Input
                {...props}
                name="middleName"
                autoComplete="off"
                defaultValue={form.value("middleName")}
                required={false}
              />
            )}
          </Field>
        </div>

        <Field id="lastName" label="Surname" error={form.error("lastName")} required>
          {(props) => (
            <Input
              {...props}
              name="lastName"
              autoComplete="off"
              defaultValue={form.value("lastName")}
              className="sm:max-w-[calc(50%-0.625rem)]"
            />
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="dateOfBirth" label="Date of birth" error={form.error("dateOfBirth")} required>
            {(props) => (
              <Input
                {...props}
                name="dateOfBirth"
                type="date"
                defaultValue={form.value("dateOfBirth")}
              />
            )}
          </Field>
          <Field id="nationality" label="Nationality" error={form.error("nationality")} required>
            {(props) => (
              <Input
                {...props}
                name="nationality"
                autoComplete="off"
                defaultValue={form.value("nationality")}
              />
            )}
          </Field>
        </div>

        <RadioGroup
          name="gender"
          legend="Gender"
          options={[
            { value: Gender.FEMALE, label: GENDER_LABELS.FEMALE },
            { value: Gender.MALE, label: GENDER_LABELS.MALE },
          ]}
          value={form.value("gender")}
          error={form.error("gender")}
          required
        />
      </Fieldset>

      <Fieldset legend="Home" hint="Where the applicant lives during the holidays.">
        <Field id="homeDistrict" label="District" hint="Optional" error={form.error("homeDistrict")}>
          {(props) => (
            <Input
              {...props}
              name="homeDistrict"
              autoComplete="off"
              defaultValue={form.value("homeDistrict")}
              required={false}
              className="sm:max-w-[calc(50%-0.625rem)]"
            />
          )}
        </Field>
        <Field id="homeAddress" label="Address" hint="Optional" error={form.error("homeAddress")}>
          {(props) => (
            <Textarea
              {...props}
              name="homeAddress"
              rows={3}
              defaultValue={form.value("homeAddress")}
              required={false}
            />
          )}
        </Field>
      </Fieldset>

      {fields.length > 0 ? (
        <Fieldset legend="More about the applicant">
          <DynamicFields fields={fields} form={form} />
        </Fieldset>
      ) : null}

      <FormFooter />
    </form>
  );
}
