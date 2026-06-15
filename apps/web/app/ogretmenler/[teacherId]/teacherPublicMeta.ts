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
    has_active_subscription?: boolean;
    profile_site?: {
      headline?: string;
      subheadline?: string;
      primaryBranchName?: string | null;
      locationLabel?: string;
      priceLabel?: string;
      ratingLabel?: string;
      faq?: Array<{ question: string; answer: string }>;
    };
  };
};

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isTeacherIdParam(id: string): boolean {
  return uuidRe.test(id.trim());
}

export function extractTeacherIdParam(raw: string): string | null {
  const value = raw.trim();
  if (isTeacherIdParam(value)) return value;
  return value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)?.[0] ?? null;
}

function profileSlugPart(value: string): string {
  const normalized = value
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "ogretmen";
}

function teacherProfilePath(displayName: string, branchName: string | null | undefined, teacherId: string): string {
  const slug = [displayName, branchName ?? "ozel-ders"].map(profileSlugPart).join("-");
  return `/ogretmenler/${slug}-${teacherId}`;
}

export const getTeacherPublicPayload = cache(async (teacherId: string): Promise<TeacherPublicPayload | null> => {
  const id = extractTeacherIdParam(teacherId);
  if (!id) return null;
  const base = getServerApiBaseUrl();
  try {
    const res = await fetch(`${base}/v1/teachers/${encodeURIComponent(id)}`, {
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
  branchName?: string | null;
  priceLabel?: string | null;
  faq?: Array<{ question: string; answer: string }> | null;
}): Record<string, unknown> {
  const base = opts.siteUrl.replace(/\/$/, "");
  const url = `${base}${teacherProfilePath(opts.name, opts.branchName, opts.teacherId)}`;
  const person: Record<string, unknown> = {
    "@type": "Person",
    "@id": `${url}#person`,
    name: opts.name,
    description: opts.description?.trim().slice(0, 5000) || undefined,
    url,
    knowsAbout: opts.branchName || undefined,
    ...(opts.cityName ? { homeLocation: { "@type": "Place", name: opts.cityName } } : {}),
    ...(opts.priceLabel
      ? {
          makesOffer: {
            "@type": "Offer",
            name: `${opts.branchName ?? "Özel ders"} demo ve teklif akışı`,
            priceCurrency: "TRY",
            description: opts.priceLabel,
          },
        }
      : {}),
  };
  const breadcrumbs = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Ana sayfa", item: `${base}/` },
      { "@type": "ListItem", position: 2, name: "Öğretmenler", item: `${base}/ogretmenler` },
      { "@type": "ListItem", position: 3, name: opts.name, item: url },
    ],
  };
  const faq =
    opts.faq && opts.faq.length > 0
      ? {
          "@type": "FAQPage",
          mainEntity: opts.faq.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer },
          })),
        }
      : null;
  return { "@context": "https://schema.org", "@graph": faq ? [person, breadcrumbs, faq] : [person, breadcrumbs] };
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
  const branch = t.profile_site?.primaryBranchName?.trim() || "özel ders";
  const title = loc ? `${name} · ${branch} (${loc})` : `${name} · ${branch}`;
  if (t.has_active_subscription === false) {
    return {
      title,
      description: `${name} için temel öğretmen profil bilgileri. Detaylı tanıtım, iletişim ve kişisel web sayfası abonelik sonrası açılır.`,
      robots: { index: false, follow: true },
    };
  }
  const rawBio = (t.bio_raw ?? "").replace(/\s+/g, " ").trim();
  const stars =
    t.rating_avg != null && t.rating_count != null && t.rating_count > 0
      ? ` Ortalama ${Number(t.rating_avg).toFixed(1)} (${t.rating_count} değerlendirme).`
      : "";
  const profileIntro = t.profile_site?.subheadline?.trim() || rawBio;
  const price = t.profile_site?.priceLabel ? ` ${t.profile_site.priceLabel}.` : "";
  const description = (
    profileIntro.slice(0, 110) +
    (profileIntro.length > 110 ? "…" : "") +
    stars +
    price +
    " Demo ders, WhatsApp/iletişim tercihi, güvenli ödeme ve veli takibiyle profili inceleyin."
  ).slice(0, 170);

  const id = extractTeacherIdParam(teacherId);
  const canonical = `${base}${teacherProfilePath(name, branch, id ?? teacherId)}`;
  const image = `${base}/logo-marketing.png`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "profile",
      url: canonical,
      title: `${name} · ${branch} · BenimÖğretmenim`,
      description: description.slice(0, 200),
      locale: "tr_TR",
      images: [{ url: image, width: 1200, height: 630, alt: `${name} öğretmen profili` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} · ${branch} · BenimÖğretmenim`,
      description: description.slice(0, 200),
      images: [image],
    },
  };
}
