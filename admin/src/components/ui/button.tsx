import Link from "next/link";
import type { ComponentProps, ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "./cn";
import { HoverFill } from "./hover-fill";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "on-dark"
  | "on-dark-accent"
  | "on-dark-outline";

export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "group relative isolate inline-flex items-center justify-center gap-2.5 overflow-hidden " +
  "rounded-full font-semibold whitespace-nowrap " +
  "transition-colors duration-200 ease-[var(--ease-out-soft)] " +
  "disabled:pointer-events-none disabled:opacity-50 " +
  "aria-disabled:pointer-events-none aria-disabled:opacity-50";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-navy-700 text-white active:bg-navy-900",
  secondary:
    "bg-transparent text-navy-800 ring-2 ring-inset ring-navy-800/25 hover:text-white hover:ring-navy-800",
  ghost: "bg-transparent text-navy-800",
  danger: "bg-danger-600 text-white",
  // Gold on navy: the primary call to action on dark bands. The wipe inverts
  // it to navy, with the gold ring left showing around the edge so the
  // button keeps its identity through the transition.
  "on-dark": "bg-gold-500 text-navy-950 hover:text-gold-300 active:bg-gold-600",
  // Outlined gold — used where two dark-band actions sit together and a solid
  // fill on both would leave neither reading as primary.
  "on-dark-accent":
    "bg-transparent text-gold-300 ring-2 ring-inset ring-gold-400 hover:text-navy-950",
  "on-dark-outline":
    "bg-transparent text-white ring-2 ring-inset ring-white/60 hover:text-navy-950 hover:ring-white",
};

/**
 * The colour that wipes in on hover.
 *
 * Outlined variants fill with their own accent, so the button keeps its
 * identity. Solid variants wipe to a deeper or contrasting shade of the same
 * family — the untouched 3px band around the edge keeps the base colour
 * visible, which is what makes the effect read the same way on a filled
 * control as it does on an outlined one.
 */
const FILL_TONES: Record<ButtonVariant, string> = {
  primary: "bg-navy-950",
  secondary: "bg-navy-800",
  ghost: "bg-navy-50",
  danger: "bg-danger-700",
  "on-dark": "bg-navy-900",
  "on-dark-accent": "bg-gold-400",
  "on-dark-outline": "bg-white",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-6 text-[0.9375rem]",
  lg: "h-13 px-8 text-base",
};

function buttonClasses(
  variant: ButtonVariant,
  size: ButtonSize,
  className?: string,
) {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

/**
 * The circular arrow that accompanies calls to action. Decorative — the label
 * beside it already carries the meaning, so it is hidden from screen readers.
 */
function ArrowBadge({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative grid size-6 shrink-0 place-items-center rounded-full",
        "transition-[transform,background-color,color] duration-[350ms] ease-[var(--ease-out-soft)]",
        "group-hover:translate-x-1 group-focus-visible:translate-x-1",
        "motion-reduce:transition-none",
        className,
      )}
    >
      <svg viewBox="0 0 16 16" fill="none" className="size-3.5">
        <path
          d="M2 8h11M9 4l4 4-4 4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/**
 * Arrow disc colours, including what they become once the fill has wiped in.
 * The disc inverts against the incoming fill so it stays legible at both ends
 * of the transition.
 */
const ARROW_TONES: Record<ButtonVariant, string> = {
  primary: "bg-white/15 text-white group-hover:bg-white/25",
  secondary: "bg-navy-800/10 text-navy-800 group-hover:bg-white group-hover:text-navy-900",
  ghost: "bg-navy-800/10 text-navy-800 group-hover:bg-navy-800/15",
  danger: "bg-white/15 text-white group-hover:bg-white/25",
  // The disc would vanish once navy wipes over the gold, so it flips to gold.
  "on-dark": "bg-navy-950/15 text-navy-950 group-hover:bg-gold-400 group-hover:text-navy-950",
  "on-dark-accent":
    "bg-gold-400 text-navy-950 group-hover:bg-navy-950 group-hover:text-gold-300",
  "on-dark-outline":
    "bg-white text-navy-950 group-hover:bg-navy-950 group-hover:text-white",
};

type ButtonOwnProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  withArrow?: boolean;
  children: ReactNode;
};

function ButtonContent({
  variant,
  withArrow,
  children,
}: {
  variant: ButtonVariant;
  withArrow: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <HoverFill tone={FILL_TONES[variant]} />
      <span className="relative">{children}</span>
      {withArrow ? <ArrowBadge className={ARROW_TONES[variant]} /> : null}
    </>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  withArrow = false,
  className,
  children,
  type = "button",
  ...props
}: ButtonOwnProps & ComponentPropsWithoutRef<"button">) {
  return (
    <button type={type} className={buttonClasses(variant, size, className)} {...props}>
      <ButtonContent variant={variant} withArrow={withArrow}>
        {children}
      </ButtonContent>
    </button>
  );
}

/**
 * Mirrors whatever `next/link` accepts, so `typedRoutes` checking applies to
 * callers of this component exactly as it would to a bare <Link>.
 */
type LinkHref = ComponentProps<typeof Link>["href"];

type ButtonLinkProps = ButtonOwnProps & {
  href: LinkHref;
  className?: string;
} & Omit<ComponentPropsWithoutRef<"a">, "href" | "children">;

/** A link styled as a button. Renders an anchor, so it navigates properly. */
export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  withArrow = false,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link href={href} className={buttonClasses(variant, size, className)} {...props}>
      <ButtonContent variant={variant} withArrow={withArrow}>
        {children}
      </ButtonContent>
    </Link>
  );
}
