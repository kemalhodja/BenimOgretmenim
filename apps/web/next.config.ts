import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    const { inferInternalApiUrlIfNeeded } = await import(
      "./scripts/infer-internal-api-url.mjs"
    );
    const site = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "";
    const pub = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ?? "";
    let internal = process.env.INTERNAL_API_BASE_URL?.trim();
    if (!internal) {
      const inferred = inferInternalApiUrlIfNeeded(site, pub, "");
      if (inferred) internal = inferred;
    }
    if (!internal) internal = pub;
    if (!internal) return [];
    const base = internal.replace(/\/$/, "");
    return [{ source: "/v1/:path*", destination: `${base}/v1/:path*` }];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
  async headers() {
    const base = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ] as const;

    const security =
      process.env.NODE_ENV === "production"
        ? [
            ...base,
            {
              key: "Strict-Transport-Security",
              value: "max-age=63072000; includeSubDomains",
            },
          ]
        : [...base];

    return [
      {
        source: "/.well-known/assetlinks.json",
        headers: [
          { key: "Content-Type", value: "application/json; charset=utf-8" },
          { key: "Cache-Control", value: "public, max-age=3600" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        source: "/:path*",
        headers: security,
      },
    ];
  },
};

export default nextConfig;
