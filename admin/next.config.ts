import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,

  experimental: {
    // Required for forbidden() / unauthorized() and their route files.
    authInterrupts: true,
    serverActions: {
      // Hero slides post up to four photographs in one form, re-encoded on
      // the server. Unauthenticated bodies never reach an action: proxy.ts
      // turns away requests without a session cookie first.
      bodySizeLimit: "24mb",
    },
  },

  images: {
    qualities: [70, 75, 90],
    formats: ["image/avif", "image/webp"],
    localPatterns: [{ pathname: "/media/**", search: "" }],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Browsers ignore HSTS over plain HTTP, so sending it always is safe.
          // `includeSubDomains` is deliberately left off: the school may have
          // other subdomains this project knows nothing about.
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          // Nothing in the administration app should ever reach a search index,
          // whatever an individual page declares.
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
    ];
  },
};

export default nextConfig;
