import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ZigoTeacherFeed } from "../components/marketing/ZigoTeacherFeed";
import { getServerApiBaseUrl } from "../lib/api";
import { numberOrNull, readRecordArray, stringOrNull, type JsonRecord } from "../lib/publicSeo";
import { publicSiteUrl } from "../lib/siteUrl";

const ogretmenlerUrl = `${publicSiteUrl()}/ogretmenler`;

type SsrTeacher = {
  id: string;
  display_name: string;
  city_name: string | null;
  verification_status: string;
  rating_avg: number | null;
  rating_count: number | null;
  primary_branch_name: string | null;
  min_hourly_rate_minor: number | null;
  max_hourly_rate_minor: number | null;
};

function toSsrTeacher(row: JsonRecord): SsrTeacher | null {
  const id = stringOrNull(row.id);
  const displayName = stringOrNull(row.display_name);
  if (!id || !displayName) return null;
  return {
    id,
    display_name: displayName,
    city_name: stringOrNull(row.city_name),
    verification_status: stringOrNull(row.verification_status) ?? "unverified",
    rating_avg: numberOrNull(row.rating_avg),
    rating_count: numberOrNull(row.rating_count),
    primary_branch_name: stringOrNull(row.primary_branch_name),
    min_hourly_rate_minor: numberOrNull(row.min_hourly_rate_minor),
    max_hourly_rate_minor: numberOrNull(row.max_hourly_rate_minor),
  };
}

async function loadSsrTeachers(): Promise<SsrTeacher[]> {
  try {
    const api = getServerApiBaseUrl();
    const res = await fetch(`${api}/v1/teachers?limit=6&verifiedOnly=1&sort=recommended`, {
      headers: { accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const body = await res.json();
    return readRecordArray(body, "teachers")
      .map(toSsrTeacher)
      .filter((teacher): teacher is SsrTeacher => teacher !== null);
  } catch {
    return [];
  }
}

function priceLabel(min: number | null, max: number | null): string {
  if (min == null && max == null) return "Ücret profilde";
  const left = min != null ? `${Math.round(min / 100)} TL` : "—";
  const right = max != null ? `${Math.round(max / 100)} TL` : "—";
  return `${left} - ${right}`;
}

export const metadata: Metadata = {
  title: "Öğretmen ara ve güvenle özel ders talep et",
  description:
    "Branş, şehir, doğrulama, profil kalitesi ve değerlendirme bilgileriyle öğretmenleri karşılaştırın.",
  alternates: { canonical: ogretmenlerUrl },
  openGraph: {
    title: "Öğretmen ara · BenimÖğretmenim",
    description:
      "Doğrulanmış profil, güvenli ödeme, demo ders ve veli görünürlüğü ile özel ders öğretmeni bulun.",
    url: ogretmenlerUrl,
    locale: "tr_TR",
    type: "website",
  },
};

export default async function OgretmenlerLayout({ children }: { children: ReactNode }) {
  const teachers = await loadSsrTeachers();
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "BenimÖğretmenim öğretmen arama",
    url: ogretmenlerUrl,
    description:
      "Öğrenciler için branş, şehir, doğrulama ve güven bilgilerine göre öğretmen keşif sayfası.",
    mainEntity: {
      "@type": "ItemList",
      itemListElement: teachers.length
        ? teachers.map((teacher, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: `${ogretmenlerUrl}/${teacher.id}`,
            name: teacher.display_name,
          }))
        : [
            { "@type": "ListItem", position: 1, name: "Doğrulanmış öğretmen profilleri" },
            { "@type": "ListItem", position: 2, name: "Demo ders ve teklif süreci" },
            { "@type": "ListItem", position: 3, name: "Güvenli ödeme ve veli takibi" },
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
      {teachers.length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
          <div className="rounded-2xl border border-paper-200 bg-white p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-800/70">
                  Öne çıkan öğretmenler
                </p>
                <h2 className="mt-1 text-lg font-semibold text-paper-950">
                  Doğrulanmış profilleri hızlıca karşılaştırın
                </h2>
              </div>
              <Link href="/ogretmenler?verifiedOnly=1&sort=recommended" className="text-sm font-semibold text-brand-800 underline">
                Tümünü karşılaştır
              </Link>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {teachers.map((teacher) => (
                <Link
                  key={teacher.id}
                  href={`/ogretmenler/${teacher.id}`}
                  className="rounded-xl border border-paper-200 bg-paper-50 p-3 hover:border-brand-200 hover:bg-brand-50/30"
                >
                  <div className="font-semibold text-paper-950">{teacher.display_name}</div>
                  <div className="mt-1 text-xs text-paper-800/60">
                    {teacher.primary_branch_name ?? "Branş"} · {teacher.city_name ?? "Online"} · {priceLabel(teacher.min_hourly_rate_minor, teacher.max_hourly_rate_minor)}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-900">
                      {teacher.verification_status === "verified" ? "Doğrulanmış" : teacher.verification_status}
                    </span>
                    <span className="rounded-full bg-paper-100 px-2 py-0.5 font-medium text-paper-800">
                      {teacher.rating_count ? `★ ${Number(teacher.rating_avg ?? 0).toFixed(1)} (${teacher.rating_count})` : "Yeni profil"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}
      {children}
      <div className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
        <ZigoTeacherFeed variant="plain" maxItems={3} />
      </div>
    </>
  );
}
