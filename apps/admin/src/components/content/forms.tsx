"use client";

import { AnnouncementPlacement } from "@bass/db/enums";
import { PLACEMENT_LABELS } from "@bass/core/content-shared";
import type { ImageChoice } from "@bass/core/media-library";
import { Field, Input, Textarea } from "@bass/ui/field";
import { Picker } from "@bass/ui/picker";

import {
  BodyField,
  Check,
  FormMessage,
  ImageField,
  SaveBar,
  Section,
  SeoFields,
  StatusFields,
  TitleSlugFields,
  useContentForm,
  type BoundAction,
  type Values,
} from "./fields";

/** The editors themselves, one per kind of content. */

export function PageForm({ action, values, choices, isNew, isSystem }: { action: BoundAction; values: Values; choices: ImageChoice[]; isNew: boolean; isSystem: boolean }) {
  const form = useContentForm(action, values);
  return (
    <form action={form.formAction} className="flex flex-col gap-6" noValidate>
      <FormMessage state={form.state} />
      <Section title="Page">
        <TitleSlugFields form={form} prefix="/" slugLocked={isSystem} allowSlashes />
        <Field id="subtitle" label="Introduction" hint="Optional. A sentence under the title, in the page's masthead." error={form.error("subtitle")}>
          {(props) => <Textarea {...props} name="subtitle" rows={2} defaultValue={form.text("subtitle")} required={false} />}
        </Field>
        <BodyField form={form} />
      </Section>
      <Section title="Showing">
        <StatusFields form={form} />
      </Section>
      <Section title="Search engines and sharing" hint="Optional. Sensible values are made from the page when these are empty.">
        <SeoFields form={form} withIndexing />
        <ImageField form={form} name="ogImageId" label="Sharing image" hint="Shown when the page is shared on social media or in chat apps." choices={choices} />
      </Section>
      <SaveBar isNew={isNew} backHref="/pages" noun="page" />
    </form>
  );
}

export function NewsForm({ action, values, choices, categories, isNew }: { action: BoundAction; values: Values; choices: ImageChoice[]; categories: string[]; isNew: boolean }) {
  const form = useContentForm(action, values);
  return (
    <form action={form.formAction} className="flex flex-col gap-6" noValidate>
      <FormMessage state={form.state} />
      <Section title="Story">
        <TitleSlugFields form={form} prefix="/news/" titleLabel="Headline" />
        <Field id="excerpt" label="Summary" hint="Optional. One or two sentences shown in lists and at the top of the story." error={form.error("excerpt")}>
          {(props) => <Textarea {...props} name="excerpt" rows={2} defaultValue={form.text("excerpt")} required={false} />}
        </Field>
        <BodyField form={form} />
      </Section>
      <Section title="Details">
        <div className="grid gap-5 md:grid-cols-2">
          <Field id="category" label="Category" hint="Optional. Existing categories are suggested as you type." error={form.error("category")}>
            {(props) => (
              <>
                <Input {...props} name="category" list="news-categories" defaultValue={form.text("category")} required={false} />
                <datalist id="news-categories">
                  {categories.map((category) => <option key={category} value={category} />)}
                </datalist>
              </>
            )}
          </Field>
          <ImageField form={form} name="featuredImageId" label="Photograph" choices={choices} />
        </div>
        <Check form={form} name="isFeatured" label="Featured" hint="Listed first and given the larger card." />
      </Section>
      <Section title="Showing">
        <StatusFields form={form} />
      </Section>
      <Section title="Search engines" hint="Optional.">
        <SeoFields form={form} />
      </Section>
      <SaveBar isNew={isNew} backHref="/news" noun="story" />
    </form>
  );
}

export function EventForm({ action, values, choices, isNew }: { action: BoundAction; values: Values; choices: ImageChoice[]; isNew: boolean }) {
  const form = useContentForm(action, values);
  return (
    <form action={form.formAction} className="flex flex-col gap-6" noValidate>
      <FormMessage state={form.state} />
      <Section title="Event">
        <TitleSlugFields form={form} prefix="/events/" />
        <Field id="description" label="Summary" hint="Optional. One or two sentences shown in lists." error={form.error("description")}>
          {(props) => <Textarea {...props} name="description" rows={2} defaultValue={form.text("description")} required={false} />}
        </Field>
        <BodyField form={form} label="Details" />
      </Section>
      <Section title="When and where">
        <div className="grid gap-5 md:grid-cols-2">
          <Field id="startDate" label="Starts on" error={form.error("startDate")} required>
            {(props) => <Input {...props} name="startDate" type="date" defaultValue={form.text("startDate")} />}
          </Field>
          <Field id="endDate" label="Ends on" hint="Optional, for events over several days." error={form.error("endDate")}>
            {(props) => <Input {...props} name="endDate" type="date" defaultValue={form.text("endDate")} required={false} />}
          </Field>
          <Field id="startTime" label="Starts at" hint="Optional, for example 09:00." error={form.error("startTime")}>
            {(props) => <Input {...props} name="startTime" type="time" defaultValue={form.text("startTime")} required={false} />}
          </Field>
          <Field id="endTime" label="Ends at" hint="Optional." error={form.error("endTime")}>
            {(props) => <Input {...props} name="endTime" type="time" defaultValue={form.text("endTime")} required={false} />}
          </Field>
        </div>
        <Field id="location" label="Venue" hint="Optional." error={form.error("location")}>
          {(props) => <Input {...props} name="location" defaultValue={form.text("location")} required={false} />}
        </Field>
        <Field id="registrationUrl" label="Registration link" hint="Optional. Where people sign up, if they need to." error={form.error("registrationUrl")}>
          {(props) => <Input {...props} name="registrationUrl" type="url" defaultValue={form.text("registrationUrl")} required={false} />}
        </Field>
        <ImageField form={form} name="imageId" label="Photograph" choices={choices} />
        <Check form={form} name="isFeatured" label="Featured" hint="Given prominence on the events page." />
      </Section>
      <Section title="Showing">
        <StatusFields form={form} withDate={false} />
      </Section>
      <Section title="Search engines" hint="Optional.">
        <SeoFields form={form} />
      </Section>
      <SaveBar isNew={isNew} backHref="/events" noun="event" />
    </form>
  );
}

export function AlbumForm({ action, values, choices, isNew }: { action: BoundAction; values: Values; choices: ImageChoice[]; isNew: boolean }) {
  const form = useContentForm(action, values);
  return (
    <form action={form.formAction} className="flex flex-col gap-6" noValidate>
      <FormMessage state={form.state} />
      <Section title="Album">
        <TitleSlugFields form={form} prefix="/gallery/" />
        <Field id="description" label="Description" hint="Optional." error={form.error("description")}>
          {(props) => <Textarea {...props} name="description" rows={2} defaultValue={form.text("description")} required={false} />}
        </Field>
        <div className="grid gap-5 md:grid-cols-2">
          <Field id="category" label="Category" hint="Optional, for example Sport or Worship." error={form.error("category")}>
            {(props) => <Input {...props} name="category" defaultValue={form.text("category")} required={false} />}
          </Field>
          <ImageField form={form} name="coverImageId" label="Cover" hint="Optional. Otherwise the first photograph in the album." choices={choices} />
        </div>
      </Section>
      <Section title="Showing">
        <StatusFields form={form} withDate={false} />
      </Section>
      <SaveBar isNew={isNew} backHref="/gallery" noun="album" />
    </form>
  );
}

export function AnnouncementForm({ action, values, submitLabel }: { action: BoundAction; values: Values; submitLabel: string }) {
  const form = useContentForm(action, values);
  const id = (name: string) => `${name}-${submitLabel.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <form action={form.formAction} className="flex flex-col gap-4" noValidate>
      <FormMessage state={form.state} />
      <Field id={id("title")} label="Announcement" hint="Short: it sits in the bar above the header." error={form.error("title")} required>
        {(props) => <Input {...props} name="title" defaultValue={form.text("title")} />}
      </Field>
      <Field id={id("body")} label="A little more" hint="Optional. One sentence after the announcement." error={form.error("body")}>
        {(props) => <Input {...props} name="body" defaultValue={form.text("body")} required={false} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id("linkLabel")} label="Link text" hint='Optional, for example "Apply now".' error={form.error("linkLabel")}>
          {(props) => <Input {...props} name="linkLabel" defaultValue={form.text("linkLabel")} required={false} />}
        </Field>
        <Field id={id("linkHref")} label="Link" hint="A path like /admissions/apply, or a full address." error={form.error("linkHref")}>
          {(props) => <Input {...props} name="linkHref" defaultValue={form.text("linkHref")} required={false} />}
        </Field>
        <Field id={id("placement")} label="Where it shows" error={form.error("placement")} required>
          {(props) => (
            <Picker
              {...props}
              name="placement"
              defaultValue={form.text("placement") || AnnouncementPlacement.GLOBAL}
              options={Object.values(AnnouncementPlacement).map((value) => ({ value, label: PLACEMENT_LABELS[value] }))}
            />
          )}
        </Field>
        <Field id={id("priority")} label="Priority" hint="Higher wins when several could show." error={form.error("priority")}>
          {(props) => <Input {...props} name="priority" inputMode="numeric" defaultValue={form.text("priority") || "0"} required={false} />}
        </Field>
        <Field id={id("startsAt")} label="From" hint="Optional." error={form.error("startsAt")}>
          {(props) => <Input {...props} name="startsAt" type="datetime-local" defaultValue={form.text("startsAt")} required={false} />}
        </Field>
        <Field id={id("endsAt")} label="Until" hint="Optional." error={form.error("endsAt")}>
          {(props) => <Input {...props} name="endsAt" type="datetime-local" defaultValue={form.text("endsAt")} required={false} />}
        </Field>
      </div>
      <Check form={form} name="isActive" label="Showing" />
      <div>
        <button type="submit" className="rounded-full bg-navy-700 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-900">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
