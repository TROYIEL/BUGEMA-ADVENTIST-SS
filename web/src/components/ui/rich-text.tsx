import { cn } from "./cn";
import { sanitizeRichText } from "@/lib/sanitize";

/**
 * Renders administrator-authored HTML.
 *
 * The string is sanitised here, at the point of rendering, in addition to
 * being sanitised when it was saved.
 */
export function RichText({
  html,
  className,
}: {
  html: string | null | undefined;
  className?: string;
}) {
  const safe = sanitizeRichText(html);
  if (!safe) return null;

  return (
    <div
      className={cn(
        "max-w-2xl text-[1.0625rem] leading-relaxed text-ink-700",
        "[&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:text-navy-900",
        "[&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:font-serif [&_h3]:text-xl [&_h3]:text-navy-900",
        "[&_h4]:mt-6 [&_h4]:mb-2 [&_h4]:font-semibold [&_h4]:text-navy-900",
        "[&_p]:mb-4",
        "[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_li]:mb-1.5 [&_li]:pl-1",
        "[&_a]:font-medium [&_a]:text-navy-700 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-navy-500",
        "[&_strong]:font-semibold [&_strong]:text-navy-900",
        "[&_blockquote]:my-6 [&_blockquote]:border-l-4 [&_blockquote]:border-gold-500 [&_blockquote]:pl-5 [&_blockquote]:font-serif [&_blockquote]:text-xl [&_blockquote]:text-navy-800",
        "[&_hr]:my-8 [&_hr]:border-line",
        // Wide tables scroll inside their own container rather than forcing the
        // whole page to scroll sideways on a phone.
        "[&_table]:my-6 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:text-[0.9375rem]",
        "[&_th]:border [&_th]:border-line [&_th]:bg-surface-sunken [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold",
        "[&_td]:border [&_td]:border-line [&_td]:px-3 [&_td]:py-2",
        "[&_figure]:my-6 [&_figcaption]:mt-2 [&_figcaption]:text-sm [&_figcaption]:text-ink-500",
        "[&_img]:h-auto [&_img]:max-w-full",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
