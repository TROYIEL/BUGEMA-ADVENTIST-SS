import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="container-page flex flex-1 items-center py-24">
      <div className="flex max-w-xl flex-col gap-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-navy-600">
          404
        </p>
        <h1 className="text-display-sm md:text-display-md">Page not found</h1>
        <p className="text-lg leading-relaxed text-ink-600">
          The page you were looking for may have been moved or removed.
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          <ButtonLink href="/" withArrow>
            Back to the homepage
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
