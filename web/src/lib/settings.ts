import "server-only";

import { cache } from "react";

import { db } from "@/lib/db";
import {
  SETTINGS_REGISTRY,
  SETTING_KEYS,
  type SettingDefinition,
  type SettingKey,
} from "./settings-registry";

export * from "./settings-registry";

export type SettingValue = {
  value: string;
  isConfigured: boolean;
};

export type SiteSettings = Record<SettingKey, SettingValue>;

/**
 * Loads every setting once per request pass. Values that were never configured
 * come back with `isConfigured: false` so callers can choose to render nothing
 * rather than an empty or invented detail.
 */
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  const rows = await db.siteSetting.findMany({
    select: { key: true, value: true, isConfigured: true },
  });

  const byKey = new Map(rows.map((row) => [row.key, row]));
  const settings = {} as SiteSettings;

  for (const key of SETTING_KEYS) {
    const definition = SETTINGS_REGISTRY[key];
    const row = byKey.get(key);
    const raw = row?.value;

    settings[key] = {
      value:
        raw === undefined || raw === null
          ? String(definition.default)
          : typeof raw === "string"
            ? raw
            : String(raw),
      isConfigured: row?.isConfigured ?? Boolean(definition.seeded),
    };
  }

  return settings;
});

/**
 * Writes one setting. Marks it configured, since a value an administrator
 * chose is real even when it equals the seeded default. Metadata comes from
 * the registry so a key that was never seeded still gets a complete row.
 */
export async function setSetting(key: SettingKey, value: string | boolean): Promise<void> {
  await saveSettings({ [key]: value });
}

export type SettingChange = { key: SettingKey; from: string; to: string };

/**
 * Writes several settings together and reports which ones changed, for the
 * audit log. An emptied text value goes back to unconfigured, so the public
 * site leaves that detail out again and the dashboard checklist asks for it;
 * a boolean is always a choice, so it is always configured.
 */
export async function saveSettings(
  values: Partial<Record<SettingKey, string | boolean>>,
): Promise<SettingChange[]> {
  const keys = Object.keys(values) as SettingKey[];
  if (keys.length === 0) return [];

  // Read straight from the table, not through the per-request cache: the
  // cache may already hold what this same request rendered with.
  const rows = await db.siteSetting.findMany({
    where: { key: { in: keys } },
    select: { key: true, value: true, isConfigured: true },
  });
  const current = new Map(rows.map((row) => [row.key, row]));
  const changes: SettingChange[] = [];

  await db.$transaction(
    keys.map((key) => {
      const definition = SETTINGS_REGISTRY[key];
      const value = values[key] as string | boolean;
      // Booleans are stored as JSON booleans, as the seed stores them; the
      // reader stringifies either form.
      const stored = typeof value === "boolean" ? value : value.trim();
      const isConfigured = typeof stored === "boolean" || stored !== "";
      const before = current.get(key);
      const beforeValue = before?.isConfigured ? String(before.value ?? "") : "";
      if (String(stored) !== beforeValue || isConfigured !== Boolean(before?.isConfigured)) {
        changes.push({ key, from: beforeValue, to: String(stored) });
      }
      return db.siteSetting.upsert({
        where: { key },
        update: { value: stored, isConfigured },
        create: {
          key,
          group: definition.group,
          label: definition.label,
          description: definition.description,
          order: definition.order,
          value: stored,
          isConfigured,
        },
      });
    }),
  );

  return changes;
}

/** The configured value, or null when the school has not supplied one. */
export async function getSetting(key: SettingKey): Promise<string | null> {
  const settings = await getSiteSettings();
  const entry = settings[key];
  if (!entry.isConfigured || entry.value === "") return null;
  return entry.value;
}

export function readSetting(
  settings: SiteSettings,
  key: SettingKey,
): string | null {
  const entry = settings[key];
  if (!entry.isConfigured || entry.value === "") return null;
  return entry.value;
}

export function readBooleanSetting(
  settings: SiteSettings,
  key: SettingKey,
): boolean {
  return settings[key].value === "true";
}

/** Settings a human still needs to fill in, for the admin checklist. */
export function getUnconfiguredSettings(
  settings: SiteSettings,
): { key: SettingKey; definition: SettingDefinition }[] {
  return SETTING_KEYS.filter((key) => !settings[key].isConfigured).map((key) => ({
    key,
    definition: SETTINGS_REGISTRY[key],
  }));
}
