import type { Metadata } from "next";
import Link from "next/link";

import { requirePagePermission } from "@bass/auth/dal";
import { listImageChoices } from "@bass/core/media-library";
import {
  getSiteSettings,
  getUnconfiguredSettings,
  SETTING_GROUP_LABELS,
  SETTING_KEYS,
  SETTINGS_REGISTRY,
  type SettingGroup,
  type SettingKey,
} from "@bass/core/settings";

import { SettingsGroupForm, type SettingValues } from "@/components/settings/settings-form";

import { saveSettingsGroupAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Site settings" };

/** The order the groups are shown in, with a line of context for each. */
const GROUPS: { group: SettingGroup; hint: string }[] = [
  { group: "identity", hint: "How the school is named across the website." },
  {
    group: "contact",
    hint: "Shown on the contact page and in the footer. Anything left empty is simply left out.",
  },
  { group: "admissions", hint: "The admissions section's own contact details and introduction. Opening and closing dates are set on the active academic year." },
  {
    group: "homepage",
    hint: "The photograph in the coloured band partway down the homepage, and the ones the built-in first slide uses when no hero slides are switched on.",
  },
  { group: "social", hint: "Links in the footer. Leave one empty to hide it." },
  { group: "seo", hint: "What search engines and shared links show for pages that set nothing of their own." },
  { group: "footer", hint: "The short description and copyright line at the bottom of every page." },
];

export default async function SettingsPage() {
  await requirePagePermission("settings:write");
  const [settings, choices] = await Promise.all([getSiteSettings(), listImageChoices()]);
  const unconfigured = new Set(getUnconfiguredSettings(settings).map((entry) => entry.key));

  const keysFor = (group: SettingGroup): SettingKey[] =>
    SETTING_KEYS.filter((key) => SETTINGS_REGISTRY[key].group === group).sort(
      (a, b) => SETTINGS_REGISTRY[a].order - SETTINGS_REGISTRY[b].order || a.localeCompare(b),
    );

  const savedFor = (keys: SettingKey[]): SettingValues =>
    Object.fromEntries(
      keys.map((key) => {
        const definition = SETTINGS_REGISTRY[key];
        const entry = settings[key];
        if (definition.type === "boolean") return [key, entry.value === "true"];
        // An unconfigured placeholder shows as empty, not as the default.
        return [key, entry.isConfigured ? entry.value : ""];
      }),
    );

  return (
    <div className="container-admin max-w-4xl py-8">
      <header>
        <h1 className="text-2xl font-semibold text-navy-900">Site settings</h1>
        <p className="mt-1 text-sm text-ink-600">
          The facts about the school the website is built from.{" "}
          {unconfigured.size === 0
            ? "Everything has a value."
            : `${unconfigured.size} still ${unconfigured.size === 1 ? "needs" : "need"} a real value; until then the website leaves ${unconfigured.size === 1 ? "it" : "them"} out rather than showing a placeholder.`}
        </p>
        <nav aria-label="Groups" className="mt-4 flex flex-wrap gap-2 text-sm">
          {GROUPS.map(({ group }) => {
            const waiting = keysFor(group).filter((key) => unconfigured.has(key)).length;
            return (
              <Link
                key={group}
                href={`/settings#settings-${group}`}
                className="rounded-full border border-line bg-white px-3 py-1 font-medium text-navy-800 hover:bg-navy-50"
              >
                {SETTING_GROUP_LABELS[group]}
                {waiting > 0 ? <span className="ml-1.5 text-ink-500">{waiting}</span> : null}
              </Link>
            );
          })}
        </nav>
      </header>

      <div className="mt-6 flex flex-col gap-6">
        {GROUPS.map(({ group, hint }) => {
          const keys = keysFor(group);
          return (
            <SettingsGroupForm
              key={group}
              group={group}
              title={SETTING_GROUP_LABELS[group]}
              hint={hint}
              keys={keys}
              saved={savedFor(keys)}
              unconfigured={keys.filter((key) => unconfigured.has(key))}
              choices={choices}
              action={saveSettingsGroupAction.bind(null, group)}
            />
          );
        })}
      </div>
    </div>
  );
}
