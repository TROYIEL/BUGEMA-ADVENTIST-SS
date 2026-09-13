import type { NextRequest } from "next/server";

import { authErrorResponse, requirePermission } from "@bass/auth/dal";
import { getApplicationConfig } from "@bass/core/applications";
import { exportApplicationsCsv } from "@bass/core/applications-admin";
import { recordAudit } from "@bass/core/audit";

import { readFilters } from "@/components/applications/filters";

export const dynamic = "force-dynamic";

/**
 * The current list, as a spreadsheet. Same filters as the page, so what you
 * see is what you download. Every export is written to the audit log: this
 * is personal data about children leaving the system in bulk.
 */
export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requirePermission("applications:export");
  } catch (error) {
    return authErrorResponse(error) ?? new Response("Error", { status: 500 });
  }

  const search = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filters = readFilters(search);
  const config = await getApplicationConfig();
  const csv = await exportApplicationsCsv(filters, config.fields);

  await recordAudit({
    actorUserId: user.id,
    action: "exported",
    entityType: "application",
    newValue: { filters: JSON.parse(JSON.stringify(filters)) },
    note: `${csv.split("\r\n").length - 2} rows`,
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="applications-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
