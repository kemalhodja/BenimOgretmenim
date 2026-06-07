import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { getServerApiBaseUrl } from "../lib/api";
import { numberOrNull, readRecordArray, stringOrNull, type JsonRecord } from "../lib/publicSeo";
import { publicSiteUrl } from "../lib/siteUrl";

const coursesUrl = `${publicSiteUrl()}/courses`;

type SsrCourse = {
  id: string;
  title: string;
  teacher_display_name: string;
  branch_name: string | null;
  delivery_mode: string;
  price_minor: number;
  currency: string;
};

function toSsrCourse(row: JsonRecord): SsrCourse | null {
  const id = stringOrNull(row.id);
  const title = stringOrNull(row.title);
  const priceMinor = numberOrNull(row.price_minor);
  if (!id || !title || priceMinor == null) return null;
  return {
    id,
    title,
    teacher_display_name: stringOrNull(row.teacher_display_name) ?? "Öğretmen",
    branch_name: stringOrNull(row.branch_name),
    delivery_mode: stringOrNull(row.delivery_mode) ?? "online",
    price_minor: priceMinor,
    currency: stringOrNull(row.currency) ?? "TRY",
  };
}

function deliveryModeLabel(mode: string): string {
  const labels: Record<string, string> = {
    online: "Online",
    in_person: "Yüz yüze",
    hybrid: "Online veya yüz yüze",
  };
  return labels[mode] ?? mode;
}

async function loadSsrCourses(): Promise<SsrCourse[]> {
  try {
    const api = getServerApiBaseUrl();
    const res = await fetch(`${api}/v1/courses?limit=6`, {
      headers: { accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const body = await res.json();
    return readRecordArray(body, "courses")
      .map(toSsrCourse)
      .filter((course): course is SsrCourse => course !== null);
  } catch {
    return [];
  }
}

function tl(minor: number): string {
  return (minor / 100).toFixed(2);
}

export const metadata: Metadata = {
  title: "Online kurslar ve grup dersleri",
  description:
    "Öğretmenlerin yayınladığı online kursları, grup seçeneklerini, fiyatları ve kayıt adımlarını inceleyin.",
  alternates: { canonical: coursesUrl },
  openGraph: {
    title: "Online kurslar · BenimÖğretmenim",
    description:
      "Canlı ders, grup programı, kayıt adımları ve güvenli ödeme ile online kursları keşfedin.",
    url: coursesUrl,
    locale: "tr_TR",
    type: "website",
  },
};

export default async function CoursesLayout({ children }: { children: ReactNode }) {
  const courses = await loadSsrCourses();
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "BenimÖğretmenim online kurslar",
    url: coursesUrl,
    description: "Öğretmenlerin yayınladığı online kurs ve grup ders programları.",
    mainEntity: {
      "@type": "ItemList",
      itemListElement: courses.length
        ? courses.map((course, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: `${coursesUrl}/${course.id}`,
            name: course.title,
          }))
        : [
            { "@type": "ListItem", position: 1, name: "Canlı online kurslar" },
            { "@type": "ListItem", position: 2, name: "Cohort bazlı grup dersleri" },
            { "@type": "ListItem", position: 3, name: "Güvenli kayıt ve ödeme" },
          ],
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      {courses.length > 0 ? (
        <section className="mx-auto max-w-5xl px-6 pt-8">
          <div className="rounded-2xl border border-paper-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-paper-950">Öne çıkan kurslar</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {courses.map((course) => (
                <Link key={course.id} href={`/courses/${course.id}`} className="rounded-xl border border-paper-200 bg-paper-50 p-3 hover:border-brand-200">
                  <div className="font-semibold text-paper-950">{course.title}</div>
                  <div className="mt-1 text-xs text-paper-800/60">
                    {course.teacher_display_name} · {course.branch_name ?? "Genel"} · {deliveryModeLabel(course.delivery_mode)} · {tl(course.price_minor)} {course.currency}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}
      {children}
    </>
  );
}
