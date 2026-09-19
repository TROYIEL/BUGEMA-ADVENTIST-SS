import Link from "next/link";

export type Crumb = { label: string; href?: string };

/**
 * Breadcrumb trail. The current page is marked with aria-current and is not a
 * link, so assistive technology announces position without offering a
 * navigation that goes nowhere.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="border-b border-line bg-surface-raised">
      <div className="container-page">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 py-3 text-[0.8125rem]">
          <li className="flex items-center gap-2">
            <Link href="/" className="text-ink-600 hover:text-navy-700 hover:underline">
              Home
            </Link>
          </li>
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <li key={`${item.label}-${index}`} className="flex items-center gap-2">
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-3 text-ink-400">
                  <path d="m6 3 5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {isLast || !item.href ? (
                  <span aria-current={isLast ? "page" : undefined} className="font-medium text-navy-900">
                    {item.label}
                  </span>
                ) : (
                  <Link href={item.href as never} className="text-ink-600 hover:text-navy-700 hover:underline">
                    {item.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
