"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { ApplicationStep, ContentStatus, FormFieldType, StudyLevel } from "@bass/db/enums";
import {
  DOCUMENT_FORMATS,
  FIELD_TYPE_LABELS,
  STEP_LABELS,
  keyFromLabel,
} from "@bass/core/admissions-config-shared";
import { LEVEL_LABELS } from "@bass/core/application-schemas";
import { Alert } from "@bass/ui/alert";
import { Button } from "@bass/ui/button";
import { Field, Input, Textarea } from "@bass/ui/field";
import { Picker } from "@bass/ui/picker";

import type { ConfigState } from "@/app/(dashboard)/requirements/actions";

/**
 * The editors for admissions configuration. Each is one small form bound to
 * its Server Action, used both to add a row (no id) and to edit one (in the
 * row's own fold-out). Values are echoed back on a rejected save because
 * React resets a form after any action.
 */

type Values = Record<string, string | boolean | string[]>;
type BoundAction = (previous: ConfigState, formData: FormData) => Promise<ConfigState>;

const INITIAL: ConfigState = { status: "idle" };

function useConfigForm(action: BoundAction, saved: Values) {
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const values = state.values ?? saved;
  return {
    state,
    formAction,
    pending,
    text: (name: string) => (typeof values[name] === "string" ? (values[name] as string) : ""),
    on: (name: string) => values[name] === true,
    list: (name: string) => (Array.isArray(values[name]) ? (values[name] as string[]) : []),
    error: (name: string) => state.fieldErrors?.[name],
  };
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

function Message({ state }: { state: ConfigState }) {
  if (state.status === "error") {
    return <Alert tone="danger">{state.message ?? "Please check the highlighted fields."}</Alert>;
  }
  return null;
}

function Check({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-start gap-3 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 size-4 accent-navy-800" />
      <span>
        <span className="font-semibold text-navy-900">{label}</span>
        {hint ? <span className="block text-ink-600">{hint}</span> : null}
      </span>
    </label>
  );
}

const LEVEL_OPTIONS = Object.values(StudyLevel).map((level) => ({ value: level, label: LEVEL_LABELS[level] }));

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------

export function ClassForm({ action, values, submitLabel }: { action: BoundAction; values: Values; submitLabel: string }) {
  const form = useConfigForm(action, values);
  return (
    <form action={form.formAction} className="flex flex-col gap-4" noValidate>
      <Message state={form.state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`class-name-${submitLabel}`} label="Class" error={form.error("name")} required>
          {(props) => <Input {...props} name="name" placeholder="Senior 1" defaultValue={form.text("name")} />}
        </Field>
        <Field id={`class-level-${submitLabel}`} label="Level" error={form.error("level")} required>
          {(props) => <Picker {...props} name="level" defaultValue={form.text("level") || StudyLevel.O_LEVEL} options={LEVEL_OPTIONS.filter((o) => o.value !== StudyLevel.BOTH)} />}
        </Field>
      </div>
      <Check name="isActive" label="Offered on the form" defaultChecked={form.on("isActive")} />
      <div><Submit label={submitLabel} /></div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Document types
// ---------------------------------------------------------------------------

export function DocumentTypeForm({ action, values, submitLabel }: { action: BoundAction; values: Values; submitLabel: string }) {
  const form = useConfigForm(action, values);
  const accepted = form.list("acceptedMimeTypes");
  return (
    <form action={form.formAction} className="flex flex-col gap-4" noValidate>
      <Message state={form.state} />
      <Field id={`doc-name-${submitLabel}`} label="Document" error={form.error("name")} required>
        {(props) => <Input {...props} name="name" placeholder="Birth certificate" defaultValue={form.text("name")} />}
      </Field>
      <Field id={`doc-desc-${submitLabel}`} label="Guidance for the applicant" hint="Optional. What exactly to upload." error={form.error("description")}>
        {(props) => <Textarea {...props} name="description" rows={2} defaultValue={form.text("description")} required={false} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`doc-level-${submitLabel}`} label="Asked of" error={form.error("level")} required>
          {(props) => <Picker {...props} name="level" defaultValue={form.text("level") || StudyLevel.BOTH} options={LEVEL_OPTIONS} />}
        </Field>
        <Field id={`doc-size-${submitLabel}`} label="Largest file, MB" error={form.error("maxSizeMb")} required>
          {(props) => <Input {...props} name="maxSizeMb" inputMode="decimal" defaultValue={form.text("maxSizeMb") || "5"} />}
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold text-navy-900">Accepted formats</legend>
        <div className="flex flex-wrap gap-4">
          {DOCUMENT_FORMATS.map((format) => (
            <label key={format.value} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="acceptedMimeTypes" value={format.value} defaultChecked={accepted.includes(format.value)} className="size-4 accent-navy-800" />
              {format.label}
            </label>
          ))}
        </div>
        {form.error("acceptedMimeTypes") ? <p className="text-sm font-medium text-danger-600">{form.error("acceptedMimeTypes")}</p> : null}
      </fieldset>
      <Check name="isRequired" label="Required" hint="An application cannot be submitted without it." defaultChecked={form.on("isRequired")} />
      <Check name="isActive" label="Asked for on the form" defaultChecked={form.on("isActive")} />
      <div><Submit label={submitLabel} /></div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Entry requirements
// ---------------------------------------------------------------------------

export function RequirementForm({ action, values, submitLabel }: { action: BoundAction; values: Values; submitLabel: string }) {
  const form = useConfigForm(action, values);
  return (
    <form action={form.formAction} className="flex flex-col gap-4" noValidate>
      <Message state={form.state} />
      <Field id={`req-title-${submitLabel}`} label="Requirement" error={form.error("title")} required>
        {(props) => <Input {...props} name="title" defaultValue={form.text("title")} />}
      </Field>
      <Field id={`req-desc-${submitLabel}`} label="Details" hint="Optional." error={form.error("description")}>
        {(props) => <Textarea {...props} name="description" rows={3} defaultValue={form.text("description")} required={false} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`req-level-${submitLabel}`} label="Applies to" error={form.error("level")} required>
          {(props) => <Picker {...props} name="level" defaultValue={form.text("level") || StudyLevel.BOTH} options={LEVEL_OPTIONS} />}
        </Field>
        <Field id={`req-status-${submitLabel}`} label="Showing" error={form.error("status")} required>
          {(props) => (
            <Picker
              {...props}
              name="status"
              defaultValue={form.text("status") || ContentStatus.DRAFT}
              options={[
                { value: ContentStatus.PUBLISHED, label: "Published on the website" },
                { value: ContentStatus.DRAFT, label: "Draft — not shown" },
              ]}
            />
          )}
        </Field>
      </div>
      <div><Submit label={submitLabel} /></div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Extra questions
// ---------------------------------------------------------------------------

const STEP_OPTIONS = [
  ApplicationStep.APPLICANT,
  ApplicationStep.GUARDIAN,
  ApplicationStep.ACADEMIC,
  ApplicationStep.ADDITIONAL,
].map((step) => ({ value: step, label: STEP_LABELS[step] }));

const TYPE_OPTIONS = Object.values(FormFieldType).map((type) => ({ value: type, label: FIELD_TYPE_LABELS[type] }));

const NEEDS_OPTIONS: string[] = [FormFieldType.SELECT, FormFieldType.RADIO, FormFieldType.MULTISELECT];

export function FormFieldForm({
  action,
  values,
  submitLabel,
  isNew,
}: {
  action: BoundAction;
  values: Values;
  submitLabel: string;
  isNew: boolean;
}) {
  const form = useConfigForm(action, values);
  const [fieldType, setFieldType] = useState(form.text("fieldType") || FormFieldType.TEXT);
  const [label, setLabel] = useState(form.text("label"));
  const [keyTouched, setKeyTouched] = useState(Boolean(form.text("key")));

  return (
    <form action={form.formAction} className="flex flex-col gap-4" noValidate>
      <Message state={form.state} />
      <Field id={`field-label-${submitLabel}`} label="Question" error={form.error("label")} required>
        {(props) => (
          <Input
            {...props}
            name="label"
            placeholder="Which church does the family attend?"
            defaultValue={form.text("label")}
            onChange={(event) => setLabel(event.target.value)}
          />
        )}
      </Field>
      <Field id={`field-help-${submitLabel}`} label="Help text" hint="Optional. Shown under the question." error={form.error("helpText")}>
        {(props) => <Input {...props} name="helpText" defaultValue={form.text("helpText")} required={false} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`field-step-${submitLabel}`} label="Appears on" error={form.error("step")} required>
          {(props) => <Picker {...props} name="step" defaultValue={form.text("step") || ApplicationStep.ADDITIONAL} options={STEP_OPTIONS} />}
        </Field>
        <Field id={`field-type-${submitLabel}`} label="Answer type" error={form.error("fieldType")} required>
          {(props) => <Picker {...props} name="fieldType" value={fieldType} onChange={setFieldType} options={TYPE_OPTIONS} />}
        </Field>
      </div>
      {NEEDS_OPTIONS.includes(fieldType) ? (
        <Field
          id={`field-options-${submitLabel}`}
          label="Options"
          hint='One per line. Write "value | Label" to store a short value behind a longer label.'
          error={form.error("optionsText")}
          required
        >
          {(props) => <Textarea {...props} name="optionsText" rows={4} defaultValue={form.text("optionsText")} />}
        </Field>
      ) : null}
      <Field
        id={`field-key-${submitLabel}`}
        label="Key"
        hint={isNew ? "How answers are filed. Made from the question; change it only if you must." : "Fixed once answers exist."}
        error={form.error("key")}
      >
        {(props) => (
          <Input
            {...props}
            name="key"
            value={keyTouched ? undefined : keyFromLabel(label)}
            defaultValue={keyTouched ? form.text("key") : undefined}
            onChange={() => setKeyTouched(true)}
            readOnly={!isNew}
            required={false}
            className="font-mono text-sm"
          />
        )}
      </Field>
      <Check name="isRequired" label="An answer is required" defaultChecked={form.on("isRequired")} />
      <Check name="isActive" label="Asked on the form" defaultChecked={form.on("isActive")} />
      <div><Submit label={submitLabel} /></div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Academic years
// ---------------------------------------------------------------------------

export function AcademicYearForm({ action, values, submitLabel }: { action: BoundAction; values: Values; submitLabel: string }) {
  const form = useConfigForm(action, values);
  return (
    <form action={form.formAction} className="flex flex-col gap-4" noValidate>
      <Message state={form.state} />
      <Field id={`year-name-${submitLabel}`} label="Year" hint='For example "2027" or "2027/2028".' error={form.error("name")} required>
        {(props) => <Input {...props} name="name" defaultValue={form.text("name")} className="sm:max-w-xs" />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`year-start-${submitLabel}`} label="Year starts" hint="Optional." error={form.error("startDate")}>
          {(props) => <Input {...props} name="startDate" type="date" defaultValue={form.text("startDate")} required={false} />}
        </Field>
        <Field id={`year-end-${submitLabel}`} label="Year ends" hint="Optional." error={form.error("endDate")}>
          {(props) => <Input {...props} name="endDate" type="date" defaultValue={form.text("endDate")} required={false} />}
        </Field>
      </div>
      <Check
        name="isAcceptingApplications"
        label="Taking applications"
        hint="Together with the site-wide switch, this opens the online form for this year."
        defaultChecked={form.on("isAcceptingApplications")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`year-open-${submitLabel}`} label="Applications open from" hint="Optional. From the start of that day." error={form.error("applicationOpensAt")}>
          {(props) => <Input {...props} name="applicationOpensAt" type="date" defaultValue={form.text("applicationOpensAt")} required={false} />}
        </Field>
        <Field id={`year-close-${submitLabel}`} label="Applications close on" hint="Optional. Includes the whole of that day." error={form.error("applicationClosesAt")}>
          {(props) => <Input {...props} name="applicationClosesAt" type="date" defaultValue={form.text("applicationClosesAt")} required={false} />}
        </Field>
      </div>
      <div><Submit label={submitLabel} /></div>
    </form>
  );
}
