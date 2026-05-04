import type { MetadataRoute } from "next";
import { publicSiteUrl } from "./lib/siteUrl";

export default function robots(): MetadataRoute.Robots {
  const base = publicSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin",
          "/student",
          "/teacher",
          "/guardian",
          "/panel",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
