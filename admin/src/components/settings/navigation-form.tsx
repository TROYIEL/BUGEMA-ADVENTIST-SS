"use client";

import { useId } from "react";

import { MENUS, type MenuKey } from "@/lib/navigation-shared";
import { Field, Input } from "@/components/ui/field";
import { Picker } from "@/components/ui/picker";

import { Check, FormMessage, useContentForm, type BoundAction, type Values } from "@/components/content/fields";

/** The editor for one menu link; the menu decides which fields apply. */
export function NavigationForm({
  action,
  values,
  menu,
  parents,
  submitLabel,
}: {
  action: BoundAction;
  values: Values;
  menu: MenuKey;
  /** Top-level links this one could sit under (never itself). */
  parents: { id: string; label: string }[];
  submitLabel: string;
}) {
  const form = useContentForm(action, values);
  const instance = useId();
  const id = (name: string) => `${name}-${instance}`;
  const definition = MENUS[menu];

  return (
    <form action={form.formAction} className="flex flex-col gap-4" noValidate>
      <FormMessage state={form.state} />
      <input type="hidden" name="menu" value={menu} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id("label")} label="Link text" error={form.error("label")} required>
          {(props) => <Input {...props} name="label" defaultValue={form.text("label")} />}
        </Field>
        <Field id={id("href")} label="Goes to" hint="A page on the site, like /admissions, or a full address." error={form.error("href")} required>
          {(props) => <Input {...props} name="href" defaultValue={form.text("href")} className="font-mono text-sm" />}
        </Field>
        {definition.nested ? (
          <Field id={id("parentId")} label="Sits under" hint="Top-level links open a panel; the rest sit inside one." error={form.error("parentId")}>
            {(props) => (
              <Picker
                {...props}
                name="parentId"
                defaultValue={form.text("parentId")}
                emptyLabel="Top level"
                options={parents.map((parent) => ({ value: parent.id, label: parent.label }))}
              />
            )}
          </Field>
        ) : null}
        {definition.descriptions ? (
          <Field id={id("description")} label="Short description" hint="Optional. Shown under the link in the panel." error={form.error("description")}>
            {(props) => <Input {...props} name="description" defaultValue={form.text("description")} required={false} />}
          </Field>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-3">
        <Check form={form} name="isActive" label="Showing" hint="Switch off to hide the link without losing it." />
        {definition.nested ? <Check form={form} name="highlight" label="Highlighted" hint="Drawn as a button, for the one call to action." /> : null}
        <Check form={form} name="opensInNewTab" label="Opens in a new tab" hint="For links to other websites." />
      </div>
      <div>
        <button type="submit" className="rounded-full bg-navy-700 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-900">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
