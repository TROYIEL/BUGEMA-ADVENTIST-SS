import { ButtonLink } from "@/components/ui/button";

/**
 * Shown on a page the school has not written yet.
 *
 * The alternative — inventing a history, a mission statement or a policy —
 * is not acceptable, and a blank page is not either. This states the position
 * plainly and offers somewhere useful to go instead.
 */
export function ContentPending({ what }: { what: string }) {
  return (
    <div className="flex max-w-2xl flex-col gap-5 border-l-4 border-gold-500 bg-surface-sunken px-6 py-8">
      <p className="font-serif text-xl text-navy-900">
        This information is being prepared
      </p>
      <p className="leading-relaxed text-ink-600">
        {what} will be published here shortly. In the meantime, the school
        office will be glad to answer any questions.
      </p>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/contact" withArrow>
          Contact the school
        </ButtonLink>
        <ButtonLink href="/admissions" variant="secondary">
          Admissions
        </ButtonLink>
      </div>
    </div>
  );
}
