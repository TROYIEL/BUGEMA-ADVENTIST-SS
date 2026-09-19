import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The admin area, the API and applicant-specific pages must never be
      // crawled. Individual pages also send noindex, so this is belt and braces
      // rather than the only control.
      disallow: [
        "/admin",
        "/api",
        "/search",
        "/admissions/application-status",
        "/admissions/portal",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
