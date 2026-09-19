import type { Metadata } from "next";

import { requirePageUser } from "@bass/auth/dal";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@bass/auth/rbac";
import { db } from "@bass/db";
import { Badge } from "@bass/ui/badge";

import { formatDateTime } from "@/components/applications/format";
import { ChangePasswordForm, OwnNameForm } from "@/components/settings/user-forms";

import { changeOwnPasswordAction, updateOwnNameAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your account" };

/** The signed-in person's own details. Role and email are changed by a super administrator. */
export default async function AccountPage() {
  const user = await requirePageUser();
  const sessions = await db.session.findMany({
    where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, ipAddress: true, userAgent: true },
  });

  return (
    <div className="container-admin max-w-3xl py-8">
      <header>
        <h1 className="text-2xl font-semibold text-navy-900">Your account</h1>
        <p className="mt-1 text-sm text-ink-600">
          {user.email} · <Badge tone="navy">{ROLE_LABELS[user.role]}</Badge>
        </p>
        <p className="mt-2 text-sm text-ink-600">{ROLE_DESCRIPTIONS[user.role]} Your email address and role are set by a super administrator.</p>
      </header>

      <section className="mt-6 rounded-lg border border-line bg-white">
        <div className="border-b border-line px-5 py-3">
          <h2 className="text-base font-semibold text-navy-900">Name</h2>
        </div>
        <div className="px-5 py-5">
          <OwnNameForm action={updateOwnNameAction} name={user.name} />
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-line bg-white">
        <div className="border-b border-line px-5 py-3">
          <h2 className="text-base font-semibold text-navy-900">Password</h2>
          <p className="mt-0.5 text-sm text-ink-600">Changing it signs out any other device you are using; this one stays signed in.</p>
        </div>
        <div className="px-5 py-5">
          <ChangePasswordForm action={changeOwnPasswordAction} />
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-line bg-white">
        <div className="border-b border-line px-5 py-3">
          <h2 className="text-base font-semibold text-navy-900">Where you are signed in</h2>
          <p className="mt-0.5 text-sm text-ink-600">Sessions last 12 hours. If one of these is not you, change your password.</p>
        </div>
        <ul className="divide-y divide-line text-sm">
          {sessions.map((session) => (
            <li key={session.id} className="px-5 py-3">
              <span className="font-medium text-navy-900">{formatDateTime(session.createdAt)}</span>
              <span className="text-ink-600">
                {session.ipAddress ? ` · ${session.ipAddress}` : ""}
                {session.userAgent ? ` · ${describeAgent(session.userAgent)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** A browser name from a user-agent string; enough to recognise a device. */
function describeAgent(agent: string): string {
  const browser = /Edg\//.test(agent) ? "Edge" : /Chrome\//.test(agent) ? "Chrome" : /Firefox\//.test(agent) ? "Firefox" : /Safari\//.test(agent) ? "Safari" : "Browser";
  const os = /Windows/.test(agent) ? "Windows" : /Android/.test(agent) ? "Android" : /iPhone|iPad/.test(agent) ? "iOS" : /Mac OS/.test(agent) ? "macOS" : /Linux/.test(agent) ? "Linux" : null;
  return os ? `${browser} on ${os}` : browser;
}
