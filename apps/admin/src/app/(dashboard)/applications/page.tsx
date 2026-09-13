import type { Metadata } from "next";
import Link from "next/link";

import { requirePagePermission } from "@bass/auth/dal";
import { hasPermission } from "@bass/auth/rbac";
import { ApplicationStatus } from "@bass/db/enums";
import {
  countApplicationsByStatus,
  listApplications,
  listFilterOptions,
} from "@bass/core/applications-admin";
import { Button, ButtonLink } from "@bass/ui/button";
import { cn } from "@bass/ui/cn";
import { EmptyState } from "@bass/ui/empty-state";
import { Input, Label, Select } from "@bass/ui/field";
import { Pagination, parsePageParam } from "@bass/ui/pagination";

import { queryFor, readFilters, type Search } from "@/components/applications/filters";
import { formatDay, fullName } from "@/components/applications/format";
import { STAFF_STATUS_LABELS, StatusBadge } from "@/components/applications/status-badge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Applications" };

/** The chip order follows the life of an application. */
const CHIP_ORDER: ApplicationStatus[] = [
  ApplicationStatus.SUBMITTED,
  ApplicationStatus.UNDER_REVIEW,
  ApplicationStatus.DOCUMENTS_REQUIRED,
  ApplicationStatus.SHORTLISTED,
  ApplicationStatus.ACCEPTED,
  ApplicationStatus.CONDITIONALLY_ACCEPTED,
  ApplicationStatus.REJECTED,
  ApplicationStatus.WITHDRAWN,
];

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const user = await requirePagePermission("applications:read");
  const search = await searchParams;
  const filters = readFilters(search);
  const page = parsePageParam(search.page);

  const [{ rows, total, totalPages }, counts, options] = await Promise.all([
    listApplications(filters, page),
    countApplicationsByStatus(filters),
    listFilterOptions(),
  ]);

  const allCount = CHIP_ORDER.reduce((sum, status) => sum + counts[status], 0);
  const canExport = hasPermission(user.role, "applications:export");
  const exportQuery = queryFor(filters).toString();

  return (
    <div className="container-admin py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">Applications</h1>
          <p className="mt-1 text-sm text-ink-600">
            {total} {total === 1 ? "application" : "applications"}
            {filters.status || filters.q || filters.academicYearId || filters.applicationClassId
              ? " match these filters"
              : " submitted"}
            {counts.DRAFT > 0 ? ` · ${counts.DRAFT} in progress, not yet submitted` : ""}
          </p>
        </div>
        {canExport ? (
          <ButtonLink
            href={`/applications/export${exportQuery ? `?${exportQuery}` : ""}` as never}
            variant="secondary"
            size="sm"
          >
            Export CSV
          </ButtonLink>
        ) : null}
      </header>

      {/* Status chips: links, so they can be bookmarked and shared. */}
      <nav aria-label="Filter by status" className="mt-6 flex flex-wrap gap-2">
        <Chip
          href={`/applications?${queryFor(filters, { status: undefined })}`}
          active={!filters.status}
          label="All"
          count={allCount}
        />
        {CHIP_ORDER.map((status) => (
          <Chip
            key={status}
            href={`/applications?${queryFor(filters, { status })}`}
            active={filters.status === status}
            label={STAFF_STATUS_LABELS[status]}
            count={counts[status]}
          />
        ))}
      </nav>

      <form
        method="get"
        action="/applications"
        className="mt-5 grid gap-3 rounded-lg border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] lg:items-end"
      >
        {filters.status ? <input type="hidden" name="status" value={filters.status} /> : null}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="q">Search</Label>
          <Input
            id="q"
            name="q"
            type="search"
            placeholder="Reference, applicant or guardian"
            defaultValue={filters.q ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="year">Academic year</Label>
          <Select id="year" name="year" defaultValue={filters.academicYearId ?? ""}>
            <option value="">All years</option>
            {options.years.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="class">Class</Label>
          <Select id="class" name="class" defaultValue={filters.applicationClassId ?? ""}>
            <option value="">All classes</option>
            {options.classes.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sort">Order</Label>
          <Select id="sort" name="sort" defaultValue={filters.sort ?? "newest"}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">By surname</option>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <Button type="submit" size="md">
            Apply
          </Button>
          <Link
            href="/applications"
            className="px-2 py-2 text-sm font-semibold text-navy-800 underline-offset-4 hover:underline"
          >
            Clear
          </Link>
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          className="mt-6"
          title={total === 0 && !filters.q && !filters.status ? "No applications yet" : "Nothing matches"}
          description={
            total === 0 && !filters.q && !filters.status
              ? "Applications submitted through the website will appear here."
              : "Try clearing a filter or checking the spelling of the name."
          }
        />
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="bg-surface-sunken text-left text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">
              <tr>
                <th scope="col" className="px-4 py-3">Reference</th>
                <th scope="col" className="px-4 py-3">Applicant</th>
                <th scope="col" className="px-4 py-3">Class</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Submitted</th>
                <th scope="col" className="px-4 py-3">Documents</th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-navy-50/50">
                  <td className="px-4 py-3 font-mono text-[0.8125rem] text-navy-900">
                    <Link href={`/applications/${row.id}`} className="hover:underline">
                      {row.referenceNumber ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/applications/${row.id}`} className="font-medium text-navy-900 hover:underline">
                      {fullName(row)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-700">
                    {row.applicationClass?.name ?? "—"}
                    <span className="text-ink-500"> · {row.academicYear.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-ink-700">{formatDay(row.submittedAt) || "—"}</td>
                  <td className="px-4 py-3 text-ink-700">
                    {row._count.documents}
                    {row.documents.length > 0 ? (
                      <span className="ml-2 rounded-full bg-gold-50 px-2 py-0.5 text-xs font-semibold text-gold-800 ring-1 ring-inset ring-gold-200">
                        {row.documents.length} to review
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/applications/${row.id}`}
                      className="text-sm font-semibold text-navy-800 hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        basePath="/applications"
        searchParams={Object.fromEntries(queryFor(filters))}
      />
    </div>
  );
}

function Chip({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href as never}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors",
        active
          ? "bg-navy-800 text-white ring-navy-800"
          : "bg-white text-navy-800 ring-line-strong hover:bg-navy-50",
      )}
    >
      {label}
      <span className={cn("text-xs tabular-nums", active ? "text-navy-100" : "text-ink-500")}>
        {count}
      </span>
    </Link>
  );
}
