"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { ContentStatus } from "@/generated/prisma/enums";
import type { ImageChoice } from "@/lib/media-library";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Picker } from "@/components/ui/picker";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

import type { FormState } from "@/lib/forms";

/**
 * Building blocks shared by every content editor. Each editor is one form
 * bound to its Server Action; these keep the fields consistent between them.
 */

export type Values = Record<string, string | boolean | string[]>;
export type BoundAction = (previous: FormState, formData: FormData) => Promise<FormState>;

const INITIAL: FormState = { status: "idle" };

export function useContentForm(action: BoundAction, saved: Values) {
  const [state, formAction] = useActionState(action, INITIAL);
  const values = state.values ?? saved;
  return {
    state,
    formAction,
    text: (name: string) => (typeof values[name] === "string" ? (values[name] as string) : ""),
    on: (name: string) => values[name] === true,
    error: (name: string) => state.fieldErrors?.[name],
  };
}

/** "Something Like This" -> "something-like-this"; mirrors the server's slugify. */
export function slugFromTitle(title: string, allowSlashes = false): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(allowSlashes ? /[^a-z0-9/]+/g : /[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 120);
}

export function FormMessage({ state }: { state: FormState }) {
  if (state.status === "idle" || !state.message) return null;
  return <Alert tone={state.status === "success" ? "success" : "danger"}>{state.message}</Alert>;
}

export function SaveBar({ isNew, backHref, noun }: { isNew: boolean; backHref: string; noun: string }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap items-center gap-4 border-t border-line pt-5">
      <Button type="submit" size="lg" disabled={pending} withArrow>
        {pending ? "Saving…" : isNew ? `Create ${noun}` : "Save changes"}
      </Button>
      <Link href={backHref as never} className="text-sm font-semibold text-navy-800 underline-offset-4 hover:underline">
        Cancel
      </Link>
    </div>
  );
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-white">
      <div className="border-b border-line px-5 py-3">
        <h2 className="text-base font-semibold text-navy-900">{title}</h2>
        {hint ? <p className="mt-0.5 text-sm text-ink-600">{hint}</p> : null}
      </div>
      <div className="flex flex-col gap-5 px-5 py-5">{children}</div>
    </section>
  );
}

/**
 * Title and address together: the address follows the title until it is
 * edited by hand, and is locked for pages the site's structure depends on.
 */
export function TitleSlugFields({
  form,
  prefix,
  slugLocked = false,
  allowSlashes = false,
  titleLabel = "Title",
}: {
  form: ReturnType<typeof useContentForm>;
  /** Shown before the slug, e.g. "/news/". */
  prefix: string;
  slugLocked?: boolean;
  allowSlashes?: boolean;
  titleLabel?: string;
}) {
  const [title, setTitle] = useState(form.text("title"));
  const [slugTouched, setSlugTouched] = useState(Boolean(form.text("slug")));

  return (
    <>
      <Field id="title" label={titleLabel} error={form.error("title")} required>
        {(props) => (
          <Input {...props} name="title" defaultValue={form.text("title")} onChange={(event) => setTitle(event.target.value)} />
        )}
      </Field>
      <Field
        id="slug"
        label="Address"
        hint={slugLocked ? "Fixed: the website's navigation points here." : "Made from the title. If it is already taken a number is added."}
        error={form.error("slug")}
      >
        {(props) => (
          <div className="flex items-center gap-2">
            <span className="shrink-0 font-mono text-sm text-ink-500">{prefix}</span>
            <Input
              {...props}
              name="slug"
              value={slugTouched ? undefined : slugFromTitle(title, allowSlashes)}
              defaultValue={slugTouched ? form.text("slug") : undefined}
              onChange={() => setSlugTouched(true)}
              readOnly={slugLocked}
              required={false}
              className="font-mono text-sm"
            />
          </div>
        )}
      </Field>
    </>
  );
}

export function StatusFields({
  form,
  withDate = true,
  dateLabel = "Publish on",
  dateHint = "Optional. Leave empty to publish as soon as it is saved; set a future date and time to schedule it.",
}: {
  form: ReturnType<typeof useContentForm>;
  withDate?: boolean;
  dateLabel?: string;
  dateHint?: string;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Field id="status" label="Showing" error={form.error("status")} required>
        {(props) => (
          <Picker
            {...props}
            name="status"
            defaultValue={form.text("status") || ContentStatus.DRAFT}
            options={[
              { value: ContentStatus.PUBLISHED, label: "Published", description: "Visible on the website" },
              { value: ContentStatus.DRAFT, label: "Draft", description: "Kept here, not shown" },
              { value: ContentStatus.ARCHIVED, label: "Archived", description: "Taken down, kept for reference" },
            ]}
          />
        )}
      </Field>
      {withDate ? (
        <Field id="publishedAt" label={dateLabel} hint={dateHint} error={form.error("publishedAt")}>
          {(props) => <Input {...props} name="publishedAt" type="datetime-local" defaultValue={form.text("publishedAt")} required={false} />}
        </Field>
      ) : null}
    </div>
  );
}

export function ImageField({
  form,
  name,
  label,
  hint,
  choices,
}: {
  form: ReturnType<typeof useContentForm>;
  name: string;
  label: string;
  hint?: string;
  choices: ImageChoice[];
}) {
  return (
    <Field id={name} label={label} hint={hint ?? "From the media library. Upload new photographs there first."} error={form.error(name)}>
      {(props) => (
        <Picker
          {...props}
          name={name}
          defaultValue={form.text(name)}
          emptyLabel="No photograph"
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

export function BodyField({
  form,
  name = "body",
  label = "Text",
  hint,
  images = [],
}: {
  form: ReturnType<typeof useContentForm>;
  name?: string;
  label?: string;
  hint?: string;
  /** Media-library images the editor's Image button may insert. */
  images?: ImageChoice[];
}) {
  const editorImages = images.map((choice) => ({
    src: `/media/${choice.storageKey}`,
    alt: choice.alt ?? "",
    label: choice.alt ?? choice.originalName,
  }));

  return (
    <Field id={name} label={label} hint={hint} error={form.error(name)}>
      {(props) => (
        <RichTextEditor {...props} name={name} defaultValue={form.text(name)} images={editorImages} />
      )}
    </Field>
  );
}

export function SeoFields({ form, withIndexing = false }: { form: ReturnType<typeof useContentForm>; withIndexing?: boolean }) {
  return (
    <>
      <Field id="seoTitle" label="Search result title" hint="Optional. Replaces the title in search engines and browser tabs." error={form.error("seoTitle")}>
        {(props) => <Input {...props} name="seoTitle" defaultValue={form.text("seoTitle")} required={false} />}
      </Field>
      <Field id="seoDescription" label="Search result description" hint="Optional. One or two sentences, up to 160 characters." error={form.error("seoDescription")}>
        {(props) => <Textarea {...props} name="seoDescription" rows={2} defaultValue={form.text("seoDescription")} required={false} />}
      </Field>
      {withIndexing ? (
        <>
          <Field id="canonicalUrl" label="Canonical address" hint="Optional. Only if this page copies one that lives elsewhere." error={form.error("canonicalUrl")}>
            {(props) => <Input {...props} name="canonicalUrl" defaultValue={form.text("canonicalUrl")} required={false} />}
          </Field>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="noindex" defaultChecked={form.on("noindex")} className="mt-0.5 size-4 accent-navy-800" />
            <span>
              <span className="font-semibold text-navy-900">Keep out of search engines</span>
              <span className="block text-ink-600">The page stays reachable by its address.</span>
            </span>
          </label>
        </>
      ) : null}
    </>
  );
}

export function Check({ name, label, hint, form }: { name: string; label: string; hint?: string; form: ReturnType<typeof useContentForm> }) {
  return (
    <label className="flex items-start gap-3 text-sm">
      <input type="checkbox" name={name} defaultChecked={form.on(name)} className="mt-0.5 size-4 accent-navy-800" />
      <span>
        <span className="font-semibold text-navy-900">{label}</span>
        {hint ? <span className="block text-ink-600">{hint}</span> : null}
      </span>
    </label>
  );
}
