import "server-only";

import { UserRole } from "@bass/db/enums";
import type { Prisma } from "@bass/db/types";
import { db } from "@bass/db";
import { hashPassword, verifyPassword } from "@bass/auth/crypto";
import { ROLE_ORDER } from "@bass/auth/rbac";
import { revokeAllSessionsForUser, revokeOtherSessions } from "@bass/auth/session";

/**
 * Staff accounts, from the staff side.
 *
 * Accounts are disabled rather than deleted once they have been used: the
 * audit log and every "decided by" / "reviewed by" column point at them, and
 * a deletion would blank that attribution. Only an account that has never
 * signed in and never done anything can be deleted, which covers the case of
 * one created by mistake a moment ago.
 */

// A function, not a constant: the live-session count is relative to now.
function userSelect() {
  return {
    id: true,
    name: true,
    email: true,
    role: true,
    isActive: true,
    lastLoginAt: true,
    createdAt: true,
    _count: { select: { sessions: { where: { revokedAt: null, expiresAt: { gt: new Date() } } }, auditLogs: true } },
  } satisfies Prisma.UserSelect;
}

export type UserRow = Prisma.UserGetPayload<{ select: ReturnType<typeof userSelect> }>;

export async function listUsers(q?: string): Promise<UserRow[]> {
  const trimmed = q?.trim();
  const rows = await db.user.findMany({
    where: trimmed
      ? { OR: [{ name: { contains: trimmed, mode: "insensitive" } }, { email: { contains: trimmed, mode: "insensitive" } }] }
      : undefined,
    orderBy: { name: "asc" },
    select: userSelect(),
  });
  // Active accounts first, then by how much the role can do.
  return rows.sort(
    (a, b) => Number(b.isActive) - Number(a.isActive) || ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.name.localeCompare(b.name),
  );
}

export async function getUser(id: string): Promise<UserRow | null> {
  return db.user.findUnique({ where: { id }, select: userSelect() });
}

/** Whether a user can be deleted outright: never signed in, never acted. */
export function isDeletable(user: UserRow): boolean {
  return user.lastLoginAt === null && user._count.auditLogs === 0;
}

export type UserInput = {
  name: string;
  email: string;
  role: UserRole;
};

export type UserSaveResult =
  | { ok: true; id: string }
  | { ok: false; field: "email" | "role" | "isActive"; message: string };

async function emailTaken(email: string, exceptId: string | null): Promise<boolean> {
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  return Boolean(existing && existing.id !== exceptId);
}

export async function createUser(input: UserInput & { password: string }): Promise<UserSaveResult> {
  const email = input.email.toLowerCase();
  if (await emailTaken(email, null)) {
    return { ok: false, field: "email", message: "An account already uses that email address." };
  }
  const user = await db.user.create({
    data: { name: input.name, email, role: input.role, passwordHash: await hashPassword(input.password) },
    select: { id: true },
  });
  return { ok: true, id: user.id };
}

/**
 * Updates name, email and role. A demotion signs the person out everywhere,
 * so the old role's permissions cannot outlive the change in an open tab.
 */
export async function updateUser(id: string, actorId: string, input: UserInput): Promise<UserSaveResult & { roleChanged?: boolean; previousRole?: UserRole }> {
  const existing = await db.user.findUnique({ where: { id }, select: { role: true } });
  if (!existing) return { ok: false, field: "email", message: "That account no longer exists." };
  const email = input.email.toLowerCase();
  if (await emailTaken(email, id)) {
    return { ok: false, field: "email", message: "Another account already uses that email address." };
  }
  const roleChanged = existing.role !== input.role;
  if (roleChanged) {
    if (id === actorId) {
      return { ok: false, field: "role", message: "You cannot change your own role. Ask another super administrator." };
    }
    if (existing.role === UserRole.SUPER_ADMIN && !(await anotherActiveSuperAdmin(id))) {
      return { ok: false, field: "role", message: "This is the only active super administrator; make someone else one first." };
    }
  }
  await db.user.update({ where: { id }, data: { name: input.name, email, role: input.role } });
  if (roleChanged) await revokeAllSessionsForUser(id);
  return { ok: true, id, roleChanged, previousRole: existing.role };
}

async function anotherActiveSuperAdmin(exceptId: string): Promise<boolean> {
  const count = await db.user.count({ where: { role: UserRole.SUPER_ADMIN, isActive: true, id: { not: exceptId } } });
  return count > 0;
}

/** Disabling signs the person out everywhere at once. */
export async function setUserActive(id: string, actorId: string, isActive: boolean): Promise<UserSaveResult> {
  const existing = await db.user.findUnique({ where: { id }, select: { role: true, isActive: true } });
  if (!existing) return { ok: false, field: "isActive", message: "That account no longer exists." };
  if (!isActive) {
    if (id === actorId) return { ok: false, field: "isActive", message: "You cannot disable your own account." };
    if (existing.role === UserRole.SUPER_ADMIN && existing.isActive && !(await anotherActiveSuperAdmin(id))) {
      return { ok: false, field: "isActive", message: "This is the only active super administrator; make someone else one first." };
    }
  }
  await db.user.update({ where: { id }, data: { isActive } });
  if (!isActive) await revokeAllSessionsForUser(id);
  return { ok: true, id };
}

/** A new password set by an administrator; the person is signed out everywhere. */
export async function resetUserPassword(id: string, password: string): Promise<void> {
  await db.user.update({ where: { id }, data: { passwordHash: await hashPassword(password) } });
  await revokeAllSessionsForUser(id);
}

/**
 * A person changing their own password must know the current one. Their
 * other devices are signed out; the one they are using stays signed in.
 */
export async function changeOwnPassword(id: string, currentPassword: string, newPassword: string): Promise<{ ok: true; otherSessions: number } | { ok: false; message: string }> {
  const user = await db.user.findUnique({ where: { id }, select: { passwordHash: true } });
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    return { ok: false, message: "The current password is not right." };
  }
  await db.user.update({ where: { id }, data: { passwordHash: await hashPassword(newPassword) } });
  const otherSessions = await revokeOtherSessions(id);
  return { ok: true, otherSessions };
}

export async function updateOwnName(id: string, name: string): Promise<void> {
  await db.user.update({ where: { id }, data: { name } });
}

export async function deleteUser(id: string, actorId: string): Promise<UserSaveResult> {
  if (id === actorId) return { ok: false, field: "isActive", message: "You cannot delete your own account." };
  const user = await getUser(id);
  if (!user) return { ok: false, field: "isActive", message: "That account no longer exists." };
  if (!isDeletable(user)) {
    return { ok: false, field: "isActive", message: "This account has been used, so it is disabled rather than deleted." };
  }
  await db.user.delete({ where: { id } });
  return { ok: true, id };
}

export async function countUsersByRole(): Promise<Record<UserRole, number>> {
  const groups = await db.user.groupBy({ by: ["role"], where: { isActive: true }, _count: { _all: true } });
  const counts = Object.fromEntries(Object.values(UserRole).map((role) => [role, 0])) as Record<UserRole, number>;
  for (const group of groups) counts[group.role] = group._count._all;
  return counts;
}
