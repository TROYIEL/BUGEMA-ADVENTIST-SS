import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requirePagePermission } from "@/lib/auth/dal";
import { hasPermission, ROLE_LABELS } from "@/lib/auth/rbac";
import { ACTION_WORDS, entityPath, entityWords, listAuditForEntity } from "@/lib/audit-admin";
import type { AuditAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { getUser, isDeletable } from "@/lib/users-admin";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { formatDateTime } from "@/components/applications/format";
import { Breadcrumb } from "@/components/content/content-table";
import { ResetPasswordForm, UserForm } from "@/components/settings/user-forms";

import { deleteUserAction, resetPasswordAction, setActiveAction, signOutEverywhereAction, updateUserAction } from "../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const row = await getUser(id);
  return { title: row ? `Account: ${row.name}` : "Account" };
}

export default async function UserPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; created?: string; signedout?: string; refused?: string }>;
}) {
  const viewer = await requirePagePermission("users:read");
  const [{ id }, notices] = await Promise.all([params, searchParams]);
  const row = await getUser(id);
  if (!row) notFound();
  const canWrite = hasPermission(viewer.role, "users:write");
  const isSelf = row.id === viewer.id;
  // What this person has done lately, and what has been done to the account.
  const [recentActions, aboutAccount] = await Promise.all([
    db.auditLog.findMany({
      where: { actorUserId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, action: true, entityType: true, entityId: true, note: true, createdAt: true },
    }),
    listAuditForEntity("user", id, 10),
  ]);

  return (
    <div className="container-admin max-w-4xl py-8">
      <Breadcrumb items={[{ label: "Users", href: "/users" }, { label: row.name }]} />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-navy-900">{row.name}</h1>
        <Badge tone="navy">{ROLE_LABELS[row.role]}</Badge>
        {row.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Disabled</Badge>}
        {isSelf ? <Badge tone="info">This is you</Badge> : null}
      </div>
      <p className="mt-1 text-sm text-ink-600">
        {row.email} · created {formatDateTime(row.createdAt)} · last signed in {row.lastLoginAt ? formatDateTime(row.lastLoginAt) : "never"}
        {row._count.sessions > 0 ? ` · signed in now on ${row._count.sessions} ${row._count.sessions === 1 ? "device" : "devices"}` : ""}
      </p>

      {notices.created === "1" ? <Alert tone="success" className="mt-4">Account created. Pass the password on privately.</Alert> : null}
      {notices.saved === "1" ? <Alert tone="success" className="mt-4">Saved.</Alert> : null}
      {notices.signedout === "1" ? <Alert tone="success" className="mt-4">Signed out everywhere.</Alert> : null}
      {notices.refused ? <Alert tone="warning" className="mt-4" title="Not done">{notices.refused}</Alert> : null}

      {isSelf ? (
        <Alert tone="info" className="mt-4">
          Your own password is changed on <Link href="/account" className="font-semibold underline">your account page</Link>.
        </Alert>
      ) : null}

      <div className="mt-6">
        {canWrite ? (
          <UserForm action={updateUserAction.bind(null, row.id)} values={{ name: row.name, email: row.email, role: row.role }} isNew={false} isSelf={isSelf} />
        ) : null}
      </div>

      {canWrite && !isSelf ? (
        <>
          <section className="mt-8 rounded-lg border border-line bg-white">
            <div className="border-b border-line px-5 py-3">
              <h2 className="text-base font-semibold text-navy-900">Set a new password</h2>
              <p className="mt-0.5 text-sm text-ink-600">For someone who has forgotten theirs. They are signed out everywhere and use the new one.</p>
            </div>
            <div className="px-5 py-5">
              <ResetPasswordForm action={resetPasswordAction.bind(null, row.id)} />
            </div>
          </section>

          <section className="mt-8 rounded-lg border border-line bg-white">
            <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-navy-900">{row.isActive ? "Disable the account" : "Enable the account"}</h2>
                <p className="mt-0.5 text-sm text-ink-600">
                  {row.isActive ? "They are signed out everywhere and cannot sign in until it is enabled again. Nothing they did is lost." : "They can sign in again with their existing password."}
                </p>
              </div>
              <form action={setActiveAction}>
                <input type="hidden" name="id" value={row.id} />
                <input type="hidden" name="isActive" value={row.isActive ? "false" : "true"} />
                <Button type="submit" variant={row.isActive ? "danger" : "primary"} size="sm">
                  {row.isActive ? "Disable" : "Enable"}
                </Button>
              </form>
            </div>
            {row.isActive ? (
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold text-navy-900">Sign out everywhere</h2>
                  <p className="mt-0.5 text-sm text-ink-600">Ends every open session; they sign in again as usual.</p>
                </div>
                <form action={signOutEverywhereAction}>
                  <input type="hidden" name="id" value={row.id} />
                  <Button type="submit" variant="secondary" size="sm" disabled={row._count.sessions === 0}>
                    Sign out
                  </Button>
                </form>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-navy-900">Delete</h2>
                <p className="mt-0.5 text-sm text-ink-600">
                  {isDeletable(row) ? "This account has never been used, so it can be removed outright." : "This account has been used, so it is disabled rather than deleted: the audit log and reviews keep their names."}
                </p>
              </div>
              <form action={deleteUserAction}>
                <input type="hidden" name="id" value={row.id} />
                <Button type="submit" variant="danger" size="sm" disabled={!isDeletable(row)}>
                  Delete
                </Button>
              </form>
            </div>
          </section>
        </>
      ) : null}

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <History title="Recent activity" hint="The latest things this person did." entries={recentActions} />
        <History title="Account history" hint="Changes made to this account." entries={aboutAccount.map((entry) => ({ ...entry, entityType: entry.actor ? `by ${entry.actor.name}` : "" }))} plain />
      </div>
    </div>
  );
}

function History({
  title,
  hint,
  entries,
  plain = false,
}: {
  title: string;
  hint: string;
  entries: { id: string; action: string; entityType: string; entityId: string | null; note: string | null; createdAt: Date }[];
  /** The middle column is free text rather than a record to link to. */
  plain?: boolean;
}) {
  return (
    <section className="rounded-lg border border-line bg-white">
      <div className="border-b border-line px-5 py-3">
        <h2 className="text-base font-semibold text-navy-900">{title}</h2>
        <p className="mt-0.5 text-sm text-ink-600">{hint}</p>
      </div>
      {entries.length === 0 ? (
        <p className="px-5 py-4 text-sm text-ink-500">Nothing yet.</p>
      ) : (
        <ol className="divide-y divide-line text-sm">
          {entries.map((entry) => {
            const path = plain ? null : entityPath(entry.entityType, entry.entityId);
            return (
              <li key={entry.id} className="px-5 py-2.5">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium text-navy-900">{ACTION_WORDS[entry.action as AuditAction] ?? entry.action}</span>
                  {plain ? (
                    <span className="text-ink-600">{entry.entityType}</span>
                  ) : path ? (
                    <Link href={path as never} className="text-navy-800 underline-offset-4 hover:underline">
                      {entityWords(entry.entityType)}
                    </Link>
                  ) : (
                    <span className="text-ink-600">{entityWords(entry.entityType)}</span>
                  )}
                  <span className="ml-auto text-xs text-ink-500">{formatDateTime(entry.createdAt)}</span>
                </div>
                {entry.note ? <p className="mt-0.5 text-ink-600">{entry.note}</p> : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
