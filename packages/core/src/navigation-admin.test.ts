import "dotenv/config";

import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import { NavigationMenu } from "@bass/db/enums";
import { createPrismaClient } from "@bass/db/client";

import { deleteNavigationItem, isMenuKey, listNavigation, moveNavigationItem, saveNavigationItem } from "./navigation-admin";

const db = createPrismaClient();

// Every row this file makes is hidden (isActive false) and carries this tag,
// so nothing shows on the website while the tests run and the teardown
// removes only what was created here.
const TAG = `zz-test-${Math.random().toString(36).slice(2, 8)}`;
const base = { description: null, parentId: null, isActive: false, highlight: false, opensInNewTab: false };

after(async () => {
  await db.navigationItem.deleteMany({ where: { label: { startsWith: TAG } } });
  await db.$disconnect();
});

describe("menu keys", () => {
  it("accepts the menus the site renders and nothing else", () => {
    assert.equal(isMenuKey("HEADER"), true);
    assert.equal(isMenuKey("LEGAL"), true);
    assert.equal(isMenuKey("UTILITY"), false);
    assert.equal(isMenuKey("toString"), false);
  });
});

describe("nesting", () => {
  it("allows one level under the header and none elsewhere", async () => {
    const parent = await saveNavigationItem(null, { ...base, menu: "HEADER", label: `${TAG} parent`, href: "/about" });
    assert.ok(parent.ok);
    const child = await saveNavigationItem(null, { ...base, menu: "HEADER", label: `${TAG} child`, href: "/about/history", parentId: parent.row.id });
    assert.ok(child.ok);

    const grandchild = await saveNavigationItem(null, { ...base, menu: "HEADER", label: `${TAG} grandchild`, href: "/x", parentId: child.row.id });
    assert.equal(grandchild.ok, false, "a child cannot be a parent");

    const footerChild = await saveNavigationItem(null, { ...base, menu: "LEGAL", label: `${TAG} legal child`, href: "/x", parentId: parent.row.id });
    assert.equal(footerChild.ok, false, "footer menus are flat");

    const underItself = await saveNavigationItem(parent.row.id, { ...base, menu: "HEADER", label: `${TAG} parent`, href: "/about", parentId: parent.row.id });
    assert.equal(underItself.ok, false);

    const bringingChildren = await saveNavigationItem(parent.row.id, { ...base, menu: "HEADER", label: `${TAG} parent`, href: "/about", parentId: child.row.id });
    assert.equal(bringingChildren.ok, false, "a parent cannot move under another link while it has children");
  });

  it("lists children under their parent, inactive ones included", async () => {
    const tree = await listNavigation("HEADER");
    const parent = tree.find((item) => item.label === `${TAG} parent`);
    assert.ok(parent);
    assert.deepEqual(parent.children.map((child) => child.label), [`${TAG} child`]);
  });
});

describe("ordering and deletion", () => {
  it("moves a link among its siblings only, and deletes sub-links with their parent", async () => {
    const a = await saveNavigationItem(null, { ...base, menu: "FOOTER_PRIMARY", label: `${TAG} a`, href: "/a" });
    const b = await saveNavigationItem(null, { ...base, menu: "FOOTER_PRIMARY", label: `${TAG} b`, href: "/b" });
    assert.ok(a.ok && b.ok);
    assert.ok(b.row.order > a.row.order, "a new link goes last");

    await moveNavigationItem(b.row.id, "up");
    const after = await db.navigationItem.findMany({ where: { id: { in: [a.row.id, b.row.id] } }, select: { id: true, order: true } });
    const orderOf = (id: string) => after.find((row) => row.id === id)!.order;
    assert.ok(orderOf(b.row.id) < orderOf(a.row.id));

    // Moving past the end is a no-op, not an error.
    await moveNavigationItem(b.row.id, "up");
    await moveNavigationItem(b.row.id, "up");

    const tree = await listNavigation("HEADER");
    const parent = tree.find((item) => item.label === `${TAG} parent`)!;
    const deleted = await deleteNavigationItem(parent.id);
    assert.deepEqual(deleted, { label: `${TAG} parent`, children: 1 });
    assert.equal(await db.navigationItem.count({ where: { label: `${TAG} child` } }), 0, "the child went with it");
    assert.equal(await deleteNavigationItem(parent.id), null);
  });

  it("puts a link last among its new siblings when it changes menu", async () => {
    const moved = await db.navigationItem.findFirst({ where: { label: `${TAG} a` }, select: { id: true } });
    assert.ok(moved);
    const result = await saveNavigationItem(moved.id, { ...base, menu: NavigationMenu.LEGAL, label: `${TAG} a`, href: "/a" });
    assert.ok(result.ok);
    const last = await db.navigationItem.findFirst({ where: { menu: NavigationMenu.LEGAL }, orderBy: { order: "desc" }, select: { id: true } });
    assert.equal(last?.id, moved.id);
  });
});
