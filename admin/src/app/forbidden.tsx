import { ButtonLink } from "@/components/ui/button";

/** Rendered by `forbidden()` — requires experimental.authInterrupts. */
export default function Forbidden() {
  return (
    <main id="main" className="container-page flex flex-1 items-center py-24">
      <div className="flex max-w-xl flex-col gap-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-navy-600">
          403
        </p>
        <h1 className="text-display-sm md:text-display-md">You do not have access</h1>
        <p className="text-lg leading-relaxed text-ink-600">
          Your account does not have permission to view this page. If you think
          this is wrong, ask a super administrator to review your role.
        </p>
        <div className="mt-2">
          <ButtonLink href="/" variant="secondary">
            Back to the dashboard
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
