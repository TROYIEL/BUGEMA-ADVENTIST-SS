"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/dal";
import { recordAudit } from "@/lib/audit";
import { deleteNavigationItem, MENU_KEYS, moveNavigationItem, saveNavigationItem } from "@/lib/navigation-admin";

import { firstIssues, flag, text, type FormState } from "@/lib/forms";

const schema = z.object({
  menu: z.enum(MENU_KEYS, { error: "Choose a menu." }),
  label: z.string().trim().min(1, "Give the link a name.").max(40, "Keep it under 40 characters; it has to fit in the menu."),
  href: z
    .string()
    .trim()
    .min(1, "Where should it go?")
    .max(300)
    .refine((v) => /^(\/(?!\/)|https?:\/\/|tel:|mailto:)/.test(v), { message: "Enter a path like /admissions, or a full address starting with https://." }),
  description: z.string().trim().max(120, "Keep it under 120 characters.").transform((v) => (v === "" ? null : v)),
  parentId: z.string().trim().transform((v) => (v === "" ? null : v)),
  isActive: z.boolean(),
  highlight: z.boolean(),
  opensInNewTab: z.boolean(),
});

export async function saveNavigationItemAction(id: string | null, _previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission("navigation:write");
  const values = {
    menu: text(formData, "menu"),
    label: text(formData, "label"),
    href: text(formData, "href"),
    description: text(formData, "description"),
    parentId: text(formData, "parentId"),
    isActive: flag(formData, "isActive"),
    highlight: flag(formData, "highlight"),
    opensInNewTab: flag(formData, "opensInNewTab"),
  };
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: firstIssues(parsed.error), values };

  const result = await saveNavigationItem(id, parsed.data);
  if (!result.ok) return { status: "error", fieldErrors: { [result.field]: result.message }, values };

  await recordAudit({
    actorUserId: user.id,
    action: id ? "updated" : "created",
    entityType: "navigation_item",
    entityId: result.row.id,
    note: `${parsed.data.label} → ${parsed.data.href}`,
  });
  revalidatePath("/navigation");
  return { status: "idle" };
}

export async function moveNavigationAction(formData: FormData): Promise<void> {
  await requirePermission("navigation:write");
  const direction = text(formData, "direction");
  if (direction !== "up" && direction !== "down") return;
  await moveNavigationItem(text(formData, "id"), direction);
  revalidatePath("/navigation");
}

export async function deleteNavigationAction(formData: FormData): Promise<void> {
  const user = await requirePermission("navigation:write");
  const id = text(formData, "id");
  const deleted = await deleteNavigationItem(id);
  if (deleted) {
    await recordAudit({
      actorUserId: user.id,
      action: "deleted",
      entityType: "navigation_item",
      entityId: id,
      note: deleted.children > 0 ? `${deleted.label} (and ${deleted.children} sub-links)` : deleted.label,
    });
  }
  revalidatePath("/navigation");
}
