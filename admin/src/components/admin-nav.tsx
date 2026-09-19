"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { cn } from "@/components/ui/cn";
import type { Permission } from "@/lib/auth/rbac";

export type NavEntry = {
  label: string;
  href: string;
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
  userName,
  roleLabel,
  signOut,
}: {
  groups: NavGroup[];
  userName: string;
  roleLabel: string;
  signOut: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
          {group.entries.map((entry) =>
            entry.available ? (
              <Link
                key={entry.label}
                href={entry.href as never}
                aria-current={isActive(entry.href) ? "page" : undefined}
                className={cn(
                  "nav-item",
                  isActive(entry.href) && "bg-white/12 text-white",
                )}
              >
                {entry.label}
              </Link>
            ) : (
              <span
                key={entry.label}
                aria-disabled="true"
                className="flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium text-navy-300/60"
              >
                {entry.label}
                <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-navy-200/70">
                  soon
                </span>
              </span>
            ),
          )}
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile bar */}
      <div className="flex items-center justify-between border-b border-line bg-white px-4 py-3 lg:hidden">
        <span className="font-semibold text-navy-900">BASS Administration</span>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="admin-sidebar"
          onClick={() => setOpen((value) => !value)}
          className="grid size-9 place-items-center rounded-md border border-line text-navy-800"
        >
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="size-5">
            {open ? (
              <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            ) : (
              <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      <aside
        id="admin-sidebar"
        className={cn(
          "flex w-full shrink-0 flex-col bg-navy-950 text-white lg:sticky lg:top-0 lg:h-dvh lg:w-64",
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
            className={cn("block rounded-md px-2 py-1 -mx-2 hover:bg-white/10", pathname === "/account" && "bg-white/10")}
            title="Your account"
          >
            <p className="truncate text-sm font-medium text-white">{userName}</p>
            <p className="text-xs text-navy-300">{roleLabel} · Your account</p>
          </Link>
          <div className="mt-3">{signOut}</div>
        </div>
      </aside>
    </>
  );
}
