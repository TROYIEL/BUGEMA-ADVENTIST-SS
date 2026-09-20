"use client";

import {
  CalendarDays,
  CalendarRange,
  Compass,
  FileCheck2,
  FileStack,
  FileText,
  FolderOpen,
  GalleryHorizontalEnd,
  GraduationCap,
  Images,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  Newspaper,
  ScrollText,
  Send,
  Settings,
  UserCog,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useAdminShell } from "@/components/admin-shell";
import { cn } from "@/components/ui/cn";
import type { Permission } from "@/lib/auth/rbac";
import type { NavCounts } from "@/lib/nav-counts";

/**
 * Icons are named on the server and resolved here, so the layout stays a
 * plain data description and only this client file depends on the icon set.
 */
const ICONS = {
  dashboard: LayoutDashboard,
  applications: FileText,
  documents: FileCheck2,
  requirements: ListChecks,
  "academic-years": CalendarRange,
  "hero-slides": Images,
  pages: FileStack,
  news: Newspaper,
  events: CalendarDays,
  gallery: GalleryHorizontalEnd,
  announcements: Megaphone,
  academics: GraduationCap,
  staff: Users,
  "media-library": FolderOpen,
  enquiries: Inbox,
  settings: Settings,
  navigation: Compass,
  outbox: Send,
  users: UserCog,
  audit: ScrollText,
} satisfies Record<string, LucideIcon>;

export type NavIcon = keyof typeof ICONS;

export type NavEntry = {
  label: string;
  href: string;
  icon: NavIcon;
  permission: Permission;
  /** False until the module is built; rendered as a disabled row, not a link. */
  available: boolean;
};

export type NavGroup = {
  heading: string;
  entries: NavEntry[];
};

/**
 * Administration navigation.
 *
 * Deliberately nothing like the website's header: a persistent dark sidebar
 * grouped by task, collapsing to a drawer on small screens.
 *
 * Entries the signed-in role cannot use are filtered out on the server before
 * they reach this component, so the sidebar never advertises a page that would
 * answer 403. Entries that simply are not built yet are rendered as plain
 * disabled rows rather than links — an admin menu that navigates to a 404 is
 * worse than one that says "not yet".
 */
export function AdminNav({
  groups,
  initialCounts,
  userName,
  roleLabel,
  signOut,
}: {
  groups: NavGroup[];
  /** What is waiting in each module, keyed by href; rendered by the server first. */
  initialCounts: NavCounts;
  userName: string;
  roleLabel: string;
  signOut: React.ReactNode;
}) {
  const pathname = usePathname();
  const { open, setOpen } = useAdminShell();
  const counts = useLiveCounts(initialCounts, pathname);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const nav = (
    <nav aria-label="Administration" className="flex flex-1 flex-col gap-6 overflow-y-auto scrollbar p-4">
      {groups.map((group) => (
        <div key={group.heading} className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-navy-300">
            {group.heading}
          </p>
          {group.entries.map((entry) => {
            const Icon = ICONS[entry.icon];
            const count = counts[entry.href as keyof NavCounts];
            return entry.available ? (
              <Link
                key={entry.label}
                href={entry.href as never}
                aria-current={isActive(entry.href) ? "page" : undefined}
                className={cn(
                  "nav-item",
                  isActive(entry.href) && "bg-white/12 text-white",
                )}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0 opacity-80" />
                <span className="flex-1 truncate">{entry.label}</span>
                {count ? (
                  <span
                    className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-gold-400 px-1.5 text-[0.6875rem] font-bold tabular-nums text-navy-950"
                    aria-label={`${count} waiting`}
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                ) : null}
              </Link>
            ) : (
              <span
                key={entry.label}
                aria-disabled="true"
                className="flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium text-navy-300/60"
              >
                <span className="flex items-center gap-2.5">
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  {entry.label}
                </span>
                <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-navy-200/70">
                  soon
                </span>
              </span>
            );
          })}
        </div>
      ))}
    </nav>
  );

  return (
    <>
      <aside
        id="admin-sidebar"
        className={cn(
          // Small screens: a drawer fixed beneath the 3.5rem top bar, so the
          // bar's close button stays in view. Large screens: a sticky column.
          "flex shrink-0 flex-col bg-navy-950 text-white",
          "fixed inset-x-0 bottom-0 top-14 z-40 overflow-y-auto",
          "lg:sticky lg:inset-auto lg:top-0 lg:z-auto lg:h-dvh lg:w-64 lg:overflow-visible",
          !open && "hidden lg:flex",
        )}
      >
        <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-4">
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center border-2 border-gold-400 bg-navy-800 font-serif text-sm font-semibold"
          >
            B
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">BASS</span>
            <span className="text-[0.6875rem] text-navy-300">Administration</span>
          </span>
        </div>

        {nav}

        <div className="border-t border-white/10 p-4">
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className={cn("-mx-2 flex items-center gap-3 rounded-md px-2 py-1 hover:bg-white/10", pathname === "/account" && "bg-white/10")}
            title="Your account"
          >
            <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10">
              <UserRound className="size-4" />
            </span>
            <span className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{userName}</p>
              <p className="truncate text-xs text-navy-300">{roleLabel} · Your account</p>
            </span>
          </Link>
          <div className="mt-3">{signOut}</div>
        </div>
      </aside>
    </>
  );
}

/**
 * Keeps the counts honest as the person moves around. The server renders
 * the first set, but a layout is not re-rendered on client-side navigation,
 * so the sidebar re-asks after every route change and whenever the tab comes
 * back into focus. A failed fetch leaves the last known numbers in place.
 */
function useLiveCounts(initial: NavCounts, pathname: string): NavCounts {
  const [counts, setCounts] = useState(initial);

  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => {
      fetch("/api/nav-counts", { signal: controller.signal, cache: "no-store" })
        .then((res) => (res.ok ? (res.json() as Promise<NavCounts>) : null))
        .then((next) => {
          if (next) setCounts(next);
        })
        .catch(() => {});
    };
    refresh();
    const onFocus = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      controller.abort();
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [pathname]);

  return counts;
}
