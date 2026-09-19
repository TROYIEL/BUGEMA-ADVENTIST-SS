import { ActorType } from "@/generated/prisma/enums";
import { describeEvent } from "@/lib/applications";
import type { StaffApplication } from "@/lib/applications-admin";
import { cn } from "@/components/ui/cn";

import { formatDateTime } from "./format";

/**
 * Every event on the application, including the ones the applicant cannot
 * see, each attributed to whoever caused it.
 */
export function Timeline({ events }: { events: StaffApplication["events"] }) {
  if (events.length === 0) {
    return <p className="text-sm text-ink-500">Nothing has happened yet.</p>;
  }

  return (
    <ol className="flex flex-col border-l-2 border-line pl-5">
      {events.map((event) => {
        const who =
          event.actorType === ActorType.STAFF
            ? (event.actor?.name ?? "Staff")
            : event.actorType === ActorType.APPLICANT
              ? "Applicant"
              : "System";

        return (
          <li key={event.id} className="relative pb-5 last:pb-0">
            <span
              aria-hidden="true"
              className={cn(
                "absolute -left-[1.6875rem] top-1.5 size-3 rounded-full ring-4 ring-[#f6f7f9]",
                event.actorType === ActorType.STAFF
                  ? "bg-navy-700"
                  : event.actorType === ActorType.APPLICANT
                    ? "bg-gold-400"
                    : "bg-ink-400",
              )}
            />
            <p className="text-sm text-navy-900">{describeEvent(event)}</p>
            {event.note ? (
              <p className="mt-1 whitespace-pre-line border-l-2 border-gold-400 pl-3 text-sm text-ink-700">
                {event.note}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-ink-500">
              {who} · {formatDateTime(event.createdAt)}
              {!event.isVisibleToApplicant ? " · staff only" : ""}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
