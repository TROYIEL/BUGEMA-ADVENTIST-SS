import { logoutAction } from "@/app/login/actions";
import { AdminNav, type NavGroup } from "@/components/admin-nav";
import { getCurrentUser } from "@bass/auth/dal";
import { ROLE_LABELS, hasPermission, type Permission } from "@bass/auth/rbac";
import { redirect } from "next/navigation";

/**
 * The full navigation, before it is filtered for the signed-in role.
 *
 * `available` marks what has actually been built. Everything else is shown as
 * a disabled row so the shape of the system is visible without the menu
 * offering links that 404. As each module lands in milestone 4, its flag flips.
 */
const NAV: { heading: string; entries: { label: string; href: string; permission: Permission; available: boolean }[] }[] =
  [
    {
      heading: "Overview",
      entries: [{ label: "Dashboard", href: "/", permission: "admin:access", available: true }],
    },
    {
      heading: "Admissions",
      entries: [
        { label: "Applications", href: "/applications", permission: "applications:read", available: true },
        { label: "Documents", href: "/documents", permission: "documents:review", available: true },
        { label: "Requirements", href: "/requirements", permission: "admissions:configure", available: true },
        { label: "Academic years", href: "/academic-years", permission: "admissions:configure", available: true },
      ],
    },
    {
      heading: "Content",
      entries: [
        { label: "Hero slides", href: "/hero-slides", permission: "content:write", available: true },
        { label: "Pages", href: "/pages", permission: "content:write", available: true },
        { label: "News", href: "/news", permission: "content:write", available: true },
        { label: "Events", href: "/events", permission: "content:write", available: true },
        { label: "Gallery", href: "/gallery", permission: "content:write", available: true },
        { label: "Announcements", href: "/announcements", permission: "announcements:write", available: true },
      ],
    },
    {
      heading: "School",
      entries: [
        { label: "Academics", href: "/academics", permission: "academics:write", available: true },
        { label: "Staff", href: "/staff", permission: "staff:write", available: true },
        { label: "Media library", href: "/media-library", permission: "media:read", available: true },
        { label: "Enquiries", href: "/enquiries", permission: "messages:read", available: true },
      ],
    },
    {
      heading: "Settings",
      entries: [
        { label: "Site settings", href: "/settings", permission: "settings:write", available: true },
        { label: "Navigation", href: "/navigation", permission: "navigation:write", available: true },
        { label: "Users", href: "/users", permission: "users:read", available: true },
        { label: "Audit log", href: "/audit", permission: "audit:read", available: true },
      ],
    },
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

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <AdminNav
        groups={groups}
        userName={user.name}
        roleLabel={ROLE_LABELS[user.role]}
        signOut={
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full rounded-md border border-white/20 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              Sign out
            </button>
          </form>
        }
      />

      <main id="main" className="min-w-0 flex-1">
        {children}
      </main>
    </div>
  );
}
