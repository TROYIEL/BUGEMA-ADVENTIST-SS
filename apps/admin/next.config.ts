import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@bass/db", "@bass/auth", "@bass/core", "@bass/ui"],
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),

  typedRoutes: true,

  experimental: {
    // Required for forbidden() / unauthorized() and their route files.
    authInterrupts: true,
    serverActions: {
      // Applies to Server Actions only. File uploads go through Route
      // Handlers, which this limit does not govern.
      bodySizeLimit: "2mb",
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
