import type { Metadata } from "next";

import { requirePagePermission } from "@/lib/auth/dal";
import { listAcademicYears } from "@/lib/admissions-config";
import { getAdmissionsWindow } from "@/lib/applications";
import { formatDate } from "@/lib/content";
import { getSiteSettings, readBooleanSetting } from "@/lib/settings";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { AcademicYearForm } from "@/components/config/forms";
import { ConfigRow, ConfigSection, DeleteControl } from "@/components/config/layout";

import { activateYearAction, deleteYearAction, saveYearAction, setMasterSwitchAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Academic years" };

function toDateInput(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

/** A closing date is stored as the end of that day in Kampala; show the day. */
function toKampalaDateInput(date: Date | null): string {
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kampala", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  return parts;
}

/**
 * The years applications are taken for, and the two switches that open the
 * online form: the site-wide one, and the active year's own.
 */
export default async function AcademicYearsPage() {
  await requirePagePermission("admissions:configure");
  const [years, settings, window] = await Promise.all([
    listAcademicYears(),
    getSiteSettings(),
    getAdmissionsWindow(),
  ]);
  const masterOpen = readBooleanSetting(settings, "admissions.isOpen");
  const active = years.find((year) => year.isActive) ?? null;

  return (
    <div className="container-admin max-w-5xl py-8">
      <header>
        <h1 className="text-2xl font-semibold text-navy-900">Academic years</h1>
        <p className="mt-1 text-sm text-ink-600">
          Applications are filed under the active year. The online form is open only
          when the site-wide switch and the active year&rsquo;s own switch are both on,
          within that year&rsquo;s opening and closing dates if it has them.
        </p>
      </header>

      <section className="mt-6 grid gap-4 rounded-lg border border-line bg-white p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-navy-900">Online applications</h2>
            {window.isOpen ? <Badge tone="success">Open</Badge> : <Badge tone="warning">Closed</Badge>}
          </div>
          <p className="mt-1 text-sm text-ink-600">
            Site-wide switch: <strong>{masterOpen ? "on" : "off"}</strong>
            {" · "}
            Active year: <strong>{active ? active.name : "none"}</strong>
            {active ? (
              <>
                {" · "}
                {active.isAcceptingApplications ? "taking applications" : "not taking applications"}
                {active.applicationOpensAt ? ` · from ${formatDate(active.applicationOpensAt)}` : ""}
                {active.applicationClosesAt ? ` · until ${formatDate(active.applicationClosesAt)}` : ""}
              </>
            ) : null}
          </p>
        </div>
        <form action={setMasterSwitchAction}>
          <input type="hidden" name="open" value={masterOpen ? "false" : "true"} />
          <Button type="submit" variant={masterOpen ? "secondary" : "primary"} size="sm">
            {masterOpen ? "Turn the site-wide switch off" : "Turn the site-wide switch on"}
          </Button>
        </form>
      </section>

      {!active ? (
        <Alert tone="warning" className="mt-4">
          No year is active, so nobody can apply. Make one active below.
        </Alert>
      ) : null}

      <div className="mt-6">
        <ConfigSection
          id="years"
          title="Years"
          hint="Newest first. A year with applications cannot be deleted; it is the record of that intake."
          add={
            <AcademicYearForm
              action={saveYearAction.bind(null, null)}
              values={{ name: "", startDate: "", endDate: "", isAcceptingApplications: false, applicationOpensAt: "", applicationClosesAt: "" }}
              submitLabel="Add year"
            />
          }
        >
          {years.map((year) => (
            <ConfigRow
              key={year.id}
              title={year.name}
              badges={
                <>
                  {year.isActive ? <Badge tone="success">Active</Badge> : null}
                  {year.isAcceptingApplications ? <Badge tone="gold">Taking applications</Badge> : null}
                </>
              }
              meta={[
                year.startDate || year.endDate
                  ? `${formatDate(year.startDate) || "…"} – ${formatDate(year.endDate) || "…"}`
                  : null,
                year.applicationOpensAt || year.applicationClosesAt
                  ? `applications ${year.applicationOpensAt ? `from ${formatDate(year.applicationOpensAt)}` : ""}${year.applicationClosesAt ? ` until ${formatDate(year.applicationClosesAt)}` : ""}`.trim()
                  : null,
                `${year._count.applications} ${year._count.applications === 1 ? "application" : "applications"}`,
              ]
                .filter(Boolean)
                .join(" · ")}
              editor={
                <AcademicYearForm
                  action={saveYearAction.bind(null, year.id)}
                  values={{
                    name: year.name,
                    startDate: toDateInput(year.startDate),
                    endDate: toDateInput(year.endDate),
                    isAcceptingApplications: year.isAcceptingApplications,
                    applicationOpensAt: toKampalaDateInput(year.applicationOpensAt),
                    applicationClosesAt: toKampalaDateInput(year.applicationClosesAt),
                  }}
                  submitLabel="Save"
                />
              }
              controls={
                <>
                  {!year.isActive ? (
                    <form action={activateYearAction}>
                      <input type="hidden" name="id" value={year.id} />
                      <button type="submit" className="rounded-md px-2 py-1 text-sm font-semibold text-navy-800 hover:underline">
                        Make active
                      </button>
                    </form>
                  ) : null}
                  <DeleteControl
                    action={deleteYearAction}
                    id={year.id}
                    label={year.name}
                    disabledReason={
                      year._count.applications > 0
                        ? "This year has applications."
                        : year.isActive
                          ? "Make another year active first."
                          : null
                    }
                  />
                </>
              }
            />
          ))}
        </ConfigSection>
      </div>
    </div>
  );
}
