import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { UserRole } from "@/generated/prisma/enums";
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasAnyPermission,
  hasPermission,
  type Permission,
} from "./rbac";

describe("permission matrix", () => {
  it("gives SUPER_ADMIN every permission", () => {
    for (const permission of PERMISSIONS) {
      assert.equal(
        hasPermission(UserRole.SUPER_ADMIN, permission),
        true,
        `SUPER_ADMIN should hold ${permission}`,
      );
    }
  });

  it("lets every role reach the admin area", () => {
    for (const role of Object.values(UserRole)) {
      assert.equal(hasPermission(role, "admin:access"), true, role);
    }
  });

  it("reserves user management for SUPER_ADMIN", () => {
    // An ADMIN who could create accounts could grant themselves SUPER_ADMIN,
    // which would make the distinction meaningless.
    for (const role of Object.values(UserRole)) {
      const expected = role === UserRole.SUPER_ADMIN;
      assert.equal(hasPermission(role, "users:write"), expected, `${role} users:write`);
      assert.equal(hasPermission(role, "users:read"), expected, `${role} users:read`);
    }
  });

  it("keeps applicant data away from content editors", () => {
    const applicantPermissions: Permission[] = [
      "applications:read",
      "applications:write",
      "applications:decide",
      "applications:export",
      "documents:review",
    ];

    for (const permission of applicantPermissions) {
      assert.equal(
        hasPermission(UserRole.CONTENT_EDITOR, permission),
        false,
        `CONTENT_EDITOR must not hold ${permission}`,
      );
      assert.equal(
        hasPermission(UserRole.STAFF, permission),
        false,
        `STAFF must not hold ${permission}`,
      );
    }
  });

  it("lets admissions officers do their job and nothing more", () => {
    const role = UserRole.ADMISSIONS_OFFICER;

    assert.equal(hasPermission(role, "applications:read"), true);
    assert.equal(hasPermission(role, "applications:decide"), true);
    assert.equal(hasPermission(role, "applications:export"), true);
    assert.equal(hasPermission(role, "documents:review"), true);

    assert.equal(hasPermission(role, "content:write"), false);
    assert.equal(hasPermission(role, "settings:write"), false);
    assert.equal(hasPermission(role, "media:delete"), false);
  });

  it("lets content editors publish content but not change settings", () => {
    const role = UserRole.CONTENT_EDITOR;

    assert.equal(hasPermission(role, "content:write"), true);
    assert.equal(hasPermission(role, "content:publish"), true);
    assert.equal(hasPermission(role, "media:write"), true);
    assert.equal(hasPermission(role, "announcements:write"), true);

    assert.equal(hasPermission(role, "settings:write"), false);
    assert.equal(hasPermission(role, "media:delete"), false);
    assert.equal(hasPermission(role, "audit:read"), false);
  });

  it("gives STAFF read-only access", () => {
    const role = UserRole.STAFF;
    const granted = ROLE_PERMISSIONS[role];

    for (const permission of granted) {
      assert.ok(
        permission === "admin:access" || permission.endsWith(":read"),
        `STAFF holds a non-read permission: ${permission}`,
      );
    }
  });

  it("never grants a permission outside the declared list", () => {
    const known = new Set<string>(PERMISSIONS);
    for (const [role, granted] of Object.entries(ROLE_PERMISSIONS)) {
      for (const permission of granted) {
        assert.ok(known.has(permission), `${role} holds unknown permission ${permission}`);
      }
    }
  });

  it("has no duplicate entries in a role's permission list", () => {
    for (const [role, granted] of Object.entries(ROLE_PERMISSIONS)) {
      assert.equal(
        new Set(granted).size,
        granted.length,
        `${role} has duplicate permissions`,
      );
    }
  });
});

describe("hasAnyPermission", () => {
  it("is true when at least one permission is held", () => {
    assert.equal(
      hasAnyPermission(UserRole.CONTENT_EDITOR, ["users:write", "content:write"]),
      true,
    );
  });

  it("is false when none are held", () => {
    assert.equal(
      hasAnyPermission(UserRole.STAFF, ["users:write", "applications:decide"]),
      false,
    );
  });

  it("is false for an empty list", () => {
    assert.equal(hasAnyPermission(UserRole.SUPER_ADMIN, []), false);
  });
});
