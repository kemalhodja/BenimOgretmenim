import { cache } from "react";
import type { Metadata } from "next";
import { getServerApiBaseUrl } from "../../lib/api";

type CoursePublicPayload = {
  course: {
    id: string;
    title: string;
    description: string | null;
    delivery_mode: string;
    language_code: string;
    price_minor: number;
    currency: string;
    branch_name: string | null;
    teacher_id: string;
    teacher_display_name: string;
  };
  cohorts: unknown[];
};

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCourseIdParam(id: string): boolean {
  return uuidRe.test(id.trim());
}

export const getCoursePublicPayload = cache(async (courseId: string): Promise<CoursePublicPayload | null> => {
  if (!isCourseIdParam(courseId)) return null;
  const base = getServerApiBaseUrl();
  try {
    const res = await fetch(`${base}/v1/courses/${encodeURIComponent(courseId)}`, {
      headers: { accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as CoursePublicPayload;
  } catch {
    return null;
  }
});

export function courseJsonLd(opts: {
  courseId: string;
  siteUrl: string;
  title: string;
  description: string | null;
  teacherName: string;
}): Record<string, unknown> {
  const base = opts.siteUrl.replace(/\/$/, "");
  const url = `${base}/courses/${opts.courseId}`;
  const course: Record<string, unknown> = {
    "@type": "Course",
    "@id": `${url}#course`,
    name: opts.title,
    description: opts.description?.trim().slice(0, 5000) || undefined,
    url,
    provider: {
      "@type": "Organization",
      name: "BenimÖğretmenim",
      url: base,
    },
    instructor: {
      "@type": "Person",
      name: opts.teacherName,
    },
  };
  const breadcrumbs = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Ana sayfa", item: `${base}/` },
      { "@type": "ListItem", position: 2, name: "Kurslar", item: `${base}/courses` },
      { "@type": "ListItem", position: 3, name: opts.title, item: url },
    ],
  };
  return { "@context": "https://schema.org", "@graph": [course, breadcrumbs] };
}

export async function coursePageMetadata(
  courseId: string,
  siteUrl: string,
): Promise<Metadata> {
  const data = await getCoursePublicPayload(courseId);
  const base = siteUrl.replace(/\/$/, "");
  if (!data?.course) {
    return { title: "Kurs", robots: { index: false, follow: false } };
  }
  const c = data.course;
  const title = c.title?.trim() || "Kurs";
  const rawDesc = (c.description ?? "").replace(/\s+/g, " ").trim();
  const branch = c.branch_name ? `${c.branch_name}. ` : "";
  const mode =
    c.delivery_mode === "online"
      ? "Çevrimiçi"
      : c.delivery_mode === "in_person"
        ? "Yüz yüze"
        : c.delivery_mode;
  const description = (
    branch +
    (rawDesc.slice(0, 100) + (rawDesc.length > 100 ? "…" : "")) +
    ` Öğretmen: ${c.teacher_display_name}. ${mode}. BenimÖğretmenim'de cohort ve kayıt bilgisine bakın.`
  ).slice(0, 160);

  const canonical = `${base}/courses/${courseId}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      title: `${title} · BenimÖğretmenim`,
      description: description.slice(0, 200),
      locale: "tr_TR",
    },
    twitter: {
      card: "summary",
      title: `${title} · BenimÖğretmenim`,
      description: description.slice(0, 200),
    },
  };
}
