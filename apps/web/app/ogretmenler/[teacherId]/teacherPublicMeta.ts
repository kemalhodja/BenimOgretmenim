import { cache } from "react";
import type { Metadata } from "next";
import { getServerApiBaseUrl } from "../../lib/api";

type TeacherPublicPayload = {
  teacher: {
    display_name: string;
    bio_raw: string | null;
    city_name: string | null;
    district_name: string | null;
    rating_avg: number | null;
    rating_count: number | null;
    verification_status: string;
  };
};

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isTeacherIdParam(id: string): boolean {
  return uuidRe.test(id.trim());
}

export const getTeacherPublicPayload = cache(async (teacherId: string): Promise<TeacherPublicPayload | null> => {
  if (!isTeacherIdParam(teacherId)) return null;
  const base = getServerApiBaseUrl();
  try {
    const res = await fetch(`${base}/v1/teachers/${encodeURIComponent(teacherId)}`, {
      headers: { accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as TeacherPublicPayload;
  } catch {
    return null;
  }
});

export function teacherJsonLd(opts: {
  teacherId: string;
  siteUrl: string;
  name: string;
  description: string | null;
  cityName: string | null;
}): Record<string, unknown> {
  const base = opts.siteUrl.replace(/\/$/, "");
  const url = `${base}/ogretmenler/${opts.teacherId}`;
  const person: Record<string, unknown> = {
    "@type": "Person",
    "@id": `${url}#person`,
    name: opts.name,
    description: opts.description?.trim().slice(0, 5000) || undefined,
    url,
    ...(opts.cityName ? { homeLocation: { "@type": "Place", name: opts.cityName } } : {}),
  };
  const breadcrumbs = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Ana sayfa", item: `${base}/` },
      { "@type": "ListItem", position: 2, name: "Öğretmenler", item: `${base}/ogretmenler` },
      { "@type": "ListItem", position: 3, name: opts.name, item: url },
    ],
  };
  return { "@context": "https://schema.org", "@graph": [person, breadcrumbs] };
}

export async function teacherPageMetadata(
  teacherId: string,
  siteUrl: string,
): Promise<Metadata> {
  const data = await getTeacherPublicPayload(teacherId);
  const base = siteUrl.replace(/\/$/, "");
  if (!data?.teacher) {
    return { title: "Öğretmen profili", robots: { index: false, follow: false } };
  }
  const t = data.teacher;
  const name = t.display_name?.trim() || "Öğretmen";
  const loc = [t.district_name, t.city_name].filter(Boolean).join(", ");
  const title = loc ? `${name} (${loc})` : name;
  const rawBio = (t.bio_raw ?? "").replace(/\s+/g, " ").trim();
  const stars =
    t.rating_avg != null && t.rating_count != null && t.rating_count > 0
      ? ` Ortalama ${Number(t.rating_avg).toFixed(1)} (${t.rating_count} değerlendirme).`
      : "";
  const description = (
    rawBio.slice(0, 120) +
    (rawBio.length > 120 ? "…" : "") +
    stars +
    " BenimÖğretmenim'de profili inceleyin, talep açın veya teklif alın."
  ).slice(0, 160);

  const canonical = `${base}/ogretmenler/${teacherId}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "profile",
      url: canonical,
      title: `${name} · BenimÖğretmenim`,
      description: description.slice(0, 200),
      locale: "tr_TR",
    },
    twitter: {
      card: "summary",
      title: `${name} · BenimÖğretmenim`,
      description: description.slice(0, 200),
    },
  };
}
