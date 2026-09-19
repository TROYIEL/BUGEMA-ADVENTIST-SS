"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import type { ImageChoice } from "@/lib/media-library";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Picker } from "@/components/ui/picker";

import type { SlideFormState } from "@/app/(dashboard)/hero-slides/actions";
import type { SlideFormValues } from "./helpers";

/**
 * The slide editor. Plain inputs for the words, and four image slots that
 * each offer the library or a fresh upload — the same slots the public hero
 * renders, in the same order.
 */

const INITIAL: SlideFormState = { status: "idle" };

function SaveButton({ isNew }: { isNew: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} withArrow>
      {pending ? "Saving…" : isNew ? "Create slide" : "Save changes"}
    </Button>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
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
 * One image slot. The preview follows whichever is newer: the library
 * choice, or a file just picked for upload.
 */
function ImageSlot({
  slot,
  label,
  hint,
  choices,
  initialId,
  error,
  resetToken,
}: {
  slot: string;
  label: string;
  hint?: string;
  choices: ImageChoice[];
  initialId: string;
  error?: string;
  /** Changes whenever a save is rejected; the file input is reset then, so the preview goes too. */
  resetToken: unknown;
}) {
  const [chosenId, setChosenId] = useState(initialId);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [seenToken, setSeenToken] = useState(resetToken);
  const chosen = choices.find((choice) => choice.id === chosenId) ?? null;

  // The form's file inputs were just reset, so the preview no longer shows a
  // file that will be sent. Adjusted during render, as React recommends,
  // rather than in an effect.
  if (seenToken !== resetToken) {
    setSeenToken(resetToken);
    setUploadPreview(null);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
      <div
        className={cn(
          "relative aspect-[4/3] overflow-hidden rounded-md border border-line bg-surface-sunken",
          error && "border-danger-600",
        )}
      >
        {uploadPreview ? (
          // A local object URL; next/image cannot optimise it and need not.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={uploadPreview} alt="" className="size-full object-cover" />
        ) : chosen ? (
          <Image
            src={`/media/${chosen.storageKey}`}
            alt={chosen.alt ?? ""}
            fill
            sizes="9rem"
            className="object-cover"
          />
        ) : (
          <span className="grid size-full place-items-center text-xs text-ink-500">None</span>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <Field id={`${slot}Id`} label={label} hint={hint} error={error}>
          {(props) => (
            <Picker
              {...props}
              name={`${slot}Id`}
              value={chosenId}
              onChange={(next) => {
                setChosenId(next);
                setUploadPreview(null);
              }}
              emptyLabel="No photograph"
              placeholder="Choose from the library…"
              options={choices.map((choice) => ({
                value: choice.id,
                label: choice.alt ?? choice.originalName,
                description: choice.alt ? `${choice.originalName} · ${choice.folder}` : choice.folder,
                image: `/media/${choice.storageKey}`,
              }))}
            />
          )}
        </Field>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-navy-900">Or upload a new photograph</span>
          <input
            type="file"
            name={`${slot}File`}
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setUploadPreview(file ? URL.createObjectURL(file) : null);
            }}
            className="block max-w-full text-sm text-ink-700 file:mr-3 file:rounded-full file:border-0 file:bg-navy-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-navy-800 hover:file:bg-navy-100"
          />
          <span className="text-xs text-ink-500">
            JPG, PNG or WebP, up to 12 MB. It is added to the media library and used here.
          </span>
        </label>
      </div>
    </div>
  );
}

export function SlideForm({
  action,
  values,
  choices,
  isNew,
}: {
  action: (previous: SlideFormState, formData: FormData) => Promise<SlideFormState>;
  values: SlideFormValues;
  choices: ImageChoice[];
  isNew: boolean;
}) {
  const [state, formAction] = useActionState(action, INITIAL);
  const error = (name: string) => state.fieldErrors?.[name];
  // After a rejected save the inputs have been reset; show what was typed.
  const current = state.values ?? values;

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {state.status === "error" && state.message ? <Alert tone="danger">{state.message}</Alert> : null}

      <Section title="Words" hint="Only the title is required. Leave anything else empty to leave it off the slide.">
        <Field id="title" label="Title" error={error("title")} required>
          {(props) => <Input {...props} name="title" defaultValue={current.title} />}
        </Field>
        <div className="grid gap-5 md:grid-cols-2">
          <Field id="subtitle" label="Small line above the title" hint='For example "Admissions".' error={error("subtitle")}>
            {(props) => <Input {...props} name="subtitle" defaultValue={current.subtitle} required={false} />}
          </Field>
          <Field id="displayText" label="Gold display line" hint="Set large beside the photographs." error={error("displayText")}>
            {(props) => <Input {...props} name="displayText" defaultValue={current.displayText} required={false} />}
          </Field>
        </div>
        <Field id="body" label="Text" hint="A sentence or two. Short lines are set large; longer ones at reading size." error={error("body")}>
          {(props) => <Textarea {...props} name="body" rows={3} defaultValue={current.body} required={false} />}
        </Field>
      </Section>

      <Section title="Buttons" hint="Up to two. Each needs a label and where it goes.">
        <div className="grid gap-5 md:grid-cols-2">
          <Field id="ctaLabel" label="First button" error={error("ctaLabel")}>
            {(props) => <Input {...props} name="ctaLabel" placeholder="Apply for admission" defaultValue={current.ctaLabel} required={false} />}
          </Field>
          <Field id="ctaHref" label="First button link" error={error("ctaHref")}>
            {(props) => <Input {...props} name="ctaHref" placeholder="/admissions/apply" defaultValue={current.ctaHref} required={false} />}
          </Field>
          <Field id="ctaSecondaryLabel" label="Second button" error={error("ctaSecondaryLabel")}>
            {(props) => <Input {...props} name="ctaSecondaryLabel" placeholder="Explore BASS" defaultValue={current.ctaSecondaryLabel} required={false} />}
          </Field>
          <Field id="ctaSecondaryHref" label="Second button link" error={error("ctaSecondaryHref")}>
            {(props) => <Input {...props} name="ctaSecondaryHref" placeholder="/about" defaultValue={current.ctaSecondaryHref} required={false} />}
          </Field>
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="showPhone" defaultChecked={current.showPhone} className="mt-0.5 size-4 accent-navy-800" />
          <span>
            <span className="font-semibold text-navy-900">Lead with the school&rsquo;s telephone number</span>
            <span className="block text-ink-600">
              Shows a &ldquo;Call now&rdquo; button first, using the number in site settings, and
              hides the second button so the stack stays at two.
            </span>
          </span>
        </label>
      </Section>

      <Section title="Photographs" hint="A background behind the words, and up to three prints stacked beside them.">
        <ImageSlot slot="image" label="Background" hint="Held back behind the words; a wide shot works best." choices={choices} initialId={values.imageId} error={error("imageFile")} resetToken={state} />
        <ImageSlot slot="collageOne" label="Print 1 (left, portrait)" choices={choices} initialId={values.collageOneId} error={error("collageOneFile")} resetToken={state} />
        <ImageSlot slot="collageTwo" label="Print 2 (centre, tallest)" choices={choices} initialId={values.collageTwoId} error={error("collageTwoFile")} resetToken={state} />
        <ImageSlot slot="collageThree" label="Print 3 (right, landscape)" choices={choices} initialId={values.collageThreeId} error={error("collageThreeFile")} resetToken={state} />
      </Section>

      <Section title="Showing" hint="Switch a slide off to keep it without showing it, or give it dates.">
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={current.isActive} className="size-4 accent-navy-800" />
          <span className="font-semibold text-navy-900">Show this slide</span>
        </label>
        <div className="grid gap-5 md:grid-cols-2">
          <Field id="publishFrom" label="From" hint="Optional. Kampala time." error={error("publishFrom")}>
            {(props) => <Input {...props} name="publishFrom" type="datetime-local" defaultValue={current.publishFrom} required={false} />}
          </Field>
          <Field id="publishUntil" label="Until" hint="Optional. Kampala time." error={error("publishUntil")}>
            {(props) => <Input {...props} name="publishUntil" type="datetime-local" defaultValue={current.publishUntil} required={false} />}
          </Field>
        </div>
      </Section>

      <div className="flex flex-wrap items-center gap-4">
        <SaveButton isNew={isNew} />
        <Link href="/hero-slides" className="text-sm font-semibold text-navy-800 underline-offset-4 hover:underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
