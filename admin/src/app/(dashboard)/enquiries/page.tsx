import type { Metadata } from "next";
import Link from "next/link";

import { requirePagePermission } from "@/lib/auth/dal";
import { EnquiryStatus } from "@/generated/prisma/enums";
import { listEnquiries } from "@/lib/school-admin";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label } from "@/components/ui/field";
import { Pagination, parsePageParam } from "@/components/ui/pagination";

import { formatDateTime } from "@/components/applications/format";
import { ENQUIRY_BADGES } from "@/components/school/enquiry-badges";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Enquiries" };

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;


/** Messages from the website's contact form. Spam is kept out of the main list. */
export default async function EnquiriesPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePagePermission("messages:read");
  const search = await searchParams;
  const status = one(search.status);
  const filters = { status: status && status in EnquiryStatus ? (status as EnquiryStatus) : undefined, q: one(search.q)?.slice(0, 120) };
  const page = parsePageParam(search.page);
  const { rows, total, totalPages, counts } = await listEnquiries(filters, page);

  const chip = (value: EnquiryStatus | undefined, label: string, count: number) => {
    const query = new URLSearchParams();
    if (value) query.set("status", value);
    if (filters.q) query.set("q", filters.q);
    const active = value === filters.status;
    return (
      <Link key={label} href={`/enquiries${query.toString() ? `?${query}` : ""}` as never} aria-current={active ? "page" : undefined}
        className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors", active ? "bg-navy-800 text-white ring-navy-800" : "bg-white text-navy-800 ring-line-strong hover:bg-navy-50")}>
        {label}<span className={cn("text-xs tabular-nums", active ? "text-navy-100" : "text-ink-500")}>{count}</span>
      </Link>
    );
  };

  return (
    <div className="container-admin py-8">
      <header>
        <h1 className="text-2xl font-semibold text-navy-900">Enquiries</h1>
        <p className="mt-1 text-sm text-ink-600">
          Messages sent through the website&rsquo;s contact form. {counts.UNREAD > 0 ? `${counts.UNREAD} unread.` : "Nothing unread."}
        </p>
      </header>
      {one(search.deleted) === "1" ? <Alert tone="success" className="mt-6 max-w-3xl">Enquiry deleted.</Alert> : null}

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {chip(undefined, "Inbox", counts.UNREAD + counts.READ + counts.ARCHIVED)}
          {chip(EnquiryStatus.UNREAD, "Unread", counts.UNREAD)}
          {chip(EnquiryStatus.READ, "Read", counts.READ)}
          {chip(EnquiryStatus.ARCHIVED, "Archived", counts.ARCHIVED)}
          {chip(EnquiryStatus.SPAM, "Spam", counts.SPAM)}
        </div>
        <form method="get" action="/enquiries" className="flex flex-wrap items-end gap-2">
          {filters.status ? <input type="hidden" name="status" value={filters.status} /> : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q" className="sr-only">Search</Label>
            <Input id="q" name="q" type="search" placeholder="Name, email, subject or message" defaultValue={filters.q ?? ""} className="min-w-72" />
          </div>
          <Button type="submit" size="md" variant="secondary">Search</Button>
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState className="mt-6" title={total === 0 && !filters.q ? "No enquiries" : "Nothing matches"} description={total === 0 && !filters.q ? "Messages from the contact form will appear here." : "Try another filter or search."} />
      ) : (
        <div className="mt-6 relative overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="bg-surface-sunken text-left text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">
              <tr>
                <th scope="col" className="px-4 py-3">From</th>
                <th scope="col" className="px-4 py-3">Subject</th>
                <th scope="col" className="px-4 py-3">Received</th>
                <th scope="col" className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => (
                <tr key={row.id} className={cn("hover:bg-navy-50/50", row.status === EnquiryStatus.UNREAD && "bg-gold-50/40")}>
                  <td className="px-4 py-3">
                    <Link href={`/enquiries/${row.id}`} className={cn("text-navy-900 underline decoration-navy-900/30 underline-offset-4 hover:decoration-navy-900", row.status === EnquiryStatus.UNREAD && "font-semibold")}>{row.name}</Link>
                    <p className="text-xs text-ink-500">{row.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/enquiries/${row.id}`} className="text-navy-900 underline decoration-navy-900/30 underline-offset-4 hover:decoration-navy-900">{row.subject}</Link>
                    <p className="line-clamp-1 text-xs text-ink-500">{row.body}</p>
                  </td>
                  <td className="px-4 py-3 text-ink-700">{formatDateTime(row.createdAt)}</td>
                  <td className="px-4 py-3"><Badge tone={ENQUIRY_BADGES[row.status].tone}>{ENQUIRY_BADGES[row.status].label}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination currentPage={page} totalPages={totalPages} basePath="/enquiries" searchParams={{ status: filters.status, q: filters.q }} />
    </div>
  );
}
