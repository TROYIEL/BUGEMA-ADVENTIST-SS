/**
 * The site's public origin, without a trailing slash.
 *
 * Shared so the sitemap, structured data, Open Graph tags and outgoing email
 * all agree on one value rather than each reading the variable with its own
 * fallback.
 */
export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
