import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source rather than a build step, so
  // Next has to compile them itself.
  transpilePackages: ["@bass/db", "@bass/auth", "@bass/core", "@bass/ui"],

  // Without this, file tracing starts at the app directory and misses the
  // shared packages, producing a standalone build that cannot boot.
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),

  typedRoutes: true,

  images: {
    // Next 16 defaults this to [75] and coerces anything else to the nearest
    // allowed value, so every quality the app uses must be listed here.
    qualities: [70, 75, 90],
    formats: ["image/avif", "image/webp"],
    localPatterns: [
      { pathname: "/media/**", search: "" },
      { pathname: "/brand/**", search: "" },
    ],
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
        ],
      },
    ];
  },
};

export default nextConfig;
