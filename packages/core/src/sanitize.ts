import sanitizeHtml from "sanitize-html";

/**
 * Rich text is sanitised on write AND again on render.
 *
 * Sanitising twice is deliberate. Content written before a rule changed, or
 * imported by some future migration, would otherwise reach a browser
 * unchecked; the render-time pass means no stored string can become script no
 * matter how it got into the database.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "h2", "h3", "h4", "h5", "h6",
    "p", "br", "hr",
    "ul", "ol", "li",
    "strong", "em", "u", "s", "sup", "sub",
    "blockquote", "cite",
    "a",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
    "figure", "figcaption", "img",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    th: ["scope", "colspan", "rowspan"],
    td: ["colspan", "rowspan"],
  },
  // No `data:` — an SVG data URL is an execution context in some browsers.
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesAppliedToAttributes: ["href", "src"],
  allowProtocolRelative: false,
  transformTags: {
    // Any link that leaves the site gets safe rel attributes, so a target
    //="_blank" link cannot reach back through window.opener.
    a: (tagName, attribs) => {
      const href = attribs.href ?? "";
      const isExternal = /^https?:\/\//i.test(href);

      return {
        tagName,
        attribs: {
          ...attribs,
          ...(isExternal
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {}),
        },
      };
    },
    img: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, loading: "lazy" },
    }),
  },
  // Drops the contents of these outright rather than leaving stray text behind.
  nonTextTags: ["style", "script", "textarea", "option", "noscript"],
};

export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, OPTIONS);
}

/** Plain-text version, for meta descriptions, excerpts and the search index. */
export function richTextToPlainText(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Plain-text paragraphs, for excerpts that need more than one. Block-level
 * closes and line breaks become paragraph boundaries before the tags go.
 */
export function richTextToParagraphs(html: string | null | undefined): string[] {
  if (!html) return [];
  const marked = html.replace(/<\/(p|div|h[1-6]|li|blockquote|tr)>|<br\s*\/?>/gi, "$&\n");
  return sanitizeHtml(marked, { allowedTags: [], allowedAttributes: {} })
    .split(/\n+/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Truncates on a word boundary, for generated meta descriptions. */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxLength).trimEnd()}…`;
}
