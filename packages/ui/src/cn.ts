import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge has to be told about the custom display sizes declared in
 * globals.css (`--text-display-sm` … `--text-display-xl`).
 *
 * Without this it does not recognise `display-sm` as a font size, classifies
 * `text-display-sm` as a text COLOUR, and silently drops any real colour
 * alongside it:
 *
 *   twMerge("text-white", "text-display-sm")  ->  "text-display-sm"
 *
 * That is not a cosmetic quirk. It is how the page heading ended up navy on a
 * navy band — the colour was removed, so the element fell back to the base
 * layer's `h1 { color: navy }` and became invisible.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["display-sm", "display-md", "display-lg", "display-xl"] },
      ],
    },
  },
});

/**
 * Merges class names, letting a caller's utility override a component's
 * default rather than both landing in the class list and the winner being
 * decided by stylesheet order.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
