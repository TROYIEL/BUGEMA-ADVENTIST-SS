import type { Metadata } from "next";
import Link from "next/link";

import { requirePagePermission } from "@/lib/auth/dal";
import { hasPermission, ROLE_LABELS } from "@/lib/auth/rbac";
import { listUsers } from "@/lib/users-admin";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

import { formatDateTime } from "@/components/applications/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Users" };

/** Who can sign in to this admin app, and what each can do. */
export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; deleted?: string }> }) {
  const user = await requirePagePermission("users:read");
  const { q = "", deleted } = await searchParams;
  const rows = await listUsers(q);
  const canWrite = hasPermission(user.role, "users:write");
  const active = rows.filter((row) => row.isActive).length;

  return (
    <div className="container-admin max-w-5xl py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">Users</h1>
          <p className="mt-1 text-sm text-ink-600">
            {active} active {active === 1 ? "account" : "accounts"}
            {rows.length > active ? `, ${rows.length - active} disabled` : ""}. Accounts that have been used are disabled rather than deleted, so the audit log keeps its names.
          </p>
        </div>
        {canWrite ? (
          <ButtonLink href="/users/new" withArrow>
            New account
          </ButtonLink>
        ) : null}
      </header>

      {deleted === "1" ? <Alert tone="success" className="mt-4">Account deleted.</Alert> : null}

      <form className="mt-6 flex flex-wrap gap-2" role="search">
        <Input type="search" name="q" defaultValue={q} placeholder="Name or email" aria-label="Search accounts" className="w-72 max-w-full" />
        <button type="submit" className="rounded-full border border-navy-800 px-4 py-2 text-sm font-semibold text-navy-800 hover:bg-navy-50">
          Search
        </button>
      </form>

      <div className="mt-6 relative overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-surface-sunken text-left text-xs uppercase tracking-wide text-ink-600">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Last signed in</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-ink-500">
                  No accounts match.
                </td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.id} className={row.isActive ? undefined : "opacity-60"}>
                <td className="px-4 py-3">
                  <Link href={`/users/${row.id}`} className="font-medium text-navy-900 hover:underline">
                    {row.name}
                  </Link>
                  {row.id === user.id ? <span className="ml-2 text-xs text-ink-500">(you)</span> : null}
                  <div className="text-xs text-ink-500">{row.email}</div>
                </td>
                <td className="px-4 py-3">
                  <Badge tone="navy">{ROLE_LABELS[row.role]}</Badge>
                </td>
                <td className="px-4 py-3 text-ink-700">
                  {row.lastLoginAt ? formatDateTime(row.lastLoginAt) : <span className="text-ink-500">Never</span>}
                  {row._count.sessions > 0 ? <div className="text-xs text-ink-500">Signed in now</div> : null}
                </td>
                <td className="px-4 py-3">{row.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Disabled</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
