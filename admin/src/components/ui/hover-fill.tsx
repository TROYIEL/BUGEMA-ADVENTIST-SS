import { cn } from "./cn";

/**
 * The colour wipe used on hover across the site.
 *
 * Inset from the element's own edge (3px by default), so the border — or a
 * thin band of the original background on a solid control — stays visible
 * around the fill rather than the whole shape flooding. That gap is what makes
 * the effect read as deliberate rather than as a plain background swap.
 *
 * It slides rather than scales: scaling a rounded rectangle horizontally
 * stretches its corner radius, and the pill would visibly deform mid-wipe.
 * Translating a full-size block inside an overflow-hidden mask keeps the
 * corners perfectly round throughout.
 *
 * The parent must carry `group relative isolate overflow-hidden`. Keyboard
 * users get the same treatment through `group-focus-visible`.
 */
export function HoverFill({
  tone,
  inset = "inset-[3px]",
  rounded = "rounded-full",
}: {
  /** Background utility for the incoming fill, e.g. `bg-gold-400`. */
  tone: string;
  inset?: string;
  rounded?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("absolute -z-10 overflow-hidden", inset, rounded)}
    >
      <span
        className={cn(
          "block size-full -translate-x-full",
          "transition-transform duration-[350ms] ease-[var(--ease-out-soft)]",
          "group-hover:translate-x-0 group-focus-visible:translate-x-0",
          "motion-reduce:transition-none",
          tone,
        )}
      />
    </span>
  );
}
