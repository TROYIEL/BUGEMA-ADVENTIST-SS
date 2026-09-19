import { ButtonLink } from "@bass/ui/button";

/** Rendered by `unauthorized()` — requires experimental.authInterrupts. */
export default function Unauthorized() {
  return (
    <main id="main" className="container-page flex flex-1 items-center py-24">
      <div className="flex max-w-xl flex-col gap-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-navy-600">
          401
        </p>
        <h1 className="text-display-sm md:text-display-md">Please sign in</h1>
        <p className="text-lg leading-relaxed text-ink-600">
          You need to be signed in to view this page.
        </p>
        <div className="mt-2">
          <ButtonLink href="/login" withArrow>
            Sign in
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
