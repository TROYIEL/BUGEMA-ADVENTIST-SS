import type { Metadata } from "next";
import Link from "next/link";

import { requirePagePermission } from "@/lib/auth/dal";
import { countNavigation, isMenuKey, listNavigation, MENU_KEYS, MENUS, type MenuKey, type NavigationRow } from "@/lib/navigation-admin";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";

import { ConfigRow, ConfigSection, DeleteControl, MoveControls } from "@/components/config/layout";
import { NavigationForm } from "@/components/settings/navigation-form";

import { deleteNavigationAction, moveNavigationAction, saveNavigationItemAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Navigation" };

/**
 * The website's menus. One menu is shown at a time; the main menu has two
 * levels, drawn as rows and indented sub-rows.
 */
export default async function NavigationPage({ searchParams }: { searchParams: Promise<{ menu?: string }> }) {
  await requirePagePermission("navigation:write");
  const { menu: requested } = await searchParams;
  const menu: MenuKey = requested && isMenuKey(requested) ? requested : "HEADER";
  const [items, counts] = await Promise.all([listNavigation(menu), countNavigation()]);
  const definition = MENUS[menu];
  const parents = items.filter((item) => !item.parentId).map((item) => ({ id: item.id, label: item.label }));

  const valuesFor = (row: NavigationRow | null) => ({
    label: row?.label ?? "",
    href: row?.href ?? "",
    description: row?.description ?? "",
    parentId: row?.parentId ?? "",
    isActive: row?.isActive ?? true,
    highlight: row?.highlight ?? false,
    opensInNewTab: row?.opensInNewTab ?? false,
  });

  const rowFor = (row: NavigationRow, index: number, siblings: number, children: NavigationRow[] = [], indent = false) => (
    <ConfigRow
      key={row.id}
      indent={indent}
      title={row.label}
      muted={!row.isActive}
      badges={
        <>
          {!row.isActive ? <Badge tone="neutral">Hidden</Badge> : null}
          {row.highlight ? <Badge tone="gold">Highlighted</Badge> : null}
          {row.opensInNewTab ? <Badge tone="info">New tab</Badge> : null}
        </>
      }
      meta={[row.href, children.length > 0 ? `${children.length} sub-link${children.length === 1 ? "" : "s"}` : null, row.description].filter(Boolean).join(" · ")}
      editor={
        <NavigationForm
          action={saveNavigationItemAction.bind(null, row.id)}
          values={valuesFor(row)}
          menu={menu}
          parents={parents.filter((parent) => parent.id !== row.id)}
          submitLabel="Save"
        />
      }
      controls={
        <>
          <MoveControls action={moveNavigationAction} hidden={{ id: row.id }} first={index === 0} last={index === siblings - 1} label={row.label} />
          <DeleteControl action={deleteNavigationAction} id={row.id} label={children.length > 0 ? `${row.label} and its ${children.length} sub-links` : row.label} />
        </>
      }
    />
  );

  return (
    <div className="container-admin max-w-5xl py-8">
      <header>
        <h1 className="text-2xl font-semibold text-navy-900">Navigation</h1>
        <p className="mt-1 text-sm text-ink-600">The links in the website&rsquo;s header and footer, in the order they appear.</p>
        <nav aria-label="Menus" className="mt-4 flex flex-wrap gap-2 text-sm">
          {MENU_KEYS.map((key) => (
            <Link
              key={key}
              href={`/navigation?menu=${key}`}
              aria-current={key === menu ? "page" : undefined}
              className={cn(
                "rounded-full border px-3 py-1 font-medium",
                key === menu ? "border-navy-800 bg-navy-800 text-white" : "border-line bg-white text-navy-800 hover:bg-navy-50",
              )}
            >
              {MENUS[key].label}
              <span className={cn("ml-1.5", key === menu ? "text-white/70" : "text-ink-500")}>{counts[key]}</span>
            </Link>
          ))}
        </nav>
      </header>

      <div className="mt-6">
        <ConfigSection
          id={`menu-${menu.toLowerCase()}`}
          title={definition.label}
          hint={definition.hint}
          add={<NavigationForm action={saveNavigationItemAction.bind(null, null)} values={valuesFor(null)} menu={menu} parents={parents} submitLabel="Add link" />}
        >
          {items.flatMap((item, index) => [
            rowFor(item, index, items.length, item.children),
            ...item.children.map((child, childIndex) => rowFor(child, childIndex, item.children.length, [], true)),
          ])}
        </ConfigSection>
      </div>
    </div>
  );
}
