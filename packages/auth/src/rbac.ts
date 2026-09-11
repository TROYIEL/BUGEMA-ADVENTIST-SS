import { UserRole } from "@bass/db/enums";

/**
 * Every capability in the admin area. Server-side guards check these; the UI
 * only ever mirrors them. Hiding a button is never the security boundary.
 */
export const PERMISSIONS = [
  "admin:access",

  "applications:read",
  "applications:write",
  "applications:decide",
  "applications:export",
  "documents:review",

  "content:read",
  "content:write",
  "content:publish",

  "media:read",
  "media:write",
  "media:delete",

  "academics:write",
  "staff:write",
  "admissions:configure",
  "announcements:write",
  "navigation:write",

  "messages:read",
  "messages:write",

  "settings:write",
  "users:read",
  "users:write",
  "audit:read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const CONTENT_PERMISSIONS = [
  "content:read",
  "content:write",
  "content:publish",
  "media:read",
  "media:write",
  "announcements:write",
] satisfies Permission[];

const APPLICATION_PERMISSIONS = [
  "applications:read",
  "applications:write",
  "applications:decide",
  "applications:export",
  "documents:review",
  "messages:read",
  "messages:write",
] satisfies Permission[];

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  // Full control, including user management and the audit log.
  [UserRole.SUPER_ADMIN]: PERMISSIONS,

  // Runs the school's site and admissions day to day, but cannot create or
  // escalate administrator accounts.
  [UserRole.ADMIN]: [
    "admin:access",
    ...APPLICATION_PERMISSIONS,
    ...CONTENT_PERMISSIONS,
    "media:delete",
    "academics:write",
    "staff:write",
    "admissions:configure",
    "navigation:write",
    "settings:write",
    "audit:read",
  ],

  [UserRole.ADMISSIONS_OFFICER]: [
    "admin:access",
    ...APPLICATION_PERMISSIONS,
    "content:read",
    "media:read",
    "admissions:configure",
  ],

  [UserRole.CONTENT_EDITOR]: ["admin:access", ...CONTENT_PERMISSIONS],

  // Can sign in and read, nothing more, until a role is assigned.
  [UserRole.STAFF]: ["admin:access", "content:read", "media:read"],
};

export function hasPermission(
  role: UserRole,
  permission: Permission,
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function hasAnyPermission(
  role: UserRole,
  permissions: readonly Permission[],
): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: "Super administrator",
  [UserRole.ADMIN]: "Administrator",
  [UserRole.ADMISSIONS_OFFICER]: "Admissions officer",
  [UserRole.CONTENT_EDITOR]: "Content editor",
  [UserRole.STAFF]: "Staff",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]:
    "Unrestricted access, including administrator accounts and the audit log.",
  [UserRole.ADMIN]:
    "Manages applications, website content, media and site settings. Cannot manage administrator accounts.",
  [UserRole.ADMISSIONS_OFFICER]:
    "Reviews applications and documents, changes application status and contacts applicants.",
  [UserRole.CONTENT_EDITOR]:
    "Creates and publishes pages, news, events, gallery albums and announcements.",
  [UserRole.STAFF]: "Read-only access to the dashboard.",
};
