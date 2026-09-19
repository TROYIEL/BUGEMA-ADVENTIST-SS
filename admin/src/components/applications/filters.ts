import { ApplicationStatus } from "@/generated/prisma/enums";
import type { ApplicationFilters } from "@/lib/applications-admin";

/** The list's URL query, read and written in one place. */

export type Search = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw ? raw : undefined;
}

/** Only values we recognise make it into a query; anything else is dropped. */
export function readFilters(search: Search): ApplicationFilters {
  const status = one(search.status);
  const sort = one(search.sort);
  return {
    status:
      status && status in ApplicationStatus && status !== ApplicationStatus.DRAFT
        ? (status as ApplicationStatus)
        : undefined,
    academicYearId: one(search.year),
    applicationClassId: one(search.class),
    q: one(search.q)?.slice(0, 120),
    sort: sort === "oldest" || sort === "name" ? sort : "newest",
  };
}

export function queryFor(
  filters: ApplicationFilters,
  overrides: Partial<Record<string, string | undefined>> = {},
): URLSearchParams {
  const params: Record<string, string | undefined> = {
    status: filters.status,
    year: filters.academicYearId,
    class: filters.applicationClassId,
    q: filters.q,
    sort: filters.sort === "newest" ? undefined : filters.sort,
    ...overrides,
  };
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  return query;
}
