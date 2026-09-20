import { logoutAction } from "@/app/login/actions";
import { AdminNav, type NavGroup, type NavIcon } from "@/components/admin-nav";
import { AdminShellProvider } from "@/components/admin-shell";
import { AdminTopbar, type QuickAction } from "@/components/admin-topbar";
import { getCurrentUser } from "@/lib/auth/dal";
import { ROLE_LABELS, hasPermission, type Permission } from "@/lib/auth/rbac";
import { getNavCounts } from "@/lib/nav-counts";
import { LogOut } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";

/**
 * The full navigation, before it is filtered for the signed-in role.
 *
 * `available` marks what has actually been built. Everything else is shown as
 * a disabled row so the shape of the system is visible without the menu
 * offering links that 404. As each module lands in milestone 4, its flag flips.
 */
const NAV: { heading: string; entries: { label: string; href: string; icon: NavIcon; permission: Permission; available: boolean }[] }[] =
  [
    {
      heading: "Overview",
      entries: [{ label: "Dashboard", icon: "dashboard", href: "/", permission: "admin:access", available: true }],
    },
    {
      heading: "Admissions",
      entries: [
        { label: "Applications", icon: "applications", href: "/applications", permission: "applications:read", available: true },
        { label: "Documents", icon: "documents", href: "/documents", permission: "documents:review", available: true },
        { label: "Requirements", icon: "requirements", href: "/requirements", permission: "admissions:configure", available: true },
        { label: "Academic years", icon: "academic-years", href: "/academic-years", permission: "admissions:configure", available: true },
      ],
    },
    {
      heading: "Content",
      entries: [
        { label: "Hero slides", icon: "hero-slides", href: "/hero-slides", permission: "content:write", available: true },
        { label: "Pages", icon: "pages", href: "/pages", permission: "content:write", available: true },
        { label: "News", icon: "news", href: "/news", permission: "content:write", available: true },
        { label: "Events", icon: "events", href: "/events", permission: "content:write", available: true },
        { label: "Gallery", icon: "gallery", href: "/gallery", permission: "content:write", available: true },
        { label: "Announcements", icon: "announcements", href: "/announcements", permission: "announcements:write", available: true },
      ],
    },
    {
      heading: "School",
      entries: [
        { label: "Academics", icon: "academics", href: "/academics", permission: "academics:write", available: true },
        { label: "Staff", icon: "staff", href: "/staff", permission: "staff:write", available: true },
        { label: "Media library", icon: "media-library", href: "/media-library", permission: "media:read", available: true },
        { label: "Enquiries", icon: "enquiries", href: "/enquiries", permission: "messages:read", available: true },
      ],
    },
    {
      heading: "Settings",
      entries: [
        { label: "Site settings", icon: "settings", href: "/settings", permission: "settings:write", available: true },
        { label: "Navigation", icon: "navigation", href: "/navigation", permission: "navigation:write", available: true },
        { label: "Outbox", icon: "outbox", href: "/outbox", permission: "settings:write", available: true },
        { label: "Users", icon: "users", href: "/users", permission: "users:read", available: true },
        { label: "Audit log", icon: "audit", href: "/audit", permission: "audit:read", available: true },
      ],
    },
  ];

/** The "New…" menu in the top bar: what staff create most, by permission. */
const QUICK_ACTIONS: (QuickAction & { permission: Permission })[] = [
  { label: "News article", href: "/news/new", icon: "news", permission: "content:write" },
  { label: "Event", href: "/events/new", icon: "event", permission: "content:write" },
  { label: "Page", href: "/pages/new", icon: "page", permission: "content:write" },
  { label: "Hero slide", href: "/hero-slides/new", icon: "hero", permission: "content:write" },
  { label: "Upload photographs", href: "/media-library", icon: "media", permission: "media:write" },
  { label: "Staff profile", href: "/staff/new", icon: "user", permission: "staff:write" },
  { label: "User account", href: "/users/new", icon: "user", permission: "users:write" },
];

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  // A layout is not a security boundary in the App Router — it does not
  // re-render on navigation and does not stop children rendering — so this
  // check is for the shell only. Every page performs its own.
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Entries the role cannot use are removed here, on the server, so the
  // sidebar never advertises a page that would answer 403.
  const groups: NavGroup[] = NAV.map((group) => ({
    heading: group.heading,
    entries: group.entries.filter((entry) => hasPermission(user.role, entry.permission)),
  })).filter((group) => group.entries.length > 0);

  // What is waiting for a person, shown as small counts beside the entries
  // and listed under the top bar's bell.
  const counts = await getNavCounts(user.role);
  const quickActions = QUICK_ACTIONS.filter((action) => hasPermission(user.role, action.permission)).map(
    ({ label, href, icon }) => ({ label, href, icon }),
  );

  return (
    <AdminShellProvider>
      <div className="flex min-h-dvh flex-col lg:flex-row">
        <AdminNav
          groups={groups}
          initialCounts={counts}
          userName={user.name}
          roleLabel={ROLE_LABELS[user.role]}
          signOut={
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-md border border-white/20 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                <LogOut aria-hidden="true" className="size-4" />
                Sign out
              </button>
            </form>
          }
        />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* useSearchParams inside the search box needs a boundary. */}
          <Suspense fallback={<div className="h-14 border-b border-line bg-white" />}>
            <AdminTopbar
              quickActions={quickActions}
              counts={counts}
              userName={user.name}
              roleLabel={ROLE_LABELS[user.role]}
              signOut={
                <form action={logoutAction} className="w-full">
                  <button type="submit" className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-navy-900 hover:bg-navy-50">
                    <LogOut aria-hidden="true" className="size-4 text-ink-600" />
                    Sign out
                  </button>
                </form>
              }
            />
          </Suspense>
          <main id="main" className="min-w-0 flex-1">
            {children}
          </main>
        </div>
      </div>
    </AdminShellProvider>
  );
}
