import Link from "next/link";

import type { ApplicationStep } from "@/generated/prisma/enums";
import { stepOrder, type StepDefinition } from "@/lib/application-schemas";
import { cn } from "@/components/ui/cn";

/**
 * Progress through the application.
 *
 * Steps already reached are links, so an applicant can go back and change an
 * answer; steps not yet reached are plain text, because there is nothing there
 * yet to see. The current step is announced with aria-current.
 */
export function Stepper({
  steps,
  current,
  furthest,
}: {
  steps: StepDefinition[];
  current: ApplicationStep;
  furthest: ApplicationStep;
}) {
  const furthestOrder = stepOrder(furthest);

  return (
    <nav aria-label="Application steps">
      <ol className="flex flex-col gap-1">
        {steps.map((entry, index) => {
          const isCurrent = entry.step === current;
          const isDone = stepOrder(entry.step) < furthestOrder && !isCurrent;
          const reachable = stepOrder(entry.step) <= furthestOrder;

          const marker = (
            <span
              aria-hidden="true"
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold ring-2 ring-inset",
                isCurrent && "bg-navy-800 text-white ring-navy-800",
                isDone && "bg-gold-400 text-navy-950 ring-gold-400",
                !isCurrent && !isDone && "bg-transparent text-ink-500 ring-line-strong",
              )}
            >
              {isDone ? (
                <svg viewBox="0 0 16 16" fill="none" className="size-3.5">
                  <path
                    d="m3.5 8.5 3 3 6-7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                index + 1
              )}
            </span>
          );

          const label = (
            <span className="flex flex-col">
              <span
                className={cn(
                  "text-sm font-semibold",
                  isCurrent ? "text-navy-900" : reachable ? "text-navy-800" : "text-ink-500",
                )}
              >
                {entry.title}
              </span>
              {isDone ? <span className="text-xs text-ink-500">Completed</span> : null}
            </span>
          );

          return (
            <li key={entry.step}>
              {reachable && !isCurrent ? (
                <Link
                  href={`/admissions/apply/${entry.slug}`}
                  className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-navy-50"
                >
                  {marker}
                  {label}
                </Link>
              ) : (
                <span
                  aria-current={isCurrent ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-2 py-2",
                    isCurrent && "bg-navy-50",
                  )}
                >
                  {marker}
                  {label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
