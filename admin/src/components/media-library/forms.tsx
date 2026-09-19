"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Picker } from "@/components/ui/picker";

import type { MediaFormState } from "@/app/(dashboard)/media-library/actions";

const INITIAL: MediaFormState = { status: "idle" };

type BoundAction = (previous: MediaFormState, formData: FormData) => Promise<MediaFormState>;

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} withArrow>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function Message({ state }: { state: MediaFormState }) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <Alert tone={state.status === "success" ? "success" : "danger"}>
      {state.message}
      {state.results && state.results.length > 0 ? (
        <ul className="mt-2 list-disc pl-5">
          {state.results.map((result) => (
            <li key={result.name}>
              <span className="font-medium">{result.name}</span>
              {result.message ? ` — ${result.message}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </Alert>
  );
}

/**
 * A folder is chosen from the ones in use, or typed fresh. Rendered as one
 * control so the form posts `folder` and, when needed, `newFolder`.
 */
function FolderPicker({
  id,
  folders,
  value,
  error,
  newFolderError,
}: {
  id: string;
  folders: { name: string; count: number }[];
  value: string;
  error?: string;
  newFolderError?: string;
}) {
  const [chosen, setChosen] = useState(value);
  return (
    <div className="flex flex-col gap-3">
      <Field id={id} label="Folder" hint="Just a label to find things by; nothing else depends on it." error={error}>
        {(props) => (
          <Picker
            {...props}
            name="folder"
            value={chosen}
            onChange={setChosen}
            options={[
              ...folders.map((folder) => ({
                value: folder.name,
                label: folder.name,
                description: folder.count ? `${folder.count} ${folder.count === 1 ? "photograph" : "photographs"}` : "empty",
              })),
              { value: "__new", label: "New folder…" },
            ]}
          />
        )}
      </Field>
      {chosen === "__new" ? (
        <Field id={`${id}-new`} label="New folder name" hint="Lowercase letters, digits and dashes." error={newFolderError} required>
          {(props) => <Input {...props} name="newFolder" placeholder="sports-day" />}
        </Field>
      ) : null}
    </div>
  );
}

export function UploadForm({
  action,
  folders,
  defaultFolder,
}: {
  action: BoundAction;
  folders: { name: string; count: number }[];
  defaultFolder: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL);
  const values = state.values ?? {};
  const [count, setCount] = useState(0);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <Message state={state} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="files" className="text-sm font-semibold text-navy-900">
          Photographs <span className="text-danger-600" aria-hidden="true">*</span>
        </label>
        <input
          id="files"
          type="file"
          name="files"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(event) => setCount(event.target.files?.length ?? 0)}
          aria-invalid={Boolean(state.fieldErrors?.files)}
          className="block max-w-full text-sm text-ink-700 file:mr-3 file:rounded-full file:border-0 file:bg-navy-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-navy-800 hover:file:bg-navy-100"
        />
        <p className="text-xs text-ink-500">
          JPG, PNG, WebP or GIF, up to 12 MB each. Every photograph is re-saved with
          its camera data stripped and sized for the web.
        </p>
        {state.fieldErrors?.files ? <p className="text-sm font-medium text-danger-600">{state.fieldErrors.files}</p> : null}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <FolderPicker
          id="upload-folder"
          folders={folders}
          value={values.folder ?? defaultFolder}
          error={state.fieldErrors?.folder}
          newFolderError={state.fieldErrors?.newFolder}
        />
        <Field
          id="upload-alt"
          label="Description"
          hint={count > 1 ? "Add descriptions on each photograph's page after uploading." : "What the picture shows, for people who cannot see it."}
          error={state.fieldErrors?.alt}
        >
          {(props) => <Input {...props} name="alt" defaultValue={values.alt ?? ""} disabled={count > 1} required={false} />}
        </Field>
      </div>

      <div>
        <Submit label={count > 1 ? `Upload ${count} photographs` : "Upload"} pendingLabel="Uploading…" />
      </div>
    </form>
  );
}

export function DetailsForm({
  action,
  folders,
  values,
}: {
  action: BoundAction;
  folders: { name: string; count: number }[];
  values: { alt: string; caption: string; folder: string };
}) {
  const [state, formAction] = useActionState(action, INITIAL);
  const current = { ...values, ...(state.values ?? {}) };

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <Message state={state} />
      <Field
        id="alt"
        label="Description"
        hint="Read aloud by screen readers and shown if the picture fails to load. Say what it shows, not that it is a photograph."
        error={state.fieldErrors?.alt}
      >
        {(props) => <Input {...props} name="alt" defaultValue={current.alt} required={false} />}
      </Field>
      <Field id="caption" label="Caption" hint="Optional. Shown under the picture where the website uses captions." error={state.fieldErrors?.caption}>
        {(props) => <Textarea {...props} name="caption" rows={2} defaultValue={current.caption} required={false} />}
      </Field>
      <FolderPicker
        id="folder"
        folders={folders}
        value={current.folder}
        error={state.fieldErrors?.folder}
        newFolderError={state.fieldErrors?.newFolder}
      />
      <div>
        <Submit label="Save" pendingLabel="Saving…" />
      </div>
    </form>
  );
}
