"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { RegisterNavLink } from "../../components/AuthNavLinks";
import { apiFetch } from "../../lib/api";
import { clearToken, getToken } from "../../lib/auth";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { trackEvent } from "../../lib/trackEvent";

type TeacherDetail = {
  id: string;
  display_name: string;
  bio_raw: string | null;
  video_url?: string | null;
  instagram_url?: string | null;
  platform_links_jsonb?: Array<{ title: string; url: string }> | null;
  exam_docs_jsonb?: Array<{ title: string; url: string; kind?: string }> | null;
  verification_status: string;
  city_id: number | null;
  city_name: string | null;
  district_name: string | null;
  rating_avg: number | null;
  rating_count: number | null;
  profile_quality_score: number | null;
  has_video: boolean;
  has_exam_docs: boolean;
  has_platform_links: boolean;
  branch_count: number;
  completed_sessions_count: number;
  created_at: string;
  trust_summary?: {
    verificationStatus: string;
    verificationLabel: string;
    evidence: {
      hasExamDocs: boolean;
      hasPlatformLinks: boolean;
      hasVideo: boolean;
      branchCount: number;
      completedSessionsCount: number;
      reviewCount: number;
    };
    pricing: {
      minHourlyRateMinor: number | null;
      maxHourlyRateMinor: number | null;
      currency: string;
      note: string;
    };
    paymentProtection: string;
  };
  profile_site?: {
    headline: string;
    subheadline: string;
    primaryBranchName: string | null;
    locationLabel: string;
    priceLabel: string;
    ratingLabel: string;
    trustBadges: string[];
    stats: Array<{ label: string; value: string }>;
    methodSteps: Array<{ title: string; body: string }>;
    availabilitySummary: string;
    proofSummary: string[];
    faq: Array<{ question: string; answer: string }>;
    ctaReasons: string[];
  };
};

type BranchRow = {
  branch_id: number;
  branch_name: string;
  years_experience: number | null;
  is_primary: boolean;
  hourly_rate_min_minor: number | null;
  hourly_rate_max_minor: number | null;
};

type ReviewRow = {
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_label: string;
};

function minorToTl(n: number): string {
  return (n / 100).toFixed(2);
}

function parseTlToMinorGross(raw: string): number {
  const t = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") throw new Error("Anlaşma tutarını girin (TL).");
  const n = Number(t);
  if (!Number.isFinite(n) || n < 10) throw new Error("En az 10,00 TL (API minimum).");
  if (n > 1_000_000) throw new Error("Tutar çok yüksek.");
  const minor = Math.round(n * 100);
  if (minor < 1_000) throw new Error("En az 10,00 TL.");
  if (!Number.isSafeInteger(minor)) throw new Error("Tutar geçersiz.");
  return minor;
}

function secondsFromYouTubeTime(raw: string | null): number | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) return Number(t);
  // Format examples: 1h2m3s, 90s, 2m
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (!m) return null;
  const h = Number(m[1] ?? 0);
  const mm = Number(m[2] ?? 0);
  const s = Number(m[3] ?? 0);
  const total = h * 3600 + mm * 60 + s;
  return Number.isFinite(total) && total > 0 ? total : null;
}

function kindLabel(kind: string | null | undefined): string | null {
  const k = (kind ?? "").trim();
  if (!k) return null;
  if (k === "yazili_hazirlik") return "Yazılıya hazırlık";
  if (k === "dokuman") return "Doküman";
  if (k === "platform") return "Platform";
  return k;
}

function kindSortKey(kind: string | null | undefined): number {
  const k = (kind ?? "").trim();
  if (k === "yazili_hazirlik") return 0;
  if (k === "dokuman") return 1;
  if (k === "platform") return 2;
  return 9;
}

function hostLabel(rawUrl: string): string | null {
  const t = rawUrl.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function qualityLabel(score: number | null | undefined): string {
  const n = Number(score ?? 0);
  if (n >= 80) return "Çok güçlü profil";
  if (n >= 60) return "Güçlü profil";
  if (n >= 40) return "Gelişen profil";
  return "Yeni profil";
}

function responseSignalLabel(teacher: TeacherDetail): string {
  if (teacher.completed_sessions_count >= 20) return "Yoğun ders geçmişi";
  if (teacher.has_video && teacher.has_platform_links) return "Hızlı tanışma hazır";
  if (teacher.verification_status === "verified") return "Doğrulanmış iletişim";
  return "Yeni eşleşme adayı";
}

function profileTrustReasons(teacher: TeacherDetail): string[] {
  const reasons: string[] = [];
  if (teacher.verification_status === "verified") reasons.push("Doğrulama tamam");
  if (Number(teacher.profile_quality_score ?? 0) >= 75) reasons.push("Profil kalitesi güçlü");
  if (teacher.completed_sessions_count >= 10) reasons.push("Tamamlanan ders geçmişi var");
  if (teacher.rating_count != null && Number(teacher.rating_count) > 0) {
    reasons.push(`${Number(teacher.rating_avg ?? 0).toFixed(1)} puanlı yorumlar`);
  }
  if (teacher.has_video) reasons.push("Video ile tanışma mümkün");
  if (teacher.has_exam_docs) reasons.push("Doküman/sınav kanıtı ekli");
  return reasons.slice(0, 4);
}

function profileDecisionLabel(teacher: TeacherDetail): string {
  if (teacher.verification_status === "verified" && Number(teacher.profile_quality_score ?? 0) >= 80) {
    return "Güvenli demo adayı";
  }
  if (teacher.has_video || teacher.has_exam_docs) return "Profil kanıtlarını inceleyin";
  if (teacher.completed_sessions_count > 0) return "Ders geçmişini değerlendirin";
  return "Demo ile beklentiyi netleştirin";
}

function hourlyRateRangeLabel(branches: BranchRow[]): string | null {
  const mins = branches
    .map((branch) => branch.hourly_rate_min_minor)
    .filter((value): value is number => typeof value === "number" && value > 0);
  const maxs = branches
    .map((branch) => branch.hourly_rate_max_minor)
    .filter((value): value is number => typeof value === "number" && value > 0);
  if (!mins.length && !maxs.length) return null;
  const min = mins.length ? Math.min(...mins) : Math.min(...maxs);
  const max = maxs.length ? Math.max(...maxs) : Math.max(...mins);
  if (min === max) return `${minorToTl(min)} TL`;
  return `${minorToTl(min)} - ${minorToTl(max)} TL`;
}

const sampleLessonFlow = [
  "Hedef ve seviye kontrolü",
  "Canlı anlatım + ortak tahta",
  "Ders sonu ödev ve takip notu",
] as const;

function instagramHandle(rawUrl: string): string | null {
  const t = rawUrl.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    const host = u.hostname.replace(/^www\./, "");
    if (host !== "instagram.com") return null;
    const seg = u.pathname.split("/").filter(Boolean)[0];
    if (!seg) return null;
    if (seg.startsWith("@")) return seg;
    return `@${seg}`;
  } catch {
    return null;
  }
}

function getVideoEmbed(
  url: string,
): { provider: "youtube" | "vimeo"; embedUrl: string } | null {
  const u = url.trim();
  if (!u) return null;
  try {
    const parsed = new URL(u);
    const host = parsed.hostname.replace(/^www\./, "");
    const ytStart =
      secondsFromYouTubeTime(parsed.searchParams.get("t")) ??
      (parsed.searchParams.get("start")
        ? Number(parsed.searchParams.get("start"))
        : null);
    const start = ytStart && Number.isFinite(ytStart) && ytStart > 0 ? ytStart : null;
    // YouTube
    if (host === "youtube.com" || host === "m.youtube.com") {
      // /watch?v=ID or /shorts/ID or already /embed/ID
      const path = parsed.pathname;
      const v = parsed.searchParams.get("v");
      let id = v ?? null;
      if (!id && path.startsWith("/shorts/")) {
        id = path.split("/").filter(Boolean)[1] ?? null;
      }
      if (!id && path.startsWith("/embed/")) {
        id = path.split("/").filter(Boolean)[1] ?? null;
      }
      if (!id) return null;
      const qs = start ? `?start=${start}` : "";
      return {
        provider: "youtube",
        embedUrl: `https://www.youtube.com/embed/${id}${qs}`,
      };
    }
    if (host === "youtu.be") {
      const id = parsed.pathname.replace("/", "").trim();
      if (!id) return null;
      const qs = start ? `?start=${start}` : "";
      return {
        provider: "youtube",
        embedUrl: `https://www.youtube.com/embed/${id}${qs}`,
      };
    }
    // Vimeo
    if (host === "vimeo.com") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      if (!id) return null;
      return { provider: "vimeo", embedUrl: `https://player.vimeo.com/video/${id}` };
    }
    return null;
  } catch {
    return null;
  }
}

export default function OgretmenDetayPage() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const teacherId =
    typeof params.teacherId === "string" ? params.teacherId : "";
  const pathWithQuery = useMemo(() => {
    const base = pathname || (teacherId ? `/ogretmenler/${teacherId}` : "/ogretmenler");
    const q = searchParams.toString();
    return q ? `${base}?${q}` : base;
  }, [pathname, teacherId, searchParams]);
  const loginReturnHref = loginHrefWithReturn(pathWithQuery);

  const [teacher, setTeacher] = useState<TeacherDetail | null>(null);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [directTl, setDirectTl] = useState("500,00");
  const [directBusy, setDirectBusy] = useState(false);
  const [directError, setDirectError] = useState<string | null>(null);
  const [directOk, setDirectOk] = useState<string | null>(null);
  const [pendingDirectId, setPendingDirectId] = useState<string | null>(null);
  const [directFundBusy, setDirectFundBusy] = useState(false);
  const [shortlistBusy, setShortlistBusy] = useState(false);
  const [shortlistOk, setShortlistOk] = useState<string | null>(null);

  const primaryBranchId = useMemo(() => {
    const p = branches.find((b) => b.is_primary);
    return (p ?? branches[0])?.branch_id;
  }, [branches]);

  const talepPath = primaryBranchId
    ? `/student/requests?branchId=${primaryBranchId}`
    : "/student/requests";
  const talepEntryHref = authToken ? talepPath : loginHrefWithReturn(talepPath);
  const demoTalepQuery = new URLSearchParams();
  demoTalepQuery.set("requestKind", "demo");
  if (primaryBranchId) demoTalepQuery.set("branchId", String(primaryBranchId));
  if (teacherId) demoTalepQuery.set("teacherId", teacherId);
  if (teacher?.display_name) demoTalepQuery.set("teacherName", teacher.display_name);
  const demoTalepPath = `/student/requests?${demoTalepQuery.toString()}`;
  const demoTalepEntryHref = authToken ? demoTalepPath : loginHrefWithReturn(demoTalepPath);
  const hourlyRange = useMemo(() => hourlyRateRangeLabel(branches), [branches]);

  useEffect(() => {
    setAuthToken(getToken());
  }, []);

  useEffect(() => {
    if (!teacherId) return;
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const r = await apiFetch<{
          teacher: TeacherDetail;
          branches: BranchRow[];
          reviews: ReviewRow[];
        }>(`/v1/teachers/${teacherId}`);
        if (cancelled) return;
        setTeacher(r.teacher);
        setBranches(r.branches);
        setReviews(r.reviews ?? []);
        trackEvent("teacher_profile_view", {
          entityType: "teacher",
          entityId: teacherId,
          metadata: { teacherName: r.teacher.display_name },
        });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "load_failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teacherId]);

  async function createDirectBooking() {
    if (!authToken || !teacherId) {
      setDirectError("Giriş yapın.");
      return;
    }
    setDirectBusy(true);
    setDirectError(null);
    setDirectOk(null);
    setPendingDirectId(null);
    try {
      const agreedAmountMinor = parseTlToMinorGross(directTl);
      const r = await apiFetch<{
        booking: { id: string };
        next: { fundFromWallet: string };
      }>("/v1/student-platform/direct-bookings", {
        method: "POST",
        token: authToken,
        body: JSON.stringify({ teacherId, agreedAmountMinor }),
      });
      setPendingDirectId(r.booking.id);
      setDirectOk(
        "Anlaşma kaydedildi. Cüzdanınızdan ödeme alın; ardından öğretmen dersi portalında tamamlar.",
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "create_failed";
      if (msg.includes("[401]")) {
        clearToken();
        setAuthToken(null);
        router.replace(loginReturnHref);
        return;
      }
      if (msg.includes("student_platform_subscription")) {
        setDirectError("Aktif platform aboneliği gerekir. Öğrenci panelinden abonelik alın.");
      } else if (msg.includes("forbidden") && msg.includes("403")) {
        setDirectError(
          "Bu işlem yalnızca öğrenci hesabı içindir. Farklı bir hesapla giriş yaptıysanız öğrenci hesabıyla tekrar deneyin.",
        );
      } else {
        setDirectError(msg);
      }
    } finally {
      setDirectBusy(false);
    }
  }

  async function fundPendingDirect() {
    if (!authToken || !pendingDirectId) return;
    setDirectFundBusy(true);
    setDirectError(null);
    try {
      await apiFetch(
        `/v1/student-platform/direct-bookings/${pendingDirectId}/fund-from-wallet`,
        { method: "POST", token: authToken },
      );
      setDirectOk("Ödeme cüzdanınızdan alındı.");
      setPendingDirectId(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "fund_failed";
      if (msg.includes("[401]")) {
        clearToken();
        setAuthToken(null);
        router.replace(loginReturnHref);
        return;
      }
      if (msg.includes("[403]")) {
        setDirectError("Bu ödemeyi yapmak için öğrenci hesabı gerekir.");
        return;
      }
      if (msg.includes("insufficient_balance") || (msg.includes("[409]") && msg.includes("insufficient"))) {
        setDirectError("Bakiye yetersiz. Öğrenci panelinden cüzdan yükleyin, sonra tekrar deneyin.");
        return;
      }
      setDirectError(msg);
    } finally {
      setDirectFundBusy(false);
    }
  }

  async function addToShortlist() {
    if (!authToken || !teacherId) {
      router.replace(loginReturnHref);
      return;
    }
    setShortlistBusy(true);
    setShortlistOk(null);
    try {
      await apiFetch("/v1/teachers/shortlist", {
        method: "PATCH",
        token: authToken,
        body: JSON.stringify({ teacherId, action: "add" }),
      });
      setShortlistOk("Öğretmen kısa listenize eklendi.");
      trackEvent("teacher_shortlist", {
        entityType: "teacher",
        entityId: teacherId,
        metadata: { source: "teacher_profile_site" },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "shortlist_failed";
      if (msg.includes("[401]")) {
        clearToken();
        setAuthToken(null);
        router.replace(loginReturnHref);
        return;
      }
      setShortlistOk("Kısa listeye ekleme tamamlanamadı.");
    } finally {
      setShortlistBusy(false);
    }
  }

  const profileSchema = useMemo(() => {
    if (!teacher) return null;
    const primaryBranch = branches.find((b) => b.is_primary) ?? branches[0];
    const offer =
      teacher.trust_summary?.pricing.minHourlyRateMinor != null || teacher.trust_summary?.pricing.maxHourlyRateMinor != null
        ? {
            "@type": "Offer",
            priceCurrency: teacher.trust_summary?.pricing.currency ?? "TRY",
            lowPrice:
              teacher.trust_summary?.pricing.minHourlyRateMinor != null
                ? String(teacher.trust_summary.pricing.minHourlyRateMinor / 100)
                : undefined,
            highPrice:
              teacher.trust_summary?.pricing.maxHourlyRateMinor != null
                ? String(teacher.trust_summary.pricing.maxHourlyRateMinor / 100)
                : undefined,
            availability: "https://schema.org/InStock",
            description: teacher.trust_summary?.pricing.note,
          }
        : undefined;
    return {
      "@context": "https://schema.org",
      "@type": "Person",
      name: teacher.display_name,
      description: teacher.bio_raw ?? `${teacher.display_name} öğretmen profili`,
      areaServed: teacher.city_name ?? "Türkiye",
      knowsAbout: primaryBranch?.branch_name,
      hasCredential: teacher.trust_summary?.evidence.hasExamDocs ? "Paylaşılan sınav/doküman kanıtları" : undefined,
      aggregateRating:
        teacher.rating_count && teacher.rating_avg
          ? {
              "@type": "AggregateRating",
              ratingValue: teacher.rating_avg,
              reviewCount: teacher.rating_count,
              bestRating: 5,
              worstRating: 1,
            }
          : undefined,
      makesOffer: offer,
      review: reviews.slice(0, 5).map((review) => ({
        "@type": "Review",
        reviewRating: { "@type": "Rating", ratingValue: review.rating, bestRating: 5, worstRating: 1 },
        author: { "@type": "Person", name: review.reviewer_label },
        reviewBody: review.comment ?? undefined,
        datePublished: review.created_at,
      })),
      subjectOf: teacher.profile_site?.faq?.length
        ? {
            "@type": "FAQPage",
            mainEntity: teacher.profile_site.faq.map((item) => ({
              "@type": "Question",
              name: item.question,
              acceptedAnswer: { "@type": "Answer", text: item.answer },
            })),
          }
        : undefined,
    };
  }, [branches, reviews, teacher]);
  const profileSite = teacher?.profile_site ?? null;
  const primaryBranch = branches.find((b) => b.is_primary) ?? branches[0] ?? null;
  const heroHeadline =
    profileSite?.headline ??
    `${teacher?.display_name ?? "Öğretmen"} ile ${primaryBranch?.branch_name ?? "özel ders"} için güvenli başlangıç`;
  const heroSubheadline =
    profileSite?.subheadline ??
    "Demo ders, güvenli ödeme ve ders sonu takip notlarıyla öğrencinin ilerlemesi görünür kalır.";
  const heroStats =
    profileSite?.stats ??
    [
      { label: "Profil kalitesi", value: `${teacher?.profile_quality_score ?? 0}/100` },
      { label: "Uzmanlık", value: primaryBranch?.branch_name ?? "Branş profilde" },
      { label: "Konum", value: teacher?.city_name ?? "Online" },
      { label: "Ücret", value: hourlyRange ?? "Teklif sonrası" },
    ];
  const quickDecisionReasons =
    profileSite?.ctaReasons ??
    [
      "Demo ile öğretmeni tanı",
      "Teklif ve fiyatı netleştir",
      "Güvenli ödeme sürecine geç",
    ];

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/ogretmenler"
          className="text-sm font-medium text-paper-800/75 underline decoration-paper-300 underline-offset-4 hover:text-paper-900"
        >
          ← Öğretmen listesi
        </Link>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!teacher && !error && (
        <div className="mt-8 text-sm text-paper-800/55">Yükleniyor…</div>
      )}

      {teacher && (
        <>
          {profileSchema ? (
            <script
              type="application/ld+json"
              suppressHydrationWarning
              dangerouslySetInnerHTML={{ __html: JSON.stringify(profileSchema) }}
            />
          ) : null}
          <section className="mt-8 overflow-hidden rounded-[2rem] border border-brand-200 bg-[radial-gradient(circle_at_top_left,#dffafe_0%,#ffffff_42%,#fff7ed_100%)] shadow-sm">
            <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-8">
              <div>
                <div className="flex flex-wrap gap-2">
                  {(profileSite?.trustBadges ?? profileTrustReasons(teacher)).slice(0, 4).map((badge) => (
                    <span key={badge} className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-brand-900 ring-1 ring-brand-100">
                      {badge}
                    </span>
                  ))}
                </div>
                <h1 className="mt-5 max-w-3xl text-3xl font-semibold tracking-tight text-paper-950 sm:text-4xl">
                  {heroHeadline}
                </h1>
                <p className="mt-4 max-w-3xl text-base leading-relaxed text-paper-800/75">
                  {heroSubheadline}
                </p>
                <div className="mt-5 flex flex-wrap gap-3 text-sm text-paper-800/70">
                  <span>{profileSite?.locationLabel ?? ([teacher.district_name, teacher.city_name].filter(Boolean).join(", ") || "Online / Türkiye")}</span>
                  <span>·</span>
                  <span>{profileSite?.ratingLabel ?? (teacher.rating_count ? `★ ${Number(teacher.rating_avg ?? 0).toFixed(1)} (${teacher.rating_count})` : "Yeni profil")}</span>
                  <span>·</span>
                  <span>{profileSite?.priceLabel ?? hourlyRange ?? "Ücret teklif sonrası"}</span>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href={demoTalepEntryHref}
                    onClick={() =>
                      trackEvent("demo_request_start", {
                        entityType: "teacher",
                        entityId: teacher.id,
                        metadata: { source: "teacher_profile_hero", teacherName: teacher.display_name },
                      })
                    }
                    className="rounded-xl bg-brand-800 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-900"
                  >
                    Demo ders talep et
                  </Link>
                  <Link
                    href={talepEntryHref}
                    className="rounded-xl border border-brand-200 bg-white/85 px-5 py-3 text-sm font-semibold text-brand-900 hover:bg-white"
                  >
                    Teklif al
                  </Link>
                  <button
                    type="button"
                    disabled={shortlistBusy}
                    onClick={() => void addToShortlist()}
                    className="rounded-xl border border-paper-300 bg-white/80 px-5 py-3 text-sm font-semibold text-paper-900 hover:bg-white disabled:opacity-50"
                  >
                    {shortlistBusy ? "Ekleniyor…" : "Kısa listeye ekle"}
                  </button>
                </div>
                {shortlistOk ? <p className="mt-2 text-xs font-medium text-brand-900">{shortlistOk}</p> : null}
              </div>
              <aside className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-800/70">
                  Profil vitrini
                </div>
                <div className="mt-4 grid gap-3">
                  {heroStats.map((stat) => (
                    <div key={stat.label} className="rounded-xl border border-paper-200 bg-paper-50 p-3">
                      <div className="text-xs text-paper-800/55">{stat.label}</div>
                      <div className="mt-1 text-sm font-semibold text-paper-950">{stat.value}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-xl border border-warm-200 bg-warm-50 p-3">
                  <div className="text-xs font-semibold text-warm-950">BenimÖğretmenim farkı</div>
                  <p className="mt-1 text-xs leading-relaxed text-warm-900/80">
                    Demo, güvenli ödeme, canlı sınıf ve veliye görünür ders sonrası takip aynı süreçte ilerler.
                  </p>
                </div>
              </aside>
            </div>
          </section>

          <nav className="mt-4 flex gap-2 overflow-x-auto rounded-2xl border border-paper-200 bg-white p-2 text-sm">
            {[
              ["Hakkımda", "#hakkimda"],
              ["Güven", "#guven"],
              ["Uzmanlıklar", "#uzmanliklar"],
              ["Ders yöntemi", "#ders-yontemi"],
              ["Kanıtlar", "#kanitlar"],
              ["Yorumlar", "#yorumlar"],
              ["SSS", "#sss"],
            ].map(([label, href]) => (
              <a key={href} href={href} className="shrink-0 rounded-xl px-3 py-2 font-medium text-paper-800 hover:bg-brand-50 hover:text-brand-900">
                {label}
              </a>
            ))}
          </nav>

          <div id="guven" className="mt-6 rounded-2xl border border-paper-200 bg-white p-6">
            <h2 className="text-xl font-semibold tracking-tight text-paper-900">
              Güven ve karar merkezi
            </h2>
            <div className="mt-2 text-sm text-paper-800/75">
              {teacher.display_name} · {teacher.city_name ?? "Şehir belirtilmemiş"}
              {teacher.district_name ? ` · ${teacher.district_name}` : ""}
              {" · "}
              {teacher.verification_status === "verified"
                ? "Doğrulanmış profil"
                : `Profil: ${teacher.verification_status}`}
            </div>
            <div className="mt-4 rounded-xl border border-paper-100 bg-paper-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-paper-900">Güven ve kalite</h2>
                  <p className="mt-1 text-xs text-paper-800/65">
                    Profil doluluğu, doğrulama, video, doküman ve ders geçmişine göre.
                  </p>
                </div>
                <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-paper-900 ring-1 ring-paper-200">
                  {qualityLabel(teacher.profile_quality_score)} · {teacher.profile_quality_score ?? 0}/100
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {teacher.verification_status === "verified" && (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-900">
                    Doğrulanmış profil
                  </span>
                )}
                {teacher.has_video && (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-900">
                    Video tanıtım
                  </span>
                )}
                {teacher.has_exam_docs && (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-900">
                    Doküman / sınav içeriği
                  </span>
                )}
                {teacher.has_platform_links && (
                  <span className="rounded-full bg-paper-100 px-2 py-0.5 text-[11px] font-medium text-paper-800">
                    Platform bağlantıları
                  </span>
                )}
                {teacher.branch_count > 0 && (
                  <span className="rounded-full bg-paper-100 px-2 py-0.5 text-[11px] font-medium text-paper-800">
                    {teacher.branch_count} branş
                  </span>
                )}
                {teacher.completed_sessions_count > 0 && (
                  <span className="rounded-full bg-paper-100 px-2 py-0.5 text-[11px] font-medium text-paper-800">
                    {teacher.completed_sessions_count} tamamlanan ders
                  </span>
                )}
                <span className="rounded-full bg-warm-50 px-2 py-0.5 text-[11px] font-medium text-warm-900">
                  Güvenli ödeme ve paket süreci
                </span>
              </div>
              <div className="mt-4 rounded-xl border border-paper-200 bg-white p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-paper-800/55">
                  Karar özeti
                </div>
                <div className="mt-1 text-sm font-semibold text-paper-900">{profileDecisionLabel(teacher)}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(profileTrustReasons(teacher).length
                    ? profileTrustReasons(teacher)
                    : ["Yeni profil; demo talebiyle beklenti ve yöntem netleşir"]
                  ).map((reason) => (
                    <span key={reason} className="rounded-full bg-paper-50 px-2 py-0.5 text-[11px] text-paper-800 ring-1 ring-paper-200">
                      {reason}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-paper-200 bg-white p-3">
                  <div className="text-xs font-semibold text-paper-900">Doğrulama anlamı</div>
                  <p className="mt-1 text-xs leading-relaxed text-paper-800/65">
                    {teacher.trust_summary?.verificationLabel ??
                      (teacher.verification_status === "verified"
                        ? "Platform, profil bilgilerini ve güven kayıtlarını incelemiş."
                        : "Profil henüz tam doğrulanmamış; demo ve ek bilgi isteği önerilir.")}
                  </p>
                </div>
                <div className="rounded-xl border border-paper-200 bg-white p-3">
                  <div className="text-xs font-semibold text-paper-900">Fiyat bilgisi</div>
                  <p className="mt-1 text-xs leading-relaxed text-paper-800/65">
                    {hourlyRange
                      ? `Branşlarda saatlik aralık: ${hourlyRange}.`
                      : (teacher.trust_summary?.pricing.note ?? "Net ücret demo/talep sonrası öğretmen teklifiyle belirlenir.")}
                  </p>
                </div>
                <div className="rounded-xl border border-paper-200 bg-white p-3">
                  <div className="text-xs font-semibold text-paper-900">Ödeme koruması</div>
                  <p className="mt-1 text-xs leading-relaxed text-paper-800/65">
                    {teacher.trust_summary?.paymentProtection ??
                      "Paket ve ders ödemeleri kayıtlı ilerler; sorun olursa ödeme ve ders kayıtları birlikte incelenir."}
                  </p>
                  <Link href="/guven" className="mt-2 inline-flex text-xs font-semibold text-brand-900 underline">
                    Güven merkezini oku
                  </Link>
                </div>
              </div>
            </div>

            <div id="ders-yontemi" className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="rounded-2xl border border-brand-200 bg-[radial-gradient(circle_at_top_left,#ecfeff_0%,#ffffff_42%,#fff7ed_100%)] p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-brand-900/70">
                  Premium profil özeti
                </div>
                <h2 className="mt-2 text-lg font-semibold text-paper-900">
                  {teacher.display_name} ile ders öncesi beklenti net, ders sonrası takip ölçülebilir.
                </h2>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl bg-white/80 p-3 ring-1 ring-brand-100">
                    <div className="text-lg font-semibold text-paper-900">
                      {teacher.completed_sessions_count}
                    </div>
                    <div className="text-xs text-paper-800/60">Tamamlanan ders</div>
                  </div>
                  <div className="rounded-xl bg-white/80 p-3 ring-1 ring-brand-100">
                    <div className="text-lg font-semibold text-paper-900">
                      {teacher.branch_count}
                    </div>
                    <div className="text-xs text-paper-800/60">Branş kapsamı</div>
                  </div>
                  <div className="rounded-xl bg-white/80 p-3 ring-1 ring-brand-100">
                    <div className="text-lg font-semibold text-paper-900">
                      {responseSignalLabel(teacher)}
                    </div>
                    <div className="text-xs text-paper-800/60">Uygunluk</div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-paper-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-paper-900">Örnek ders süreci</h2>
                <ol className="mt-3 space-y-2">
                  {(profileSite?.methodSteps ?? sampleLessonFlow.map((item) => ({ title: item, body: "" }))).map((item, index) => (
                    <li key={item.title} className="flex gap-2 text-sm text-paper-800">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-900">
                        {index + 1}
                      </span>
                      <span>
                        <span className="font-semibold text-paper-900">{item.title}</span>
                        {item.body ? <span className="mt-0.5 block text-xs leading-relaxed text-paper-800/60">{item.body}</span> : null}
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="mt-3 text-xs text-paper-800/55">
                  {profileSite?.availabilitySummary ??
                    "Demo derste öğretmenin yöntemi görülür; paket kararı sonrasında ödeme cüzdanda güvenceye alınır."}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-warm-200 bg-warm-50/70 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-warm-900/70">
                Ders güvencesi
              </div>
              <h2 className="mt-2 text-base font-semibold text-paper-900">
                Demo, teklif, ödeme güvencesi ve canlı sınıf aynı kayıtlı süreçte ilerler.
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-paper-800/70">
                Öğretmeni tanıdıktan sonra paket, oturum, ödeme ve ders sonu değerlendirme aynı panelde kalır.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {[
                  ["1", "Demo veya talep", "Önce beklenti ve yöntem netleşir."],
                  ["2", "Ödeme güvencesi", "Ödeme ders tamamlanmadan aktarılmaz."],
                  ["3", "Ders sonu takip", "Özet, ödev ve ilerleme veliye görünür."],
                ].map(([step, title, body]) => (
                  <div key={step} className="rounded-xl border border-warm-200 bg-white/80 p-3">
                    <div className="text-[11px] font-semibold text-warm-900">Adım {step}</div>
                    <div className="mt-1 text-xs font-semibold text-paper-900">{title}</div>
                    <p className="mt-1 text-xs leading-relaxed text-paper-800/60">{body}</p>
                  </div>
                ))}
              </div>
            </div>

            <section className="mt-4 rounded-2xl border border-brand-200 bg-brand-50/50 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-900/70">
                    Sadece ilan değil, yönetilen ders süreci
                  </div>
                  <h2 className="mt-2 text-base font-semibold text-paper-950">
                    Öğretmeni seçtikten sonra süreç platform içinde görünür kalır.
                  </h2>
                </div>
                <Link href="/guven" className="text-xs font-semibold text-brand-900 underline">
                  Güven merkezini incele
                </Link>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                {[
                  {
                    title: "Demo ile başla",
                    body: "Öğretmenin anlatımı, öğrencinin seviyesi ve hedef planı paket öncesi netleşir.",
                  },
                  {
                    title: "Ödeme koruması",
                    body: "Cüzdan kaydı sayesinde ders tamamlanmadan ödeme doğrudan aktarılmaz.",
                  },
                  {
                    title: "Canlı sınıf kaydı",
                    body: "Ders oturumları, katılım ve ders sonrası notlar tek panelde takip edilir.",
                  },
                  {
                    title: "Veli görünürlüğü",
                    body: "Ödev, kazanım testi ve ders sonu notları aile kararını destekler.",
                  },
                ].map((item) => (
                  <article key={item.title} className="rounded-xl border border-brand-100 bg-white p-3">
                    <h3 className="text-sm font-semibold text-paper-950">{item.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-paper-800/65">{item.body}</p>
                  </article>
                ))}
              </div>
              {profileSite?.proofSummary?.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {profileSite.proofSummary.map((proof) => (
                    <span key={proof} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-brand-900 ring-1 ring-brand-100">
                      {proof}
                    </span>
                  ))}
                </div>
              ) : null}
            </section>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={demoTalepEntryHref}
                onClick={() =>
                  trackEvent("demo_request_start", {
                    entityType: "teacher",
                    entityId: teacher.id,
                    metadata: { source: "teacher_profile", teacherName: teacher.display_name },
                  })
                }
                className="inline-flex rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-900"
              >
                Demo ders talep et
              </Link>
              <Link
                href={talepEntryHref}
                className="inline-flex rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-900 hover:bg-brand-100"
              >
                Talep oluştur
              </Link>
              <RegisterNavLink className="inline-flex items-center rounded-xl border border-paper-300 bg-white px-4 py-2.5 text-sm font-medium text-paper-900 hover:bg-paper-50">
                Kayıt ol
              </RegisterNavLink>
            </div>

            {authToken ? (
              <div className="mt-6 rounded-xl border border-paper-200 bg-paper-50/80 p-4">
                <h2 className="text-sm font-semibold text-paper-900">Doğrudan ders anlaşması</h2>
                <p className="mt-1 text-xs text-paper-800/75">
                  Toplam tutar cüzdandan düşer; ders tamamlanınca öğretmene aktarılır.{" "}
                  <Link className="font-medium text-brand-800 underline-offset-4 hover:underline" href="/student/panel">
                    Cüzdan
                  </Link>
                  .
                </p>
                {directError && (
                  <div className="mt-2 text-sm text-red-700">{directError}</div>
                )}
                {directOk && (
                  <div className="mt-2 text-sm text-brand-900">{directOk}</div>
                )}
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <label className="text-sm text-paper-900">
                    Tutar (TL)
                    <input
                      type="text"
                      inputMode="decimal"
                      value={directTl}
                      onChange={(e) => setDirectTl(e.target.value)}
                      className="ml-0 mt-1 block w-32 rounded-lg border border-paper-200 bg-white px-2 py-1.5 font-mono text-sm outline-none focus:border-brand-400"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={directBusy}
                    onClick={() => void createDirectBooking()}
                    className="rounded-xl bg-brand-800 px-3 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-50"
                  >
                    {directBusy ? "…" : "Anlaşma oluştur"}
                  </button>
                  {pendingDirectId && (
                    <button
                      type="button"
                      disabled={directFundBusy}
                      onClick={() => void fundPendingDirect()}
                      className="rounded-xl border border-paper-300 bg-white px-3 py-2 text-sm font-medium text-paper-900 hover:bg-paper-50 disabled:opacity-50"
                    >
                      {directFundBusy ? "…" : "Cüzdanımdan öde"}
                    </button>
                  )}
                  <Link
                    className="rounded-xl border border-paper-300 bg-white px-3 py-2 text-sm font-medium text-paper-900 hover:bg-paper-50"
                    href="/student/dogrudan-dersler"
                  >
                    Anlaşmalarım
                  </Link>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-paper-800/55">
                Doğrudan anlaşma için{" "}
                <Link className="font-medium text-brand-800 underline-offset-4 hover:underline" href={loginReturnHref}>
                  giriş yapın
                </Link>{" "}
                (öğrenci; abonelik ve cüzdan gerekir).
              </p>
            )}

            {(teacher.video_url ||
              teacher.instagram_url ||
              (teacher.platform_links_jsonb?.length ?? 0) > 0 ||
              (teacher.exam_docs_jsonb?.length ?? 0) > 0) && (
              <div id="kanitlar" className="mt-8">
                <h2 className="text-sm font-semibold text-paper-900">
                  Bağlantılar
                </h2>
                <div className="mt-3 space-y-3 text-sm">
                  {teacher.video_url && (
                    <div>
                      <div className="text-xs font-medium text-paper-800/55">
                        Video
                      </div>
                      {(() => {
                        const emb = getVideoEmbed(teacher.video_url ?? "");
                        if (!emb) return null;
                        return (
                          <div className="mt-2 overflow-hidden rounded-xl border border-paper-200 bg-paper-50">
                            <div className="relative aspect-video">
                              <iframe
                                src={emb.embedUrl}
                                title="Video tanıtım"
                                className="absolute inset-0 h-full w-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            </div>
                          </div>
                        );
                      })()}
                      <a
                        href={teacher.video_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-brand-800 underline decoration-brand-200 underline-offset-4"
                      >
                        Video tanıtımı aç
                      </a>
                    </div>
                  )}

                  {teacher.instagram_url && (
                    <div>
                      <div className="text-xs font-medium text-paper-800/55">
                        Instagram
                      </div>
                      <a
                        href={teacher.instagram_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-brand-800 underline decoration-brand-200 underline-offset-4"
                      >
                        {instagramHandle(teacher.instagram_url) ??
                          "Instagram profili"}
                      </a>
                      {hostLabel(teacher.instagram_url) && (
                        <span className="ml-2 text-xs text-paper-800/50">
                          ({hostLabel(teacher.instagram_url)})
                        </span>
                      )}
                    </div>
                  )}

                  {(teacher.platform_links_jsonb?.length ?? 0) > 0 && (
                    <div>
                      <div className="text-xs font-medium text-paper-800/55">
                        Özel platformlar
                      </div>
                      <ul className="mt-1 space-y-1">
                        {(teacher.platform_links_jsonb ?? []).map((x, i) => (
                          <li key={`${x.url}-${i}`}>
                            <a
                              href={x.url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-medium text-brand-800 underline decoration-brand-200 underline-offset-4"
                            >
                              {x.title}
                            </a>
                            {hostLabel(x.url) && (
                              <span className="ml-2 text-xs text-paper-800/50">
                                ({hostLabel(x.url)})
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {(teacher.exam_docs_jsonb?.length ?? 0) > 0 && (
                    <div>
                      <div className="text-xs font-medium text-paper-800/55">
                        Dokümanlar
                      </div>
                      {(() => {
                        const docs = [...(teacher.exam_docs_jsonb ?? [])].sort(
                          (a, b) =>
                            kindSortKey(a.kind) - kindSortKey(b.kind) ||
                            a.title.localeCompare(b.title, "tr"),
                        );
                        const groups = new Map<string, typeof docs>();
                        for (const d of docs) {
                          const lbl = kindLabel(d.kind) ?? "Diğer";
                          const prev = groups.get(lbl);
                          if (prev) prev.push(d);
                          else groups.set(lbl, [d]);
                        }
                        const entries = Array.from(groups.entries());
                        return (
                          <div className="mt-2 space-y-3">
                            {entries.map(([lbl, items]) => (
                              <div key={lbl}>
                                <div className="text-xs font-semibold text-paper-800">
                                  {lbl}
                                </div>
                                <ul className="mt-1 space-y-1">
                                  {items.map((x, i) => (
                                    <li key={`${x.url}-${i}`}>
                                      <a
                                        href={x.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="font-medium text-brand-800 underline decoration-brand-200 underline-offset-4"
                                      >
                                        {x.title}
                                      </a>
                                      {hostLabel(x.url) && (
                                        <span className="ml-2 text-xs text-paper-800/50">
                                          ({hostLabel(x.url)})
                                        </span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            )}

            {teacher.bio_raw && (
              <div id="hakkimda" className="mt-8">
                <h2 className="text-sm font-semibold text-paper-900">Hakkında</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-paper-800/85">
                  {teacher.bio_raw}
                </p>
              </div>
            )}

            <div id="uzmanliklar" className="mt-8">
              <h2 className="text-sm font-semibold text-paper-900">Branşlar</h2>
              {branches.length === 0 ? (
                <p className="mt-2 text-sm text-paper-800/55">Branş kaydı yok.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {branches.map((b) => (
                    <li
                      key={b.branch_id}
                      className="rounded-xl border border-paper-100 px-3 py-2 text-sm text-paper-800"
                    >
                      <span className="font-medium">{b.branch_name}</span>
                      {b.is_primary && (
                        <span className="ml-2 text-xs text-brand-700">(birincil)</span>
                      )}
                      {b.years_experience != null && (
                        <span className="ml-2 text-xs text-paper-800/55">
                          {b.years_experience} yıl
                        </span>
                      )}
                      {b.hourly_rate_min_minor != null &&
                        b.hourly_rate_max_minor != null && (
                          <div className="mt-1 text-xs text-paper-800/55">
                            Saatlik (TL): {minorToTl(b.hourly_rate_min_minor)} –{" "}
                            {minorToTl(b.hourly_rate_max_minor)}
                          </div>
                        )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <section id="sss" className="mt-8 rounded-2xl border border-paper-200 bg-white p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-800/70">
                  Sık sorulan sorular
                </div>
                <h2 className="mt-1 text-lg font-semibold text-paper-900">Derse başlamadan önce bilmeniz gerekenler</h2>
              </div>
              <Link href={demoTalepEntryHref} className="text-sm font-semibold text-brand-800 underline">
                Demo talebiyle netleştir
              </Link>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {(profileSite?.faq ?? [
                {
                  question: "Derse başlamadan önce öğretmeni tanıyabilir miyim?",
                  answer: "Evet. Demo talebiyle yöntem, seviye ve beklenti netleşir.",
                },
                {
                  question: "Ödeme nasıl ilerler?",
                  answer: "Platform içi ödeme ve ders kayıtları birlikte takip edilir.",
                },
                {
                  question: "Veli gelişimi takip eder mi?",
                  answer: "Ders sonu notları ve ödev durumu veli panelinde görünür.",
                },
              ]).map((item) => (
                <article key={item.question} className="rounded-xl border border-paper-200 bg-paper-50 p-4">
                  <h3 className="text-sm font-semibold text-paper-950">{item.question}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-paper-800/65">{item.answer}</p>
                </article>
              ))}
            </div>
          </section>

          <div id="yorumlar" className="mt-8 rounded-xl border border-paper-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-paper-900">Yorumlar</h2>
            <p className="mt-1 text-xs text-paper-800/55">
              Tamamlanan derslerden; yorumcu adı gizlilik için kısaltılır.
            </p>
            {reviews.length === 0 ? (
              <p className="mt-4 text-sm text-paper-800/75">Henüz yorum yok.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {reviews.map((rev, i) => (
                  <li
                    key={`${rev.created_at}-${i}`}
                    className="border-b border-paper-100 pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-paper-900">
                        {rev.reviewer_label}
                      </span>
                      <span className="text-sm text-brand-800">
                        {"★".repeat(Math.min(5, Math.max(1, rev.rating)))}
                      </span>
                    </div>
                    <div className="text-xs text-paper-800/55">
                      {new Date(rev.created_at).toLocaleDateString("tr-TR")}
                    </div>
                    {rev.comment && (
                      <p className="mt-2 text-sm text-paper-800/85">{rev.comment}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <aside className="fixed bottom-6 right-6 z-30 hidden w-80 rounded-2xl border border-brand-200 bg-white/95 p-4 shadow-xl shadow-paper-900/10 backdrop-blur sm:block">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-800/70">
              Hızlı karar
            </div>
            <h2 className="mt-1 text-base font-semibold text-paper-950">
              {teacher.display_name} ile başlamadan önce demo veya teklif alın
            </h2>
            <div className="mt-2 text-xs text-paper-800/60">
              {profileSite?.priceLabel ?? hourlyRange ?? "Ücret teklif sonrası"} · {profileSite?.locationLabel ?? teacher.city_name ?? "Online"}
            </div>
            <ul className="mt-3 space-y-1.5">
              {quickDecisionReasons.slice(0, 3).map((reason) => (
                <li key={reason} className="flex gap-2 text-xs text-paper-800/70">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-700" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link
                href={demoTalepEntryHref}
                onClick={() =>
                  trackEvent("demo_request_start", {
                    entityType: "teacher",
                    entityId: teacher.id,
                    metadata: { source: "teacher_profile_desktop_sticky", teacherName: teacher.display_name },
                  })
                }
                className="rounded-xl bg-brand-800 px-3 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-900"
              >
                Demo al
              </Link>
              <Link
                href={talepEntryHref}
                className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2.5 text-center text-sm font-semibold text-brand-900 hover:bg-brand-100"
              >
                Teklif al
              </Link>
            </div>
            <button
              type="button"
              disabled={shortlistBusy}
              onClick={() => void addToShortlist()}
              className="mt-2 w-full rounded-xl border border-paper-300 bg-white px-3 py-2 text-sm font-semibold text-paper-900 hover:bg-paper-50 disabled:opacity-50"
            >
              {shortlistBusy ? "Kısa listeye ekleniyor…" : "Kısa listeye ekle"}
            </button>
          </aside>
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-paper-200 bg-white/95 px-4 py-3 backdrop-blur sm:hidden">
            <div className="mx-auto flex max-w-md gap-2">
              <Link
                href={demoTalepEntryHref}
                onClick={() =>
                  trackEvent("demo_request_start", {
                    entityType: "teacher",
                    entityId: teacher.id,
                    metadata: { source: "teacher_profile_sticky", teacherName: teacher.display_name },
                  })
                }
                className="flex-1 rounded-xl bg-brand-800 px-3 py-2.5 text-center text-sm font-semibold text-white"
              >
                Demo talep et
              </Link>
              <Link
                href={talepEntryHref}
                className="flex-1 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2.5 text-center text-sm font-semibold text-brand-900"
              >
                Teklif al
              </Link>
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
