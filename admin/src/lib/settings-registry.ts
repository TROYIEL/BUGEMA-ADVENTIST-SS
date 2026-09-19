/**
 * Site settings.
 *
 * The registry below is the single source of truth for what is configurable:
 * the seed script creates a row per entry, the admin UI is generated from it,
 * and the public site reads values through it.
 *
 * `seeded: true` marks the handful of facts that are genuinely known. Every
 * other entry starts life as an unconfigured placeholder. Nothing about the
 * school — no phone number, no address, no motto, no founding date — is
 * invented here. `isConfigured` stays false until a human enters a real value,
 * which is what drives the admin "Complete your site" checklist and what stops
 * the public site rendering a fabricated detail.
 */

export type SettingType =
  | "text"
  | "textarea"
  | "email"
  | "tel"
  | "url"
  | "image"
  | "boolean";

export type SettingGroup =
  | "identity"
  | "homepage"
  | "contact"
  | "social"
  | "seo"
  | "footer"
  | "admissions";

export type SettingDefinition = {
  group: SettingGroup;
  label: string;
  description?: string;
  type: SettingType;
  default: string | boolean;
  /** True when the default is a real, verified value rather than a placeholder. */
  seeded?: boolean;
  order: number;
};

export const SETTING_GROUP_LABELS: Record<SettingGroup, string> = {
  identity: "School identity",
  homepage: "Homepage imagery",
  contact: "Contact details",
  social: "Social media",
  seo: "Search engine defaults",
  footer: "Footer",
  admissions: "Admissions",
};

const REGISTRY = {
  // --- Identity -----------------------------------------------------------
  "school.name": {
    group: "identity",
    label: "Full school name",
    type: "text",
    default: "Bugema Adventist Secondary School",
    seeded: true,
    order: 10,
  },
  "school.shortName": {
    group: "identity",
    label: "Short name",
    description: "Used in navigation and tight spaces.",
    type: "text",
    default: "BASS",
    seeded: true,
    order: 20,
  },
  "school.motto": {
    group: "identity",
    label: "School motto",
    description: "The school's official motto, exactly as it appears on the crest.",
    type: "text",
    default: "",
    order: 30,
  },
  "school.tagline": {
    group: "identity",
    label: "Tagline",
    description: "One short line used beneath the school name on the homepage.",
    type: "text",
    default: "",
    order: 40,
  },
  "school.logo": {
    group: "identity",
    label: "School crest / logo",
    description:
      "Upload the official crest. Until one is supplied the site uses a plain typographic placeholder.",
    type: "image",
    default: "",
    order: 50,
  },

  // --- Homepage -----------------------------------------------------------
  //
  // The homepage layout is fixed in code. These choose which photographs it
  // uses, so the school can refresh the front page without a deployment.
  "home.heroImage": {
    group: "homepage",
    label: "Hero background photograph",
    description: "Sits behind the headline, heavily darkened.",
    type: "image",
    default: "",
    order: 10,
  },
  "home.heroCollageOne": {
    group: "homepage",
    label: "Hero collage — first photograph",
    type: "image",
    default: "",
    order: 20,
  },
  "home.heroCollageTwo": {
    group: "homepage",
    label: "Hero collage — second photograph",
    type: "image",
    default: "",
    order: 30,
  },
  "home.heroCollageThree": {
    group: "homepage",
    label: "Hero collage — third photograph",
    type: "image",
    default: "",
    order: 40,
  },
  "home.aboutImage": {
    group: "homepage",
    label: "About section photograph",
    description: "The large image in the coloured band partway down the page.",
    type: "image",
    default: "",
    order: 50,
  },

  // --- Contact ------------------------------------------------------------
  "contact.email": {
    group: "contact",
    label: "General email address",
    type: "email",
    default: "",
    order: 10,
  },
  "contact.phone": {
    group: "contact",
    label: "Main telephone number",
    type: "tel",
    default: "",
    order: 20,
  },
  "contact.altPhone": {
    group: "contact",
    label: "Alternative telephone number",
    type: "tel",
    default: "",
    order: 30,
  },
  "contact.postalAddress": {
    group: "contact",
    label: "Postal address",
    description: "For example, the school's P.O. Box.",
    type: "text",
    default: "",
    order: 40,
  },
  "contact.physicalAddress": {
    group: "contact",
    label: "Physical address",
    description: "Where visitors should go. Shown on the contact page.",
    type: "textarea",
    default: "",
    order: 50,
  },
  "contact.officeHours": {
    group: "contact",
    label: "Office hours",
    type: "textarea",
    default: "",
    order: 60,
  },
  "contact.mapEmbedUrl": {
    group: "contact",
    label: "Map embed URL",
    description:
      "Optional. Paste the embed URL from Google Maps to show a map on the contact page.",
    type: "url",
    default: "",
    order: 70,
  },

  // --- Social -------------------------------------------------------------
  "social.facebook": {
    group: "social",
    label: "Facebook page URL",
    type: "url",
    default: "",
    order: 10,
  },
  "social.instagram": {
    group: "social",
    label: "Instagram profile URL",
    type: "url",
    default: "",
    order: 20,
  },
  "social.x": {
    group: "social",
    label: "X (Twitter) profile URL",
    type: "url",
    default: "",
    order: 30,
  },
  "social.youtube": {
    group: "social",
    label: "YouTube channel URL",
    type: "url",
    default: "",
    order: 40,
  },
  "social.linkedin": {
    group: "social",
    label: "LinkedIn page URL",
    type: "url",
    default: "",
    order: 50,
  },

  // --- SEO ----------------------------------------------------------------
  "seo.defaultTitle": {
    group: "seo",
    label: "Default page title",
    type: "text",
    default: "Bugema Adventist Secondary School",
    seeded: true,
    order: 10,
  },
  "seo.titleTemplate": {
    group: "seo",
    label: "Title template",
    description: "Use %s where the page title should appear.",
    type: "text",
    default: "%s | Bugema Adventist Secondary School",
    seeded: true,
    order: 20,
  },
  "seo.defaultDescription": {
    group: "seo",
    label: "Default meta description",
    description:
      "Shown in search results for pages without their own description. Should describe the school in about 150 characters.",
    type: "textarea",
    default: "",
    order: 30,
  },
  "seo.ogImage": {
    group: "seo",
    label: "Default social sharing image",
    type: "image",
    default: "",
    order: 40,
  },

  // --- Footer -------------------------------------------------------------
  "footer.description": {
    group: "footer",
    label: "Footer description",
    description: "A short paragraph about the school, shown in the footer.",
    type: "textarea",
    default: "",
    order: 10,
  },
  "footer.copyright": {
    group: "footer",
    label: "Copyright holder",
    description: "The year is added automatically.",
    type: "text",
    default: "Bugema Adventist Secondary School",
    seeded: true,
    order: 20,
  },

  // --- Admissions ---------------------------------------------------------
  "admissions.isOpen": {
    group: "admissions",
    label: "Applications are open",
    description:
      "Turns the online application form on or off across the whole site.",
    type: "boolean",
    default: false,
    seeded: true,
    order: 10,
  },
  "admissions.introduction": {
    group: "admissions",
    label: "Admissions introduction",
    description: "Shown at the top of the admissions section.",
    type: "textarea",
    default: "",
    order: 20,
  },
  "admissions.email": {
    group: "admissions",
    label: "Admissions email address",
    type: "email",
    default: "",
    order: 30,
  },
  "admissions.phone": {
    group: "admissions",
    label: "Admissions telephone number",
    type: "tel",
    default: "",
    order: 40,
  },
  "admissions.prospectusUrl": {
    group: "admissions",
    label: "Prospectus download URL",
    description: "Optional link to a downloadable prospectus.",
    type: "url",
    default: "",
    order: 50,
  },
} as const satisfies Record<string, SettingDefinition>;

/** Precise union of every configurable key, derived from the object above. */
export type SettingKey = keyof typeof REGISTRY;

/**
 * The registry, widened to a uniform value type. `as const satisfies` keeps the
 * key union exact but leaves each entry with its own literal type, so optional
 * fields like `description` and `seeded` would otherwise be missing from the
 * union at call sites.
 */
export const SETTINGS_REGISTRY: Record<SettingKey, SettingDefinition> = REGISTRY;

export const SETTING_KEYS = Object.keys(REGISTRY) as SettingKey[];
