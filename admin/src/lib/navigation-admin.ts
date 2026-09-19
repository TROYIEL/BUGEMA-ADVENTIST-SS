import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

import { MENUS, type MenuKey } from "./navigation-shared";

export * from "./navigation-shared";

/**
 * The website's menus, from the staff side. The public site reads them
 * through `navigation.ts`, which drops anything inactive; here every item is
 * listed so it can be switched back on.
 */

const ITEM_SELECT = {
  id: true,
  menu: true,
  label: true,
  href: true,
  description: true,
  parentId: true,
  order: true,
  isActive: true,
  highlight: true,
  opensInNewTab: true,
} satisfies Prisma.NavigationItemSelect;

export type NavigationRow = Prisma.NavigationItemGetPayload<{ select: typeof ITEM_SELECT }>;

/** A top-level item with its children in order — inactive ones included. */
export type NavigationTreeItem = NavigationRow & { children: NavigationRow[] };

const ORDER = [{ order: "asc" as const }, { createdAt: "asc" as const }];

export async function listNavigation(menu: MenuKey): Promise<NavigationTreeItem[]> {
  const rows = await db.navigationItem.findMany({ where: { menu }, orderBy: ORDER, select: ITEM_SELECT });
  const roots: NavigationTreeItem[] = rows.filter((row) => !row.parentId).map((row) => ({ ...row, children: [] }));
  const byId = new Map(roots.map((root) => [root.id, root]));
  for (const row of rows) {
    if (!row.parentId) continue;
    // A child whose parent is gone would never show; list it at the top
    // level so it can be re-homed or removed rather than lost.
    const parent = byId.get(row.parentId);
    if (parent) parent.children.push(row);
    else roots.push({ ...row, children: [] });
  }
  return roots;
}

export async function getNavigationItem(id: string): Promise<NavigationRow | null> {
  return db.navigationItem.findUnique({ where: { id }, select: ITEM_SELECT });
}

/** Top-level items of a menu, as parent choices for the editor. */
export async function listParentChoices(menu: MenuKey, exceptId?: string | null): Promise<{ id: string; label: string }[]> {
  return db.navigationItem.findMany({
    where: { menu, parentId: null, ...(exceptId ? { id: { not: exceptId } } : {}) },
    orderBy: ORDER,
    select: { id: true, label: true },
  });
}

export type NavigationInput = {
  menu: MenuKey;
  label: string;
  href: string;
  description: string | null;
  parentId: string | null;
  isActive: boolean;
  highlight: boolean;
  opensInNewTab: boolean;
};

export type SaveNavigationResult =
  | { ok: true; row: NavigationRow }
  | { ok: false; field: "parentId"; message: string };

export async function saveNavigationItem(id: string | null, input: NavigationInput): Promise<SaveNavigationResult> {
  let parentId: string | null = null;
  if (input.parentId) {
    // Only the header has a second level, and only one: a parent must be a
    // top-level item of the same menu, and never the item itself.
    if (!MENUS[input.menu].nested) {
      return { ok: false, field: "parentId", message: "This menu has no sub-links." };
    }
    if (input.parentId === id) {
      return { ok: false, field: "parentId", message: "A link cannot sit under itself." };
    }
    const parent = await db.navigationItem.findUnique({ where: { id: input.parentId }, select: { menu: true, parentId: true } });
    if (!parent || parent.menu !== input.menu || parent.parentId) {
      return { ok: false, field: "parentId", message: "Choose a top-level link of this menu." };
    }
    parentId = input.parentId;
  }
  if (id && parentId) {
    // A link moving under a parent cannot bring sub-links of its own, or
    // the menu would go three deep.
    const children = await db.navigationItem.count({ where: { parentId: id } });
    if (children > 0) {
      return { ok: false, field: "parentId", message: "This link has sub-links of its own; move those first." };
    }
  }

  const data = {
    menu: input.menu,
    label: input.label,
    href: input.href,
    description: input.description,
    parentId,
    isActive: input.isActive,
    highlight: input.highlight,
    opensInNewTab: input.opensInNewTab,
  };

  if (id) {
    const existing = await db.navigationItem.findUnique({ where: { id }, select: { menu: true, parentId: true } });
    if (!existing) return { ok: false, field: "parentId", message: "That link no longer exists." };
    const moved = existing.menu !== input.menu || existing.parentId !== parentId;
    const row = await db.navigationItem.update({
      where: { id },
      // Moving between menus or parents puts the link last among its new siblings.
      data: moved ? { ...data, order: await nextOrder(input.menu, parentId) } : data,
      select: ITEM_SELECT,
    });
    if (existing.menu !== input.menu) {
      // Sub-links follow their parent into the other menu.
      await db.navigationItem.updateMany({ where: { parentId: id }, data: { menu: input.menu } });
    }
    return { ok: true, row };
  }

  const row = await db.navigationItem.create({
    data: { ...data, order: await nextOrder(input.menu, parentId) },
    select: ITEM_SELECT,
  });
  return { ok: true, row };
}

async function nextOrder(menu: MenuKey, parentId: string | null): Promise<number> {
  const last = await db.navigationItem.findFirst({ where: { menu, parentId }, orderBy: { order: "desc" }, select: { order: true } });
  return (last?.order ?? 0) + 10;
}

/** Swaps a link with its neighbour among its siblings. */
export async function moveNavigationItem(id: string, direction: "up" | "down"): Promise<void> {
  const item = await db.navigationItem.findUnique({ where: { id }, select: { menu: true, parentId: true } });
  if (!item) return;
  const siblings = await db.navigationItem.findMany({
    where: { menu: item.menu, parentId: item.parentId },
    orderBy: ORDER,
    select: { id: true },
  });
  const ids = siblings.map((row) => row.id);
  const index = ids.indexOf(id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= ids.length) return;
  [ids[index], ids[target]] = [ids[target]!, ids[index]!];
  await db.$transaction(ids.map((rowId, position) => db.navigationItem.update({ where: { id: rowId }, data: { order: (position + 1) * 10 } })));
}

/** Removes a link and, through the schema's cascade, its sub-links. */
export async function deleteNavigationItem(id: string): Promise<{ label: string; children: number } | null> {
  const item = await db.navigationItem.findUnique({
    where: { id },
    select: { label: true, _count: { select: { children: true } } },
  });
  if (!item) return null;
  await db.navigationItem.delete({ where: { id } });
  return { label: item.label, children: item._count.children };
}

/** For the menu switcher: how many links each menu holds. */
export async function countNavigation(): Promise<Record<MenuKey, number>> {
  const groups = await db.navigationItem.groupBy({ by: ["menu"], _count: { _all: true } });
  const counts = Object.fromEntries(Object.keys(MENUS).map((menu) => [menu, 0])) as Record<MenuKey, number>;
  for (const group of groups) {
    if (group.menu in counts) counts[group.menu as MenuKey] = group._count._all;
  }
  return counts;
}

export function isMenuKey(value: string): value is MenuKey {
  return Object.hasOwn(MENUS, value);
}
