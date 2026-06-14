import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1"],
  async rewrites() {
    const { inferInternalApiUrlIfNeeded } = await import(
      "./scripts/infer-internal-api-url.mjs"
    );
    const site = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "";
    const pub = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ?? "";
    let internal = process.env.INTERNAL_API_BASE_URL?.trim();
    try {
      if (internal && site) {
        if (new URL(internal).origin === new URL(site).origin) internal = "";
      }
    } catch {
      internal = "";
    }
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
    const cspReportOnly = [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' https:",
      "frame-src 'self' https:",
      "form-action 'self' https:",
      "upgrade-insecure-requests",
    ].join("; ");
    const cspHeaderName =
      process.env.CSP_ENFORCE?.trim().toLowerCase() === "true"
        ? "Content-Security-Policy"
        : "Content-Security-Policy-Report-Only";
    const base = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
      { key: "Origin-Agent-Cluster", value: "?1" },
      { key: "X-DNS-Prefetch-Control", value: "off" },
      { key: cspHeaderName, value: cspReportOnly },
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
