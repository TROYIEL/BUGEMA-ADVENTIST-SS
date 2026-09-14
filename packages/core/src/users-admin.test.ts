import "dotenv/config";

import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import { UserRole } from "@bass/db/enums";
import { createPrismaClient } from "@bass/db/client";
import { verifyPassword } from "@bass/auth/crypto";

import { createUser, deleteUser, getUser, isDeletable, listUsers, resetUserPassword, setUserActive, updateUser } from "./users-admin";

const db = createPrismaClient();

// Test accounts carry a random tag in their address; only those are removed.
const TAG = `zz-test-${Math.random().toString(36).slice(2, 8)}`;
const email = (name: string) => `${TAG}-${name}@bass.example.com`;

after(async () => {
  await db.auditLog.deleteMany({ where: { actor: { email: { startsWith: TAG } } } });
  await db.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await db.$disconnect();
});

describe("accounts", () => {
  it("creates an account with a hashed password and a lower-cased address", async () => {
    const created = await createUser({ name: `${TAG} One`, email: email("One").toUpperCase(), role: UserRole.STAFF, password: "Zz-Test-Password-1" });
    assert.ok(created.ok);
    const row = await db.user.findUnique({ where: { id: created.id }, select: { email: true, passwordHash: true } });
    assert.equal(row?.email, email("one"));
    assert.ok(row && (await verifyPassword("Zz-Test-Password-1", row.passwordHash)));

    const duplicate = await createUser({ name: "Again", email: email("ONE"), role: UserRole.STAFF, password: "Zz-Test-Password-1" });
    assert.equal(duplicate.ok, false);
  });

  it("refuses to let someone change their own role or disable themselves", async () => {
    const me = await db.user.findUnique({ where: { email: email("one") }, select: { id: true } });
    assert.ok(me);
    const role = await updateUser(me.id, me.id, { name: "Me", email: email("one"), role: UserRole.ADMIN });
    assert.equal(role.ok, false);
    const disable = await setUserActive(me.id, me.id, false);
    assert.equal(disable.ok, false);
    // A name change alone is fine.
    const rename = await updateUser(me.id, me.id, { name: `${TAG} Renamed`, email: email("one"), role: UserRole.STAFF });
    assert.ok(rename.ok && !rename.roleChanged);
  });

  it("signs a person out everywhere when their role changes or the account is disabled", async () => {
    const other = await createUser({ name: `${TAG} Two`, email: email("two"), role: UserRole.STAFF, password: "Zz-Test-Password-1" });
    assert.ok(other.ok);
    const actor = (await db.user.findUnique({ where: { email: email("one") }, select: { id: true } }))!;
    const session = () => db.session.create({ data: { userId: other.id, tokenHash: `${TAG}-${Math.random()}`, expiresAt: new Date(Date.now() + 60_000) } });
    const live = () => db.session.count({ where: { userId: other.id, revokedAt: null } });

    await session();
    const promoted = await updateUser(other.id, actor.id, { name: `${TAG} Two`, email: email("two"), role: UserRole.CONTENT_EDITOR });
    assert.ok(promoted.ok && promoted.roleChanged && promoted.previousRole === UserRole.STAFF);
    assert.equal(await live(), 0);

    await session();
    assert.ok((await setUserActive(other.id, actor.id, false)).ok);
    assert.equal(await live(), 0);
    assert.equal((await getUser(other.id))?.isActive, false);
    assert.ok((await setUserActive(other.id, actor.id, true)).ok);

    await session();
    await resetUserPassword(other.id, "Zz-Test-Password-2");
    assert.equal(await live(), 0);
  });

  it("only deletes an account that was never used", async () => {
    const actor = (await db.user.findUnique({ where: { email: email("one") }, select: { id: true } }))!;
    const other = (await db.user.findUnique({ where: { email: email("two") }, select: { id: true } }))!;
    assert.ok(isDeletable((await getUser(other.id))!));
    assert.equal((await deleteUser(other.id, other.id)).ok, false, "not yourself");

    await db.user.update({ where: { id: other.id }, data: { lastLoginAt: new Date() } });
    assert.equal(isDeletable((await getUser(other.id))!), false);
    assert.equal((await deleteUser(other.id, actor.id)).ok, false);

    await db.user.update({ where: { id: other.id }, data: { lastLoginAt: null } });
    assert.ok((await deleteUser(other.id, actor.id)).ok);
    assert.equal(await getUser(other.id), null);
  });

  it("lists active accounts first, most privileged first", async () => {
    const rows = (await listUsers(TAG)).map((row) => row.role);
    assert.deepEqual(rows, [UserRole.STAFF]);
    const all = await listUsers();
    const firstDisabled = all.findIndex((row) => !row.isActive);
    const lastActive = all.map((row) => row.isActive).lastIndexOf(true);
    assert.ok(firstDisabled === -1 || firstDisabled > lastActive);
  });
});
