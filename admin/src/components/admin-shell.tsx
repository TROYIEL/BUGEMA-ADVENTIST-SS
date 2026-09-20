"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * State the sidebar and the top bar share: whether the sidebar drawer is open
 * on a small screen. The top bar owns the toggle, the sidebar reacts, and a
 * route change closes it so the page underneath is never hidden after a tap.
 */
const ShellContext = createContext<{ open: boolean; setOpen: (open: boolean) => void }>({
  open: false,
  setOpen: () => {},
});

export function AdminShellProvider({ children }: { children: ReactNode }) {
  // Remember *where* it was opened: a different pathname means it is closed,
  // which closes the drawer on navigation without an effect.
  const pathname = usePathname();
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;
  const setOpen = (next: boolean) => setOpenedAt(next ? pathname : null);
  return <ShellContext.Provider value={{ open, setOpen }}>{children}</ShellContext.Provider>;
}

export function useAdminShell() {
  return useContext(ShellContext);
}
