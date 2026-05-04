import type { MetadataRoute } from "next";
import { getServerApiBaseUrl } from "./lib/api";
import { publicSiteUrl } from "./lib/siteUrl";

const MAX_TEACHER_SITEMAP_URLS = 2_000;
const MAX_COURSE_SITEMAP_URLS = 2_000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicSiteUrl();

  /* Giriş, panel ve ödeme uçları robots + noindex ile kapalı; sitemap yalnızca kamu pazarlama URL’leri. */
  const staticPaths: MetadataRoute.Sitemap = [
    "/",
    "/ogretmenler",
    "/courses",
    "/fiyatlar",
    "/uygulama",
    "/yardim",
    "/iletisim",
    "/gizlilik",
    "/kullanim-kosullari",
    "/kampanya",
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: path === "/" ? 1 : 0.7,
  }));

  const teacherEntries: MetadataRoute.Sitemap = [];
  try {
    const api = getServerApiBaseUrl();
    const pageSize = 100;
    for (let offset = 0; offset < MAX_TEACHER_SITEMAP_URLS; offset += pageSize) {
      const res = await fetch(
        `${api}/v1/teachers?limit=${pageSize}&offset=${offset}`,
        { headers: { accept: "application/json" }, next: { revalidate: 3600 } },
      );
      if (!res.ok) break;
      const body = (await res.json()) as {
        teachers?: Array<{ id: string; created_at?: string }>;
      };
      const rows = body.teachers ?? [];
      if (rows.length === 0) break;
      for (const t of rows) {
        teacherEntries.push({
          url: `${base}/ogretmenler/${t.id}`,
          lastModified: t.created_at ? new Date(t.created_at) : new Date(),
          changeFrequency: "weekly",
          priority: 0.65,
        });
      }
      if (rows.length < pageSize) break;
    }
  } catch {
    // API yoksa veya build anında erişilemiyorsa yalnızca statik URL’ler döner.
  }

  const courseEntries: MetadataRoute.Sitemap = [];
  try {
    const api = getServerApiBaseUrl();
    const pageSize = 50;
    for (let offset = 0; offset < MAX_COURSE_SITEMAP_URLS; offset += pageSize) {
      const res = await fetch(
        `${api}/v1/courses?limit=${pageSize}&offset=${offset}`,
        { headers: { accept: "application/json" }, next: { revalidate: 3600 } },
      );
      if (!res.ok) break;
      const body = (await res.json()) as {
        courses?: Array<{ id: string; created_at?: string }>;
      };
      const rows = body.courses ?? [];
      if (rows.length === 0) break;
      for (const c of rows) {
        courseEntries.push({
          url: `${base}/courses/${c.id}`,
          lastModified: c.created_at ? new Date(c.created_at) : new Date(),
          changeFrequency: "weekly",
          priority: 0.62,
        });
      }
      if (rows.length < pageSize) break;
    }
  } catch {
    // yukarıdakiyle aynı: API yoksa atlanır
  }

  return [...staticPaths, ...teacherEntries, ...courseEntries];
}
