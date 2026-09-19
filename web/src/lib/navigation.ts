import "server-only";

import { cache } from "react";

import { NavigationMenu } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

export type NavItem = {
  id: string;
  label: string;
  href: string;
  description: string | null;
  highlight: boolean;
  opensInNewTab: boolean;
  children: NavItem[];
};

/**
 * Navigation is database-driven so the school can rename, reorder, add or
 * retire links without a deployment.
 */
export const getNavigation = cache(
  async (menu: NavigationMenu): Promise<NavItem[]> => {
    const rows = await db.navigationItem.findMany({
      where: { menu, isActive: true },
      orderBy: { order: "asc" },
      select: {
        id: true,
        label: true,
        href: true,
        description: true,
        highlight: true,
        opensInNewTab: true,
        parentId: true,
      },
    });

    const byId = new Map<string, NavItem>();
    for (const row of rows) {
      byId.set(row.id, { ...row, children: [] });
    }

    const roots: NavItem[] = [];
    for (const row of rows) {
      const item = byId.get(row.id);
      if (!item) continue;

      if (row.parentId) {
        // A child whose parent was deactivated is dropped rather than promoted
        // to the top level, where it would appear as an unexpected menu item.
        byId.get(row.parentId)?.children.push(item);
      } else {
        roots.push(item);
      }
    }

    return roots;
  },
);
