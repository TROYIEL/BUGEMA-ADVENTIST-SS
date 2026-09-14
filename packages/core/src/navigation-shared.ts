/**
 * The menus the website renders, in the order the admin app lists them.
 * Client-safe: no database access, so the navigation editor can import it.
 *
 * UTILITY exists in the schema but nothing on the site reads it, so it is
 * not offered — a link put there would never appear anywhere.
 */
export const MENUS = {
  HEADER: {
    label: "Main menu",
    hint: "The header. Top-level links open a panel of sub-links; a highlighted link is drawn as a button.",
    nested: true,
    descriptions: true,
  },
  FOOTER_PRIMARY: {
    label: "Footer — first column",
    hint: "Usually the school's main sections.",
    nested: false,
    descriptions: false,
  },
  FOOTER_SECONDARY: {
    label: "Footer — second column",
    hint: "Usually admissions and contact.",
    nested: false,
    descriptions: false,
  },
  LEGAL: {
    label: "Footer — small print",
    hint: "Policies, shown in the bottom line of the footer.",
    nested: false,
    descriptions: false,
  },
} as const;

export type MenuKey = keyof typeof MENUS;

export const MENU_KEYS = Object.keys(MENUS) as MenuKey[];
