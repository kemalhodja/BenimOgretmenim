import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";

  const paths: MetadataRoute.Sitemap = [
    "/",
    "/ogretmenler",
    "/login",
    "/kayit",
    "/student/requests",
    "/student/dersler",
    "/student/kurslar",
    "/student/panel",
    "/student/dogrudan-dersler",
    "/student/grup-dersler",
    "/student/odev-sor",
    "/courses",
    "/teacher",
    "/teacher/cuzdan",
    "/teacher/dogrudan-dersler",
    "/teacher/dersler",
    "/teacher/grup-dersler",
    "/teacher/odev-havuzu",
    "/teacher/kurslar",
    "/teacher/kurslar/yeni",
    "/teacher/edit",
    "/teacher/requests",
    "/guardian",
    "/fiyatlar",
    "/yardim",
    "/iletisim",
    "/gizlilik",
    "/kullanim-kosullari",
    "/kampanya",
    "/teacher/teklifler",
    "/odeme/ok",
    "/odeme/hata",
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));

  return paths;
}
