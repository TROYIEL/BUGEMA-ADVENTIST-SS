/**
 * Structured data (schema.org JSON-LD).
 *
 * Every builder below emits only what the school has actually configured or
 * published. A missing telephone number is simply absent from the graph —
 * never a placeholder — because search engines treat this data as fact.
 *
 * Rendered as a <script type="application/ld+json">. The JSON is serialised
 * with `<` escaped so a title containing "</script>" cannot break out of the
 * element.
 */

type JsonLd = Record<string, unknown>;

function serialise(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function JsonLdScript({ data }: { data: JsonLd | JsonLd[] }) {
  const items = Array.isArray(data) ? data : [data];
  return (
    <>
      {items.map((item, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serialise(item) }}
        />
      ))}
    </>
  );
}

/** Drops undefined/null/empty-string values so nothing unconfigured leaks in. */
function compact(object: JsonLd): JsonLd {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  );
}

export function organisationJsonLd(input: {
  siteUrl: string;
  name: string;
  logoUrl?: string | null;
  telephone?: string | null;
  email?: string | null;
  streetAddress?: string | null;
  sameAs?: (string | null | undefined)[];
}): JsonLd {
  const sameAs = (input.sameAs ?? []).filter((url): url is string => Boolean(url));
  return compact({
    "@context": "https://schema.org",
    "@type": "School",
    "@id": `${input.siteUrl}/#organisation`,
    name: input.name,
    url: input.siteUrl,
    logo: input.logoUrl ? `${input.siteUrl}${input.logoUrl}` : undefined,
    telephone: input.telephone ?? undefined,
    email: input.email ?? undefined,
    address: input.streetAddress
      ? { "@type": "PostalAddress", streetAddress: input.streetAddress, addressCountry: "UG" }
      : undefined,
    sameAs: sameAs.length > 0 ? sameAs : undefined,
  });
}

export function websiteJsonLd(input: { siteUrl: string; name: string }): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${input.siteUrl}/#website`,
    url: input.siteUrl,
    name: input.name,
    publisher: { "@id": `${input.siteUrl}/#organisation` },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${input.siteUrl}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export function articleJsonLd(input: {
  siteUrl: string;
  path: string;
  headline: string;
  description?: string | null;
  imageUrl?: string | null;
  publishedAt?: Date | null;
  modifiedAt?: Date | null;
  authorName?: string | null;
}): JsonLd {
  return compact({
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    mainEntityOfPage: `${input.siteUrl}${input.path}`,
    headline: input.headline,
    description: input.description ?? undefined,
    image: input.imageUrl ? [`${input.siteUrl}${input.imageUrl}`] : undefined,
    datePublished: input.publishedAt?.toISOString(),
    dateModified: (input.modifiedAt ?? input.publishedAt)?.toISOString(),
    author: input.authorName ? { "@type": "Person", name: input.authorName } : undefined,
    publisher: { "@id": `${input.siteUrl}/#organisation` },
  });
}

export function eventJsonLd(input: {
  siteUrl: string;
  path: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  startDate: Date;
  endDate?: Date | null;
  location?: string | null;
}): JsonLd {
  return compact({
    "@context": "https://schema.org",
    "@type": "Event",
    "@id": `${input.siteUrl}${input.path}`,
    url: `${input.siteUrl}${input.path}`,
    name: input.name,
    description: input.description ?? undefined,
    image: input.imageUrl ? [`${input.siteUrl}${input.imageUrl}`] : undefined,
    startDate: input.startDate.toISOString(),
    endDate: input.endDate?.toISOString(),
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: input.location ? { "@type": "Place", name: input.location } : undefined,
    organizer: { "@id": `${input.siteUrl}/#organisation` },
  });
}
