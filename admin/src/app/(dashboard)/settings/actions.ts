"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/dal";
import { MediaVisibility } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { saveSettings, SETTINGS_REGISTRY, SETTING_KEYS, type SettingGroup, type SettingKey, type SettingType } from "@/lib/settings";

import { flag, text, type FormState } from "@/lib/forms";

/**
 * One action for every group on the settings page. The fields are whatever
 * the registry says the group holds, so a new setting needs no new code here.
 */

const RULES: Record<Exclude<SettingType, "boolean" | "image">, z.ZodType<string>> = {
  text: z.string().trim().max(200, "Keep this under 200 characters."),
  textarea: z.string().trim().max(2000, "Keep this under 2,000 characters."),
  email: z.string().trim().refine((v) => v === "" || z.email().safeParse(v).success, { message: "Enter a valid email address." }),
  tel: z.string().trim().refine((v) => v === "" || /^\+?[\d\s()./-]{6,24}$/.test(v), { message: "Enter a telephone number, digits and spaces only." }),
  url: z.string().trim().refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), { message: "Enter a full address starting with https://." }),
};

export async function saveSettingsGroupAction(group: SettingGroup, _previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission("settings:write");
  const keys = SETTING_KEYS.filter((key) => SETTINGS_REGISTRY[key].group === group);

  const values: Record<string, string | boolean> = {};
  const fieldErrors: Record<string, string> = {};
  const toSave: Partial<Record<SettingKey, string | boolean>> = {};

  for (const key of keys) {
    const definition = SETTINGS_REGISTRY[key];
    if (definition.type === "boolean") {
      values[key] = flag(formData, key);
      toSave[key] = values[key];
      continue;
    }
    const raw = text(formData, key);
    values[key] = raw;
    if (definition.type === "image") {
      // An image setting holds a media asset id; it must be a public image.
      if (raw && !(await db.mediaAsset.count({ where: { id: raw, visibility: MediaVisibility.PUBLIC } }))) {
        fieldErrors[key] = "That photograph is no longer in the media library.";
        continue;
      }
      toSave[key] = raw;
      continue;
    }
    const parsed = RULES[definition.type].safeParse(raw);
    if (!parsed.success) {
      fieldErrors[key] = parsed.error.issues[0]?.message ?? "Check this value.";
      continue;
    }
    if (key === "seo.titleTemplate" && parsed.data && !parsed.data.includes("%s")) {
      fieldErrors[key] = "Include %s where the page title should go.";
      continue;
    }
    toSave[key] = parsed.data;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", message: "Check the highlighted fields.", fieldErrors, values };
  }

  const changes = await saveSettings(toSave);
  if (changes.length > 0) {
    await recordAudit({
      actorUserId: user.id,
      action: "updated",
      entityType: "site_setting",
      entityId: group,
      oldValue: Object.fromEntries(changes.map((change) => [change.key, change.from])),
      newValue: Object.fromEntries(changes.map((change) => [change.key, change.to])),
      note: changes.map((change) => SETTINGS_REGISTRY[change.key].label).join(", "),
    });
  }
  revalidatePath("/settings");
  revalidatePath("/");
  return {
    status: "success",
    message: changes.length === 0 ? "Nothing had changed." : changes.length === 1 ? "Saved one change." : `Saved ${changes.length} changes.`,
    values,
  };
}
