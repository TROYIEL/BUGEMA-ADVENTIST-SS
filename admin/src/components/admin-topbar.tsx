"use client";

import {
  Bell,
  CalendarDays,
  ChevronDown,
  FileStack,
  FileText,
  Images,
  Inbox,
  Menu,
  Newspaper,
  Plus,
  Search,
  Send,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { useAdminShell } from "@/components/admin-shell";
import { DropdownMenu, menuItemClass } from "@/components/dropdown-menu";
import { cn } from "@/components/ui/cn";
import type { NavCounts } from "@/lib/nav-counts";

export type QuickAction = { label: string; href: string; icon: "news" | "event" | "page" | "hero" | "media" | "user" };

const ACTION_ICONS: Record<QuickAction["icon"], LucideIcon> = {
  news: Newspaper,
  event: CalendarDays,
  page: FileStack,
  hero: Images,
  media: Images,
  user: Users,
};

const ATTENTION: { key: keyof NavCounts; label: (n: number) => string; icon: LucideIcon }[] = [
  { key: "/applications", label: (n) => `${n} ${n === 1 ? "application" : "applications"} awaiting first review`, icon: FileText },
  { key: "/documents", label: (n) => `${n} ${n === 1 ? "document" : "documents"} to verify`, icon: FileText },
  { key: "/enquiries", label: (n) => `${n} unread ${n === 1 ? "enquiry" : "enquiries"}`, icon: Inbox },
  { key: "/outbox", label: (n) => `${n} ${n === 1 ? "email" : "emails"} failed to send`, icon: Send },
];

/**
 * The bar across the top of every admin page: the sidebar toggle on small
 * screens, a search box over every module, a "New…" menu for the things staff
 * create most, a bell listing what is waiting, and the account menu.
 *
 * Everything shown is already filtered for the role on the server — the
 * quick actions and the counts arrive as props — so the bar never offers a
 * page that would answer 403.
 */
export function AdminTopbar({
  quickActions,
  counts,
  userName,
  roleLabel,
  signOut,
}: {
  quickActions: QuickAction[];
  counts: NavCounts;
  userName: string;
  roleLabel: string;
  signOut: ReactNode;
}) {
  const { open, setOpen } = useAdminShell();
  const waiting = ATTENTION.filter((item) => (counts[item.key] ?? 0) > 0);
  const waitingTotal = waiting.reduce((sum, item) => sum + (counts[item.key] ?? 0), 0);
  const initials = userName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="container-admin flex h-14 items-center gap-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="admin-sidebar"
          onClick={() => setOpen(!open)}
          className="grid size-9 shrink-0 place-items-center rounded-md border border-line text-navy-800 lg:hidden"
        >
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          {open ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
        </button>

        <SearchBox />

        <div className="ml-auto flex items-center gap-1.5">
          {quickActions.length > 0 ? (
            <DropdownMenu
              label="Create new"
              trigger={
                <span className="flex items-center gap-1.5 rounded-full bg-navy-900 px-3 py-1.5 text-white hover:bg-navy-800">
                  <Plus aria-hidden="true" className="size-4" />
                  <span className="hidden sm:inline">New</span>
                  <ChevronDown aria-hidden="true" className="size-3.5 opacity-70" />
                </span>
              }
            >
              {quickActions.map((action) => {
                const Icon = ACTION_ICONS[action.icon];
                return (
                  <Link key={action.href} role="menuitem" href={action.href as never} className={menuItemClass}>
                    <Icon aria-hidden="true" className="size-4 text-ink-600" />
                    {action.label}
                  </Link>
                );
              })}
            </DropdownMenu>
          ) : null}

          <DropdownMenu
            label={waitingTotal > 0 ? `${waitingTotal} things waiting` : "Nothing waiting"}
            width="w-80"
            trigger={
              <span className="relative grid size-9 place-items-center rounded-full">
                <Bell aria-hidden="true" className="size-5" />
                {waitingTotal > 0 ? (
                  <span
                    aria-hidden="true"
                    className="absolute -right-0.5 -top-0.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-gold-400 px-1 text-[0.625rem] font-bold tabular-nums text-navy-950 ring-2 ring-white"
                  >
                    {waitingTotal > 99 ? "99+" : waitingTotal}
                  </span>
                ) : null}
              </span>
            }
          >
            <p className="px-2.5 pb-1 pt-1.5 text-xs font-semibold uppercase tracking-wide text-ink-600">Waiting for someone</p>
            {waiting.length === 0 ? (
              <p className="px-2.5 pb-2 text-sm text-ink-600">All caught up.</p>
            ) : (
              waiting.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.key} role="menuitem" href={item.key as never} className={menuItemClass}>
                    <Icon aria-hidden="true" className="size-4 text-ink-600" />
                    {item.label(counts[item.key] ?? 0)}
                  </Link>
                );
              })
            )}
          </DropdownMenu>

          <DropdownMenu
            label="Your account"
            width="w-64"
            trigger={
              <span className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2">
                <span aria-hidden="true" className="grid size-7 place-items-center rounded-full bg-navy-900 text-[0.6875rem] font-bold text-white">
                  {initials || <UserRound className="size-4" />}
                </span>
                <span className="hidden max-w-40 truncate text-left leading-tight md:block">{userName}</span>
                <ChevronDown aria-hidden="true" className="hidden size-3.5 opacity-60 md:block" />
              </span>
            }
          >
            <div className="px-2.5 pb-2 pt-1.5">
              <p className="truncate text-sm font-medium text-navy-900">{userName}</p>
              <p className="text-xs text-ink-600">{roleLabel}</p>
            </div>
            <Link role="menuitem" href="/account" className={menuItemClass}>
              <UserRound aria-hidden="true" className="size-4 text-ink-600" />
              Your account
            </Link>
            <div className={cn(menuItemClass, "p-0 hover:bg-transparent")}>{signOut}</div>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

/**
 * Submits to /search. "/" or Ctrl/⌘+K from anywhere focuses it, the way most
 * tools do, unless the person is already typing somewhere.
 */
function SearchBox() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(pathname === "/search" ? (searchParams.get("q") ?? "") : "");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((event.key === "k" && (event.metaKey || event.ctrlKey)) || (event.key === "/" && !typing)) {
        event.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form
      role="search"
      className="relative min-w-0 flex-1 md:max-w-md"
      onSubmit={(event) => {
        event.preventDefault();
        const q = value.trim();
        if (q) router.push(`/search?q=${encodeURIComponent(q)}` as never);
      }}
    >
      <label htmlFor="topbar-search" className="sr-only">Search the administration system</label>
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-500" />
      <input
        ref={input}
        id="topbar-search"
        type="search"
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search applications, enquiries, content…"
        autoComplete="off"
        className="h-9 w-full rounded-full border border-line bg-surface-sunken pl-9 pr-12 text-sm text-navy-900 placeholder:text-ink-500 focus:border-navy-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-800/20"
      />
      <kbd
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-line bg-white px-1.5 py-0.5 text-[0.625rem] font-semibold text-ink-500 md:block"
      >
        /
      </kbd>
    </form>
  );
}
