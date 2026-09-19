import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "./cn";

/**
 * Cards are square-cornered by design. The brief warns against "excessive
 * rounded cards"; the institutional look comes from a crisp edge, a hairline
 * rule and generous internal space rather than a large radius and a shadow.
 */
export function Card({
  className,
  interactive = false,
  ...props
}: ComponentPropsWithoutRef<"div"> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-card border border-line bg-surface-raised",
        interactive &&
          "transition-[border-color,box-shadow,transform] duration-200 ease-[var(--ease-out-soft)] hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card",
        className,
      )}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("p-6", className)} {...props} />;
}

export function CardTitle({
  as: Component = "h3",
  className,
  ...props
}: ComponentPropsWithoutRef<"h3"> & { as?: "h2" | "h3" | "h4" }) {
  return (
    <Component
      className={cn("font-serif text-xl leading-snug text-navy-900", className)}
      {...props}
    />
  );
}

export function CardMeta({ className, ...props }: ComponentPropsWithoutRef<"p">) {
  return (
    <p
      className={cn(
        "text-xs font-semibold uppercase tracking-[0.08em] text-ink-500",
        className,
      )}
      {...props}
    />
  );
}

export function CardText({ className, ...props }: ComponentPropsWithoutRef<"p">) {
  return <p className={cn("text-[0.9375rem] leading-relaxed text-ink-600", className)} {...props} />;
}

/** Section heading with the gold rule that recurs across the site. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  as: Component = "h2",
  className,
  children,
}: {
  eyebrow?: string | null;
  title: string;
  description?: string | null;
  align?: "left" | "center";
  as?: "h1" | "h2" | "h3";
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      {eyebrow ? (
        <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-navy-600">
          <span aria-hidden="true" className="h-px w-8 bg-gold-500" />
          {eyebrow}
        </p>
      ) : null}
      <Component className="max-w-3xl text-display-sm md:text-display-md ">
        {title}
      </Component>
      {description ? (
        <p className="max-w-2xl text-lg leading-relaxed text-ink-600">{description}</p>
      ) : null}
      {children}
    </div>
  );
}
