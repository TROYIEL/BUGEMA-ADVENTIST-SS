import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { requirePagePermission } from "@bass/auth/dal";
import { listStaff } from "@bass/core/school-admin";
import { Alert } from "@bass/ui/alert";
import { Badge } from "@bass/ui/badge";
import { Button, ButtonLink } from "@bass/ui/button";
import { EmptyState } from "@bass/ui/empty-state";
import { Input, Label } from "@bass/ui/field";

import { moveStaffAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Staff" };

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

/** The people on the website's leadership and staff pages, in the order shown. */
export default async function StaffPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePagePermission("staff:write");
  const search = await searchParams;
  const q = one(search.q);
  const rows = await listStaff(q);

  return (
    <div className="container-admin max-w-5xl py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">Staff</h1>
          <p className="mt-1 text-sm text-ink-600">{rows.length} {rows.length === 1 ? "person" : "people"}. Leadership first, then everyone else, in the order shown on the website.</p>
        </div>
        <ButtonLink href="/staff/new" size="sm" withArrow>New profile</ButtonLink>
      </header>
      {one(search.deleted) === "1" ? <Alert tone="success" className="mt-6 max-w-3xl">Profile deleted.</Alert> : null}

      <form method="get" action="/staff" className="mt-6 flex items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="q" className="sr-only">Search</Label>
          <Input id="q" name="q" type="search" placeholder="Name, position or department" defaultValue={q ?? ""} className="min-w-72" />
        </div>
        <Button type="submit" size="md" variant="secondary">Search</Button>
        {q ? <Link href="/staff" className="px-2 py-2 text-sm font-semibold text-navy-800 hover:underline">Clear</Link> : null}
      </form>

      {rows.length === 0 ? (
        <EmptyState className="mt-6" title={q ? "Nobody matches" : "No profiles yet"} description={q ? "Try another search." : "Add the leadership team and staff to show them on the website."} />
      ) : (
        <ol className="mt-6 divide-y divide-line rounded-lg border border-line bg-white">
          {rows.map((person, index) => (
            <li key={person.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
              <div className="relative size-12 shrink-0 overflow-hidden rounded-full bg-surface-sunken">
                {person.photo ? <Image src={`/media/${person.photo.storageKey}`} alt="" fill sizes="3rem" className="object-cover" /> : <span className="grid size-full place-items-center text-xs text-ink-400">—</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/staff/${person.id}`} className="font-medium text-navy-900 hover:underline">{person.name}</Link>
                  {person.isLeadership ? <Badge tone="gold">Leadership</Badge> : null}
                  {!person.isVisible ? <Badge tone="neutral">Hidden</Badge> : null}
                </div>
                <p className="mt-0.5 text-sm text-ink-600">
                  {[person.position, person.department, person._count.headedDepartments ? `heads ${person._count.headedDepartments}` : null, person._count.taughtSubjects ? `leads ${person._count.taughtSubjects} ${person._count.taughtSubjects === 1 ? "subject" : "subjects"}` : null].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {(["up", "down"] as const).map((direction) => (
                  <form key={direction} action={moveStaffAction}>
                    <input type="hidden" name="id" value={person.id} />
                    <input type="hidden" name="direction" value={direction} />
                    <button type="submit" disabled={direction === "up" ? index === 0 : index === rows.length - 1} aria-label={`Move ${person.name} ${direction}`} className="grid size-7 place-items-center rounded-md border border-line text-navy-800 hover:bg-navy-50 disabled:opacity-30">
                      {direction === "up" ? "↑" : "↓"}
                    </button>
                  </form>
                ))}
                <Link href={`/staff/${person.id}`} className="ml-2 text-sm font-semibold text-navy-800 hover:underline">Edit</Link>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
