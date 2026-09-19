"use client";

import { useId } from "react";

import { ContentStatus, StudyLevel } from "@/generated/prisma/enums";
import { LEVEL_LABELS } from "@/lib/application-schemas";
import type { ImageChoice } from "@/lib/media-library";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Picker } from "@/components/ui/picker";

import {
  BodyField,
  Check,
  FormMessage,
  ImageField,
  SaveBar,
  Section,
  StatusFields,
  TitleSlugFields,
  useContentForm,
  type BoundAction,
  type Values,
} from "@/components/content/fields";

/** Editors for the school's own structure: programmes, departments, subjects and staff. */

export type StaffChoice = { id: string; name: string; position: string };
export type DepartmentChoice = { id: string; name: string };

const LEVEL_OPTIONS = [
  { value: StudyLevel.BOTH, label: "O- and A-level" },
  { value: StudyLevel.O_LEVEL, label: LEVEL_LABELS.O_LEVEL },
  { value: StudyLevel.A_LEVEL, label: LEVEL_LABELS.A_LEVEL },
];

function StaffPicker({ form, name, label, hint, staff }: { form: ReturnType<typeof useContentForm>; name: string; label: string; hint?: string; staff: StaffChoice[] }) {
  return (
    <Field id={name} label={label} hint={hint} error={form.error(name)}>
      {(props) => (
        <Picker
          {...props}
          name={name}
          defaultValue={form.text(name)}
          emptyLabel="Nobody yet"
          options={staff.map((person) => ({ value: person.id, label: person.name, description: person.position }))}
        />
      )}
    </Field>
  );
}

export function ProgramForm({ action, values, choices, isNew }: { action: BoundAction; values: Values; choices: ImageChoice[]; isNew: boolean }) {
  const form = useContentForm(action, values);
  return (
    <form action={form.formAction} className="flex flex-col gap-6" noValidate>
      <FormMessage state={form.state} />
      <Section title="Programme" hint="A course of study, for example Lower Secondary or A-level Sciences.">
        <TitleSlugFields form={form} prefix="/academics/programmes/" />
        <div className="grid gap-5 md:grid-cols-2">
          <Field id="level" label="Level" error={form.error("level")} required>
            {(props) => <Picker {...props} name="level" defaultValue={form.text("level") || StudyLevel.BOTH} options={LEVEL_OPTIONS} />}
          </Field>
          <ImageField form={form} name="imageId" label="Photograph" choices={choices} />
        </div>
        <Field id="summary" label="Summary" hint="Optional. One or two sentences for the programme card." error={form.error("summary")}>
          {(props) => <Textarea {...props} name="summary" rows={2} defaultValue={form.text("summary")} required={false} />}
        </Field>
        <BodyField form={form} label="Details" images={choices} />
      </Section>
      <Section title="Showing">
        <StatusFields form={form} withDate={false} />
      </Section>
      <SaveBar isNew={isNew} backHref="/academics" noun="programme" />
    </form>
  );
}

export function DepartmentForm({ action, values, choices, staff, isNew }: { action: BoundAction; values: Values; choices: ImageChoice[]; staff: StaffChoice[]; isNew: boolean }) {
  const form = useContentForm(action, values);
  return (
    <form action={form.formAction} className="flex flex-col gap-6" noValidate>
      <FormMessage state={form.state} />
      <Section title="Department">
        <TitleSlugFields form={form} prefix="/academics/departments/" titleLabel="Name" />
        <div className="grid gap-5 md:grid-cols-2">
          <StaffPicker form={form} name="headId" label="Head of department" hint="Optional. From the staff list." staff={staff} />
          <ImageField form={form} name="imageId" label="Photograph" choices={choices} />
        </div>
        <Field id="description" label="Summary" hint="Optional. One or two sentences." error={form.error("description")}>
          {(props) => <Textarea {...props} name="description" rows={2} defaultValue={form.text("description")} required={false} />}
        </Field>
        <BodyField form={form} label="Details" images={choices} />
      </Section>
      <Section title="Showing">
        <StatusFields form={form} withDate={false} />
      </Section>
      <SaveBar isNew={isNew} backHref="/academics" noun="department" />
    </form>
  );
}

export function SubjectForm({ action, values, departments, staff, submitLabel }: { action: BoundAction; values: Values; departments: DepartmentChoice[]; staff: StaffChoice[]; submitLabel: string }) {
  const form = useContentForm(action, values);
  // Several of these forms share a page (one per subject row), so the field
  // ids carry a per-instance suffix.
  const instance = useId();
  const id = (name: string) => `${name}-${instance}`;
  return (
    <form action={form.formAction} className="flex flex-col gap-4" noValidate>
      <FormMessage state={form.state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id("name")} label="Subject" error={form.error("name")} required>
          {(props) => <Input {...props} name="name" defaultValue={form.text("name")} />}
        </Field>
        <Field id={id("level")} label="Taught at" error={form.error("level")} required>
          {(props) => <Picker {...props} name="level" defaultValue={form.text("level") || StudyLevel.BOTH} options={LEVEL_OPTIONS} />}
        </Field>
        <Field id={id("departmentId")} label="Department" error={form.error("departmentId")}>
          {(props) => <Picker {...props} name="departmentId" defaultValue={form.text("departmentId")} emptyLabel="No department" options={departments.map((d) => ({ value: d.id, label: d.name }))} />}
        </Field>
        <StaffPicker form={form} name="teacherId" label="Lead teacher" staff={staff} />
      </div>
      <Field id={id("description")} label="Description" hint="Optional." error={form.error("description")}>
        {(props) => <Textarea {...props} name="description" rows={2} defaultValue={form.text("description")} required={false} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id("status")} label="Showing" error={form.error("status")} required>
          {(props) => (
            <Picker
              {...props}
              name="status"
              defaultValue={form.text("status") || ContentStatus.PUBLISHED}
              options={[
                { value: ContentStatus.PUBLISHED, label: "Published" },
                { value: ContentStatus.DRAFT, label: "Draft — not shown" },
              ]}
            />
          )}
        </Field>
        <div className="flex items-end pb-2.5">
          <Check form={form} name="isCore" label="Core subject" hint="Compulsory rather than an option." />
        </div>
      </div>
      <div>
        <button type="submit" className="rounded-full bg-navy-700 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-900">{submitLabel}</button>
      </div>
    </form>
  );
}

export function StaffForm({ action, values, choices, isNew }: { action: BoundAction; values: Values; choices: ImageChoice[]; isNew: boolean }) {
  const form = useContentForm(action, values);
  return (
    <form action={form.formAction} className="flex flex-col gap-6" noValidate>
      <FormMessage state={form.state} />
      <Section title="Person">
        <div className="grid gap-5 md:grid-cols-2">
          <Field id="name" label="Name" hint="As it should appear on the website, with any title." error={form.error("name")} required>
            {(props) => <Input {...props} name="name" defaultValue={form.text("name")} />}
          </Field>
          <Field id="position" label="Position" hint="For example Head Teacher or Teacher of Chemistry." error={form.error("position")} required>
            {(props) => <Input {...props} name="position" defaultValue={form.text("position")} />}
          </Field>
          <Field id="department" label="Department" hint="Optional. Free text; used for grouping." error={form.error("department")}>
            {(props) => <Input {...props} name="department" defaultValue={form.text("department")} required={false} />}
          </Field>
          <ImageField form={form} name="photoId" label="Photograph" hint="A portrait works best. From the media library." choices={choices} />
        </div>
        <Field id="bio" label="About" hint="Optional. A short paragraph, shown for the leadership team." error={form.error("bio")}>
          {(props) => <Textarea {...props} name="bio" rows={4} defaultValue={form.text("bio")} required={false} />}
        </Field>
      </Section>
      <Section title="Contact" hint="Optional. Only shown where the website lists contact details.">
        <div className="grid gap-5 md:grid-cols-2">
          <Field id="email" label="Email" error={form.error("email")}>
            {(props) => <Input {...props} name="email" type="email" defaultValue={form.text("email")} required={false} />}
          </Field>
          <Field id="phone" label="Telephone" error={form.error("phone")}>
            {(props) => <Input {...props} name="phone" type="tel" defaultValue={form.text("phone")} required={false} />}
          </Field>
        </div>
      </Section>
      <Section title="Showing">
        <Check form={form} name="isVisible" label="Shown on the website" />
        <Check form={form} name="isLeadership" label="Part of the leadership team" hint="Listed first, with photograph and biography, on the leadership page." />
      </Section>
      <SaveBar isNew={isNew} backHref="/staff" noun="profile" />
    </form>
  );
}
