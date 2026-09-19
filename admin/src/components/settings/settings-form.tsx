"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { ImageChoice } from "@/lib/media-library";
import { SETTINGS_REGISTRY, type SettingDefinition, type SettingGroup, type SettingKey } from "@/lib/settings-registry";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Picker } from "@/components/ui/picker";

import type { FormState } from "@/lib/forms";

/**
 * One form per settings group, its fields generated from the registry: the
 * type decides the control, the description becomes the hint, and a setting
 * the school has not yet supplied is marked so it stands out.
 */

export type SettingValues = Record<string, string | boolean>;

const INITIAL: FormState = { status: "idle" };

export function SettingsGroupForm({
  group,
  title,
  hint,
  keys,
  saved,
  unconfigured,
  choices,
  action,
}: {
  group: SettingGroup;
  title: string;
  hint?: string;
  keys: SettingKey[];
  saved: SettingValues;
  /** Keys the school has not supplied a value for yet. */
  unconfigured: SettingKey[];
  choices: ImageChoice[];
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction] = useActionState(action, INITIAL);
  const values = state.values ?? saved;
  const textOf = (key: string) => (typeof values[key] === "string" ? (values[key] as string) : "");
  const onOf = (key: string) => values[key] === true;
  // Once saved, a field is no longer "awaiting a value" even before the page reloads.
  const awaiting = new Set(state.status === "success" ? [] : unconfigured);

  return (
    <form action={formAction} id={`settings-${group}`} className="scroll-mt-6 rounded-lg border border-line bg-white" noValidate>
      <div className="border-b border-line px-5 py-3">
        <h2 className="text-base font-semibold text-navy-900">{title}</h2>
        {hint ? <p className="mt-0.5 text-sm text-ink-600">{hint}</p> : null}
      </div>
      <div className="flex flex-col gap-5 px-5 py-5">
        {state.status !== "idle" && state.message ? <Alert tone={state.status === "success" ? "success" : "danger"}>{state.message}</Alert> : null}
        {keys.map((key) => (
          <SettingField
            key={key}
            name={key}
            definition={SETTINGS_REGISTRY[key]}
            text={textOf(key)}
            on={onOf(key)}
            awaiting={awaiting.has(key)}
            error={state.fieldErrors?.[key]}
            choices={choices}
          />
        ))}
      </div>
      <div className="border-t border-line px-5 py-4">
        <SaveButton />
      </div>
    </form>
  );
}

function SettingField({
  name,
  definition,
  text,
  on,
  awaiting,
  error,
  choices,
}: {
  name: string;
  definition: SettingDefinition;
  text: string;
  on: boolean;
  awaiting: boolean;
  error?: string;
  choices: ImageChoice[];
}) {
  const label = (
    <>
      {definition.label}
      {awaiting ? (
        <Badge tone="warning" className="ml-2 align-middle">
          Awaiting a value
        </Badge>
      ) : null}
    </>
  );

  if (definition.type === "boolean") {
    return (
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name={name} defaultChecked={on} className="mt-0.5 size-4 accent-navy-800" />
        <span>
          <span className="font-semibold text-navy-900">{definition.label}</span>
          {definition.description ? <span className="block text-ink-600">{definition.description}</span> : null}
        </span>
      </label>
    );
  }

  if (definition.type === "image") {
    return (
      <Field id={name} label={label} hint={definition.description ?? "From the media library. Upload new photographs there first."} error={error}>
        {(props) => (
          <Picker
            {...props}
            name={name}
            defaultValue={text}
            emptyLabel="None"
            options={choices.map((choice) => ({
              value: choice.id,
              label: choice.alt ?? choice.originalName,
              description: choice.alt ? `${choice.originalName} · ${choice.folder}` : choice.folder,
              image: `/media/${choice.storageKey}`,
            }))}
          />
        )}
      </Field>
    );
  }

  if (definition.type === "textarea") {
    return (
      <Field id={name} label={label} hint={definition.description} error={error}>
        {(props) => <Textarea {...props} name={name} rows={3} defaultValue={text} required={false} />}
      </Field>
    );
  }

  return (
    <Field id={name} label={label} hint={definition.description} error={error}>
      {(props) => (
        <Input
          {...props}
          name={name}
          type={definition.type === "email" ? "email" : definition.type === "tel" ? "tel" : definition.type === "url" ? "url" : "text"}
          inputMode={definition.type === "tel" ? "tel" : definition.type === "url" ? "url" : undefined}
          defaultValue={text}
          required={false}
        />
      )}
    </Field>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </Button>
  );
}
