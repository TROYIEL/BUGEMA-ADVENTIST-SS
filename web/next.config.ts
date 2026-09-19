import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,

  experimental: {
    serverActions: {
      // Applicant documents are uploaded through a Server Action. The default
      // 1 MB cap is well under a scanned report card; this leaves headroom
      // above MAX_DOCUMENT_BYTES (8 MB) for multipart framing.
      bodySizeLimit: "10mb",
    },
  },

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
        ],
      },
    ];
  },
};

export default nextConfig;
