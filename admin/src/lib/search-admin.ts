import "server-only";

import type { UserRole } from "@/generated/prisma/enums";
import { hasPermission } from "@/lib/auth/rbac";

import { listApplications } from "./applications-admin";
import { listEvents, listNews, listPages } from "./content-admin";
import { listEnquiries, listStaff } from "./school-admin";
import { listUsers } from "./users-admin";

/**
 * One search box over every module the signed-in role may open.
 *
 * Nothing clever: each module's own list function is asked for the first few
 * matches of the same text, and each section links on to that module with
 * the query kept, where the module supports it. Modules the role cannot
 * open are not searched at all, so the result page never hints at their
 * contents.
 */

export type SearchHit = {
  href: string;
  title: string;
  meta?: string | null;
};

export type SearchSection = {
  key: string;
  label: string;
  hits: SearchHit[];
  /** Where to see every match for this module, when it has a filterable list. */
  moreHref?: string;
};

export const SEARCH_LIMIT = 5;

export async function searchEverything(query: string, role: UserRole): Promise<SearchSection[]> {
  const q = query.trim().slice(0, 120);
  if (!q) return [];
  const encoded = encodeURIComponent(q);
  const sections: (Promise<SearchSection> | SearchSection)[] = [];

  if (hasPermission(role, "applications:read")) {
    sections.push(
      listApplications({ q }, 1).then(({ rows, total }) => ({
        key: "applications",
        label: "Applications",
        hits: rows.slice(0, SEARCH_LIMIT).map((row) => ({
          href: `/applications/${row.id}`,
          title: `${row.firstName} ${row.lastName}`,
          meta: [row.referenceNumber, row.applicationClass?.name, row.academicYear?.name].filter(Boolean).join(" · "),
        })),
        moreHref: total > SEARCH_LIMIT ? `/applications?q=${encoded}` : undefined,
      })),
    );
  }

  if (hasPermission(role, "messages:read")) {
    sections.push(
      listEnquiries({ q }, 1).then(({ rows, total }) => ({
        key: "enquiries",
        label: "Enquiries",
        hits: rows.slice(0, SEARCH_LIMIT).map((row) => ({
          href: `/enquiries/${row.id}`,
          title: row.subject,
          meta: `${row.name} · ${row.email}`,
        })),
        moreHref: total > SEARCH_LIMIT ? `/enquiries?q=${encoded}` : undefined,
      })),
    );
  }

  if (hasPermission(role, "content:read")) {
    const content = (key: string, label: string, base: string, rows: Promise<{ id: string; title: string; meta: string | null; status: string }[]>) =>
      rows.then((items) => ({
        key,
        label,
        hits: items.slice(0, SEARCH_LIMIT).map((row) => ({
          href: `${base}/${row.id}`,
          title: row.title,
          meta: [row.status.toLowerCase(), row.meta].filter(Boolean).join(" · "),
        })),
        moreHref: items.length > SEARCH_LIMIT ? `${base}?q=${encoded}` : undefined,
      }));
    sections.push(content("pages", "Pages", "/pages", listPages({ q })));
    sections.push(content("news", "News", "/news", listNews({ q })));
    sections.push(content("events", "Events", "/events", listEvents({ q })));
  }

  if (hasPermission(role, "staff:write")) {
    sections.push(
      listStaff(q).then((rows) => ({
        key: "staff",
        label: "Staff",
        hits: rows.slice(0, SEARCH_LIMIT).map((row) => ({ href: `/staff/${row.id}`, title: row.name, meta: row.position })),
        moreHref: rows.length > SEARCH_LIMIT ? `/staff?q=${encoded}` : undefined,
      })),
    );
  }

  if (hasPermission(role, "users:read")) {
    sections.push(
      listUsers(q).then((rows) => ({
        key: "users",
        label: "Users",
        hits: rows.slice(0, SEARCH_LIMIT).map((row) => ({ href: `/users/${row.id}`, title: row.name, meta: row.email })),
        moreHref: rows.length > SEARCH_LIMIT ? `/users?q=${encoded}` : undefined,
      })),
    );
  }

  const resolved = await Promise.all(sections);
  return resolved.filter((section) => section.hits.length > 0);
}
