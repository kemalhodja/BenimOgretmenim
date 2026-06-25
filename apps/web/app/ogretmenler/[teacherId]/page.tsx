"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { RegisterNavLink } from "../../components/AuthNavLinks";
import { apiFetch } from "../../lib/api";
import { clearToken, getRoleFromToken, getToken } from "../../lib/auth";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { trackEvent } from "../../lib/trackEvent";
import { publicSiteHost } from "../../lib/siteUrl";

type TeacherDetail = {
  id: string;
  display_name: string;
  contact_phone?: string | null;
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
  has_active_subscription?: boolean;
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

function normalizePhoneForWhatsApp(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("90") && digits.length >= 12) return digits;
  if (digits.startsWith("0") && digits.length === 11) return `90${digits.slice(1)}`;
  if (digits.length === 10) return `90${digits}`;
  return digits.length >= 10 ? digits : null;
}

function telHref(raw: string): string {
  const compact = raw.replace(/[^\d+]/g, "");
  return `tel:${compact}`;
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

function decisionConfidenceScore(teacher: TeacherDetail): number {
  let score = Math.min(55, Math.round(Number(teacher.profile_quality_score ?? 0) * 0.55));
  if (teacher.verification_status === "verified") score += 12;
  if (teacher.has_video) score += 8;
  if (teacher.has_exam_docs) score += 8;
  if (teacher.completed_sessions_count >= 10) score += 10;
  else if (teacher.completed_sessions_count > 0) score += 5;
  if (Number(teacher.rating_count ?? 0) > 0) score += 7;
  return Math.min(100, score);
}

function idealFitCards(teacher: TeacherDetail, branches: BranchRow[]) {
  const primary = branches.find((branch) => branch.is_primary) ?? branches[0] ?? null;
  return [
    {
      title: `${primary?.branch_name ?? "Özel ders"} için hedefli başlangıç`,
      body: primary
        ? `${primary.branch_name} alanında seviye, hedef ve ders sıklığı demo/talep aşamasında netleştirilir.`
        : "Öğrencinin hedefi ve ders beklentisi ilk görüşmede netleştirilir.",
    },
    {
      title: teacher.has_video ? "Yöntemi önceden görerek karar" : "Demo ile yöntemi netleştirme",
      body: teacher.has_video
        ? "Tanıtım videosu, öğretmenin anlatım tarzını teklif öncesi anlamaya yardım eder."
        : "Video yoksa demo talebiyle anlatım tarzı ve iletişim uyumu hızlıca ölçülür.",
    },
    {
      title: teacher.completed_sessions_count > 0 ? "Ders geçmişiyle güven" : "Yeni eşleşme için güvenli deneme",
      body:
        teacher.completed_sessions_count > 0
          ? `${teacher.completed_sessions_count} tamamlanan ders kaydı karar verirken ek güven sinyali sağlar.`
          : "İlk paket öncesinde demo ve teklif akışıyla beklenti netleşir.",
    },
    {
      title: teacher.has_exam_docs ? "Kanıt ve içerik inceleme" : "Ek doküman isteyebilme",
      body: teacher.has_exam_docs
        ? "Paylaşılan dokümanlar ve sınav içerikleri öğretmenin hazırlık tarzını görünür kılar."
        : "Talep mesajında örnek materyal, kaynak veya ders planı isteyebilirsiniz.",
    },
  ];
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

function displayNameInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  const initials = parts.map((part) => part[0]?.toLocaleUpperCase("tr-TR")).join("");
  return initials || "Ö";
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

function extractTeacherIdParam(raw: string): string {
  const uuid = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)?.[0];
  return uuid ?? raw;
}

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
  const rawTeacherParam =
    typeof params.teacherId === "string" ? params.teacherId : "";
  const teacherId = extractTeacherIdParam(rawTeacherParam);
  const pathWithQuery = useMemo(() => {
    const base = pathname || (teacherId ? `/ogretmenler/${teacherId}` : "/ogretmenler");
    const q = searchParams.toString();
    return q ? `${base}?${q}` : base;
  }, [pathname, teacherId, searchParams]);
  const loginReturnHref = loginHrefWithReturn(pathWithQuery);

  const [teacher, setTeacher] = useState<TeacherDetail | null>(null);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [teacherLessonVideos, setTeacherLessonVideos] = useState<
    Array<{ id: string; title: string; topicTitle: string; videoKind: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [directTl, setDirectTl] = useState("500,00");
  const [directBusy, setDirectBusy] = useState(false);
  const [directError, setDirectError] = useState<string | null>(null);
  const [directOk, setDirectOk] = useState<string | null>(null);
  const [pendingDirectId, setPendingDirectId] = useState<string | null>(null);
  const [directFundBusy, setDirectFundBusy] = useState(false);
  const [availabilitySlots, setAvailabilitySlots] = useState<
    Array<{ start: string; end: string; label: string }>
  >([]);
  const [selectedSlotStart, setSelectedSlotStart] = useState("");
  const [shortlistBusy, setShortlistBusy] = useState(false);
  const [shortlistOk, setShortlistOk] = useState<string | null>(null);
  const [shareOk, setShareOk] = useState<string | null>(null);
  const [introCopyOk, setIntroCopyOk] = useState<string | null>(null);

  const authRole = getRoleFromToken(authToken);
  const requestBasePath = authRole === "guardian" ? "/guardian/requests" : "/student/requests";
  const primaryBranchId = useMemo(() => {
    const p = branches.find((b) => b.is_primary);
    return (p ?? branches[0])?.branch_id;
  }, [branches]);

  const talepPath = primaryBranchId
    ? `${requestBasePath}?branchId=${primaryBranchId}`
    : requestBasePath;
  const talepEntryHref = authToken ? talepPath : loginHrefWithReturn(talepPath);
  const demoTalepQuery = new URLSearchParams();
  demoTalepQuery.set("requestKind", "demo");
  if (primaryBranchId) demoTalepQuery.set("branchId", String(primaryBranchId));
  if (teacherId) demoTalepQuery.set("teacherId", teacherId);
  if (teacher?.display_name) demoTalepQuery.set("teacherName", teacher.display_name);
  const demoTalepPath = `${requestBasePath}?${demoTalepQuery.toString()}`;
  const demoTalepEntryHref = authToken ? demoTalepPath : loginHrefWithReturn(demoTalepPath);
  const hourlyRange = useMemo(() => hourlyRateRangeLabel(branches), [branches]);

  useEffect(() => {
    setAuthToken(getToken());
  }, []);

  useEffect(() => {
    if (!teacherId || getRoleFromToken(authToken) !== "student" || !authToken) {
      setTeacherLessonVideos([]);
      return;
    }
    let cancelled = false;
    void apiFetch<{ videos: Array<{ id: string; title: string; topicTitle: string; videoKind: string }> }>(
      `/v1/lesson-videos/by-teacher/${teacherId}`,
    )
      .then((r) => {
        if (!cancelled) setTeacherLessonVideos(r.videos ?? []);
      })
      .catch(() => {
        if (!cancelled) setTeacherLessonVideos([]);
      });
    return () => {
      cancelled = true;
    };
  }, [teacherId, authToken]);

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

  useEffect(() => {
    if (!teacherId) return;
    apiFetch<{ slots: Array<{ start: string; end: string; label: string }> }>(
      `/v1/teachers/${teacherId}/availability-slots`,
    )
      .then((r) => setAvailabilitySlots(r.slots ?? []))
      .catch(() => setAvailabilitySlots([]));
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
      const selected = availabilitySlots.find((s) => s.start === selectedSlotStart);
      const r = await apiFetch<{
        booking: { id: string };
        next: { fundFromWallet: string };
      }>("/v1/student-platform/direct-bookings", {
        method: "POST",
        token: authToken,
        body: JSON.stringify({
          teacherId,
          agreedAmountMinor,
          scheduledStart: selected?.start,
          scheduledEnd: selected?.end,
        }),
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
      setDirectOk("Ödeme cüzdanınızdan alındı. Mesajlar sayfasından öğretmenle iletişime geçebilirsiniz.");
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

  async function shareProfile() {
    if (!teacher) return;
    const primary =
      branches.find((branch) => branch.is_primary) ?? branches[0] ?? null;
    const publicPath = teacherProfilePath(teacher.display_name, primary?.branch_name, teacher.id);
    const shareUrl = typeof window !== "undefined" ? `${window.location.origin}${publicPath}` : publicPath;
    const nav = typeof window !== "undefined" ? window.navigator : null;
    const shareData = {
      title: `${teacher.display_name} | BenimÖğretmenim`,
      text: `${teacher.display_name} öğretmen profilini inceleyin: ${primaryBranch?.branch_name ?? "özel ders"}, demo talebi ve güvenli ödeme süreci.`,
      url: shareUrl,
    };
    try {
      if (nav?.share) {
        await nav.share(shareData);
        setShareOk("Paylaşım penceresi açıldı.");
      } else if (nav?.clipboard) {
        await nav.clipboard.writeText(shareUrl);
        setShareOk("Profil bağlantısı kopyalandı.");
      } else {
        setShareOk("Profil bağlantısını tarayıcı adres çubuğundan kopyalayabilirsiniz.");
      }
      trackEvent("teacher_profile_share", {
        entityType: "teacher",
        entityId: teacher.id,
        metadata: { source: "public_profile", teacherName: teacher.display_name },
      });
    } catch {
      setShareOk("Profil bağlantısı paylaşılmadı.");
    }
  }

  async function copyIntroText() {
    if (!teacher) return;
    const primary =
      branches.find((branch) => branch.is_primary) ?? branches[0] ?? null;
    const publicPath = teacherProfilePath(teacher.display_name, primary?.branch_name, teacher.id);
    const shareUrl = typeof window !== "undefined" ? `${window.location.origin}${publicPath}` : publicPath;
    const nav = typeof window !== "undefined" ? window.navigator : null;
    const text = `${teacherIntroMessage}\n\nProfilim: ${shareUrl}`;
    try {
      if (nav?.clipboard) {
        await nav.clipboard.writeText(text);
        setIntroCopyOk("Hazır tanıtım metni kopyalandı.");
        trackEvent("teacher_profile_intro_copy", {
          entityType: "teacher",
          entityId: teacher.id,
          metadata: { source: "public_profile", teacherName: teacher.display_name },
        });
      } else {
        setIntroCopyOk("Tarayıcı kopyalamayı desteklemiyor; metni seçerek kopyalayabilirsiniz.");
      }
    } catch {
      setIntroCopyOk("Tanıtım metni kopyalanamadı.");
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
      telephone: teacher.contact_phone ?? undefined,
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
      { label: "Konum", value: teacher?.city_name ?? "Çevrim içi" },
      { label: "Ücret", value: hourlyRange ?? "Teklif sonrası" },
    ];
  const teacherInitials = teacher ? displayNameInitials(teacher.display_name) : "Ö";
  const primaryBranchName =
    profileSite?.primaryBranchName ?? primaryBranch?.branch_name ?? "Özel ders";
  const publicProfilePath = teacher
    ? teacherProfilePath(teacher.display_name, primaryBranchName, teacher.id)
    : teacherId
      ? `/ogretmenler/${teacherId}`
      : "/ogretmenler";
  useEffect(() => {
    if (!teacher || !publicProfilePath.startsWith("/ogretmenler/")) return;
    if (pathname === publicProfilePath) return;
    const q = searchParams.toString();
    router.replace(q ? `${publicProfilePath}?${q}` : publicProfilePath);
  }, [pathname, publicProfilePath, router, searchParams, teacher]);
  const personalSiteHighlights = teacher
    ? [
        {
          title: "Kişisel ders yaklaşımı",
          body: teacher.bio_raw
            ? "Öğretmenin kendi anlatımı, hedefi ve ders tarzı bu sayfada tek yerde toplanır."
            : "Demo talebiyle öğretmenin ders tarzı ve öğrenciye uygun planı netleşir.",
        },
        {
          title: "Profesyonel tanıtım vitrini",
          body: `${primaryBranchName}, konum, fiyat aralığı, yorum ve kanıt bilgileri paylaşılabilir bir sayfada görünür.`,
        },
        {
          title: "Güvenli başvuru akışı",
          body: "Öğrenci veya veli bu sayfadan demo talebi oluşturabilir, teklif alabilir ve süreci platform içinde takip eder.",
        },
      ]
    : [];
  const teacherIntroMessage = teacher
    ? `Merhaba, ben ${teacher.display_name}. ${primaryBranchName} alanında öğrencinin seviyesini, hedefini ve ders ihtiyacını netleştirerek özel ders planı oluşturuyorum. Profilimde ders yaklaşımımı, uzmanlık alanlarımı, güven bilgilerini ve demo/teklif başvuru adımlarını inceleyebilirsiniz.`
    : "";
  const socialBioText = teacher
    ? `${teacher.display_name} | ${primaryBranchName} özel ders | Demo talebi, güvenli ödeme ve ders sonrası takip için profilimi inceleyin.`
    : "";
  const contactPhone = teacher?.contact_phone?.trim() || "";
  const whatsappPhone = normalizePhoneForWhatsApp(contactPhone);
  const whatsappText = teacher
    ? `Merhaba ${teacher.display_name}, BenimÖğretmenim profiliniz üzerinden ${primaryBranchName} dersi için bilgi almak istiyorum.`
    : "";
  const whatsappHref =
    whatsappPhone && whatsappText
      ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(whatsappText)}`
      : null;
  const brandKitCards = [
    {
      title: "WhatsApp / veli mesajı",
      body: "Hazır tanıtım metniyle öğretmen kendini daha profesyonel anlatır.",
    },
    {
      title: "Sosyal medya tanıtımı",
      body: "Kısa tanıtım cümlesi profil linkiyle birlikte kullanılabilir.",
    },
    {
      title: "Tek link başvuru",
      body: "Demo, teklif, kısa liste ve güven bilgileri aynı sayfada toplanır.",
    },
  ] as const;
  const outcomeRoadmap = [
    {
      step: "1",
      title: "Seviye ve hedef analizi",
      body: `${primaryBranchName} için öğrencinin eksik kazanımları, hedefi ve haftalık çalışma düzeni netleşir.`,
    },
    {
      step: "2",
      title: "Kişiye özel ders planı",
      body: "Konu anlatımı, soru çözümü, ödev takibi ve tekrar düzeni öğrencinin ihtiyacına göre planlanır.",
    },
    {
      step: "3",
      title: "Düzenli ölçüm ve geri bildirim",
      body: "Ders sonrası notlar, ödev durumu ve gelişim sinyalleri öğrenci/veli için görünür hale gelir.",
    },
    {
      step: "4",
      title: "Sürdürülebilir başarı rutini",
      body: "Amaç tek derslik destek değil; öğrencinin çalışma alışkanlığı ve özgüvenini kalıcı şekilde güçlendirmek.",
    },
  ] as const;
  const firstCallChecklist = [
    "Öğrencinin sınıfı, hedefi ve zorlandığı konular hazır mı?",
    "Haftalık kaç ders ve hangi günler uygun?",
    "Demo derste seviye analizi mi, konu anlatımı mı beklenecek?",
    "Ders sonrası ödev ve veli bilgilendirmesi nasıl takip edilecek?",
  ] as const;
  const audienceValueCards = [
    {
      title: "Öğrenci için",
      body: "Dersi sadece dinlemek yerine nerede eksik kaldığını görür, hedefe göre çalışma planı kazanır.",
    },
    {
      title: "Veli için",
      body: "Öğretmen seçimi, ödeme, ders takibi ve gelişim notları daha görünür ve kontrollü ilerler.",
    },
    {
      title: "Öğretmen için",
      body: "Profil linki, hazır tanıtım metni ve kanıt vitriniyle kendini profesyonel şekilde sunar.",
    },
  ] as const;
  const quickDecisionReasons =
    profileSite?.ctaReasons ??
    [
      "Demo ile öğretmeni tanı",
      "Teklif ve fiyatı netleştir",
      "Güvenli ödeme sürecine geç",
    ];
  const fitCards = teacher ? idealFitCards(teacher, branches) : [];
  const confidenceScore = teacher ? decisionConfidenceScore(teacher) : 0;
  const decisionQuestions = [
    `${primaryBranch?.branch_name ?? "Bu ders"} için ilk 2 haftada hangi hedefi koyarsınız?`,
    "Öğrencinin eksik kazanımlarını ilk derste nasıl ölçersiniz?",
    "Ders sonrası veli/öğrenci hangi notları görebilir?",
    "Paket başlamadan önce demo derste hangi çıktılar netleşir?",
  ];
  const proofCards = teacher
    ? [
        {
          title: "Tanışma videosu",
          ready: teacher.has_video,
          body: teacher.has_video
            ? "Anlatım tarzını ve iletişim dilini dersten önce görebilirsiniz."
            : "Video yoksa demo talebiyle anlatım tarzını ölçün.",
        },
        {
          title: "Doküman ve sınav içeriği",
          ready: teacher.has_exam_docs,
          body: teacher.has_exam_docs
            ? "Paylaşılan içerikler hazırlık tarzını ve kaynak kalitesini gösterir."
            : "Talep mesajında örnek doküman veya kaynak planı isteyin.",
        },
        {
          title: "Ders geçmişi",
          ready: teacher.completed_sessions_count > 0,
          body:
            teacher.completed_sessions_count > 0
              ? `${teacher.completed_sessions_count} tamamlanan ders kaydı var.`
              : "Yeni profillerde demo ve kısa paketle ilerlemek daha sağlıklıdır.",
        },
        {
          title: "Yorum sinyali",
          ready: Number(teacher.rating_count ?? 0) > 0,
          body:
            Number(teacher.rating_count ?? 0) > 0
              ? `${Number(teacher.rating_avg ?? 0).toFixed(1)} puan ve ${Number(teacher.rating_count ?? 0)} yorum.`
              : "İlk yorumlar oluşana kadar profil kanıtlarını ve demo deneyimini dikkate alın.",
        },
      ]
    : [];

  if (teacher && teacher.has_active_subscription === false) {
    return (
      <div className="bo-edu-bg min-h-screen">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <Link
            href="/ogretmenler"
            className="text-sm font-medium text-paper-800/75 underline decoration-paper-300 underline-offset-4 hover:text-paper-900"
          >
            ← Öğretmen listesi
          </Link>
          <section className="mt-8 overflow-hidden rounded-[2rem] border border-edu-blue-100 bg-white/94 shadow-xl shadow-paper-900/5">
            <div className="border-b border-edu-blue-100 bg-edu-blue-50/70 px-5 py-3 text-xs font-semibold text-paper-800/65">
              Sınırlı öğretmen profili
            </div>
            <div className="p-6 sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.5rem] bg-edu-indigo-950 text-2xl font-semibold text-white">
                  {teacherInitials}
                </div>
                <div>
                  <div className="text-sm font-semibold uppercase tracking-[0.22em] text-edu-indigo-700/70">
                    {primaryBranchName} öğretmeni
                  </div>
                  <h1 className="mt-3 text-3xl font-semibold tracking-tight text-paper-950 sm:text-4xl">
                    {teacher.display_name}
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-paper-800/65">
                    Bu öğretmen henüz aboneliğini tamamlamadığı için profilde yalnızca temel bilgiler gösterilir.
                    İletişim bilgileri, WhatsApp bağlantısı, tanıtım içerikleri ve detaylı vitrin abonelikten sonra açılır.
                  </p>
                </div>
              </div>
              <div className="mt-6 rounded-2xl border border-edu-blue-100 bg-edu-blue-50/65 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-edu-indigo-700/70">
                  Branş bilgileri
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {branches.length > 0 ? (
                    branches.map((branch) => (
                      <span
                        key={branch.branch_id}
                        className="rounded-full bg-white px-3 py-1 text-sm font-medium text-paper-900 ring-1 ring-paper-200"
                      >
                        {branch.branch_name}
                        {branch.is_primary ? " · ana branş" : ""}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-paper-800/60">Branş bilgisi henüz eklenmemiş.</span>
                  )}
                </div>
              </div>
              <div className="mt-6 rounded-2xl border border-edu-sun-300 bg-edu-sun-50 p-4">
                <div className="text-sm font-semibold text-edu-sun-900">Abonelik sonrası profil web sayfası açılır</div>
                <p className="mt-2 text-sm leading-relaxed text-edu-sun-900/75">
                  Öğretmen aboneliği aktif olduğunda bu sayfa tanıtım metni, güven kanıtları, ders yöntemi,
                  profil paylaşımı ve isteğe bağlı telefon/WhatsApp iletişimiyle kişisel web sayfası gibi kullanılabilir.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="bo-edu-bg min-h-screen">
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
          <section className="relative mt-8 overflow-hidden rounded-[2rem] border border-edu-indigo-200 bg-[radial-gradient(circle_at_top_left,#dbeafe_0%,#ffffff_36%,#ecfdf5_70%,#fffbeb_100%)] shadow-xl shadow-paper-900/5">
            <div className="bo-ambient-orb pointer-events-none absolute -left-12 top-14 h-36 w-36 rounded-full bg-edu-blue-400/30 blur-3xl" aria-hidden />
            <div className="bo-ambient-orb pointer-events-none absolute -right-10 bottom-14 h-40 w-40 rounded-full bg-edu-sun-300/34 blur-3xl [animation-delay:1.6s]" aria-hidden />
            <div className="bo-ambient-orb pointer-events-none absolute left-1/2 bottom-6 h-32 w-32 rounded-full bg-edu-success-300/22 blur-3xl [animation-delay:2.2s]" aria-hidden />
            <div className="bo-shimmer-line absolute inset-x-8 top-0 h-px bg-white/70" aria-hidden />
            <div className="border-b border-white/70 bg-white/55 px-5 py-3 backdrop-blur">
              <div className="flex flex-col gap-2 text-xs font-semibold text-paper-800/65 sm:flex-row sm:items-center sm:justify-between">
                <span>{teacher.display_name} kişisel ders sayfası</span>
                <span>{publicSiteHost()}{publicProfilePath}</span>
              </div>
            </div>
            <div className="grid gap-8 p-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:p-8">
              <div>
                <div className="flex flex-wrap gap-2">
                  {(profileSite?.trustBadges ?? profileTrustReasons(teacher)).slice(0, 4).map((badge) => (
                    <span key={badge} className="rounded-full bg-white/88 px-3 py-1 text-xs font-semibold text-edu-indigo-800 ring-1 ring-edu-indigo-100">
                      {badge}
                    </span>
                  ))}
                  <span className="rounded-full bg-edu-indigo-950 px-3 py-1 text-xs font-semibold text-white">
                    Paylaşılabilir profesyonel profil
                  </span>
                </div>
                <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start">
                  <div className="bo-float-delayed flex h-24 w-24 shrink-0 items-center justify-center rounded-[1.75rem] bg-edu-indigo-950 text-3xl font-semibold text-white shadow-lg shadow-edu-indigo-900/20">
                    {teacherInitials}
                  </div>
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-[0.22em] text-edu-indigo-700/70">
                      {primaryBranchName} öğretmeni
                    </div>
                    <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-paper-950 sm:text-5xl">
                      {heroHeadline}
                    </h1>
                  </div>
                </div>
                <p className="mt-5 max-w-3xl text-lg leading-relaxed text-paper-800/75">
                  {heroSubheadline}
                </p>
                <div className="mt-5 flex flex-wrap gap-2 text-sm font-medium text-paper-800/70">
                  <span className="rounded-full bg-white/80 px-3 py-1 ring-1 ring-paper-200">
                    {profileSite?.locationLabel ?? ([teacher.district_name, teacher.city_name].filter(Boolean).join(", ") || "Çevrim içi · Türkiye")}
                  </span>
                  <span className="rounded-full bg-white/80 px-3 py-1 ring-1 ring-paper-200">
                    {profileSite?.ratingLabel ?? (teacher.rating_count ? `★ ${Number(teacher.rating_avg ?? 0).toFixed(1)} (${teacher.rating_count})` : "Yeni profil")}
                  </span>
                  <span className="rounded-full bg-white/80 px-3 py-1 ring-1 ring-paper-200">
                    {profileSite?.priceLabel ?? hourlyRange ?? "Ücret teklif sonrası"}
                  </span>
                </div>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link
                    href={demoTalepEntryHref}
                    onClick={() =>
                      trackEvent("demo_request_start", {
                        entityType: "teacher",
                        entityId: teacher.id,
                        metadata: { source: "teacher_profile_hero", teacherName: teacher.display_name },
                      })
                    }
                    className="bo-glow-pulse rounded-xl bg-edu-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-edu-indigo-900/15 hover:bg-edu-indigo-800"
                  >
                    Demo ders talep et
                  </Link>
                  <Link
                    href={talepEntryHref}
                    className="rounded-xl border border-edu-indigo-200 bg-white/85 px-5 py-3 text-sm font-semibold text-edu-indigo-800 hover:bg-white"
                  >
                    Teklif al
                  </Link>
                  <button
                    type="button"
                    onClick={() => void shareProfile()}
                    className="rounded-xl border border-paper-300 bg-white/80 px-5 py-3 text-sm font-semibold text-paper-900 hover:bg-white"
                  >
                    Profili paylaş
                  </button>
                  {contactPhone && (
                    <a
                      href={telHref(contactPhone)}
                      className="rounded-xl border border-edu-blue-200 bg-white/85 px-5 py-3 text-sm font-semibold text-edu-blue-900 hover:bg-white"
                    >
                      Telefonla ara
                    </a>
                  )}
                  {whatsappHref && (
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl bg-[#25D366] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-green-700/15 hover:bg-[#1eb85a]"
                    >
                      WhatsApp ile mesajlaş
                    </a>
                  )}
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
                {shareOk ? <p className="mt-2 text-xs font-medium text-paper-800/70">{shareOk}</p> : null}
              </div>
              <aside className="bo-card-lift rounded-[1.75rem] border border-white/80 bg-white/92 p-5 shadow-xl shadow-edu-indigo-900/10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-edu-indigo-700/70">
                      Öğretmen vitrini
                    </div>
                    <h2 className="mt-2 text-xl font-semibold text-paper-950">
                      {teacher.display_name}
                    </h2>
                    <p className="mt-1 text-sm text-paper-800/60">
                      {primaryBranchName} için profesyonel tanıtım sayfası
                    </p>
                  </div>
                  <div className="rounded-2xl bg-edu-indigo-50 px-3 py-2 text-center ring-1 ring-edu-indigo-100">
                    <div className="text-lg font-semibold text-edu-indigo-800">{confidenceScore}</div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-edu-indigo-800/60">karar güveni</div>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {heroStats.map((stat) => (
                    <div key={stat.label} className="rounded-xl border border-edu-blue-100 bg-edu-blue-50/60 p-3">
                      <div className="text-xs text-paper-800/55">{stat.label}</div>
                      <div className="mt-1 text-sm font-semibold text-paper-950">{stat.value}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-xl border border-edu-sun-300 bg-edu-sun-50 p-3">
                  <div className="text-xs font-semibold text-edu-sun-900">Sayfayı tanıtım linki olarak kullanabilir</div>
                  <p className="mt-1 text-xs leading-relaxed text-edu-sun-900/80">
                    Öğretmen bu profili velilere, öğrencilere ve sosyal medya takipçilerine kendi ders web sayfası gibi gönderebilir.
                  </p>
                </div>
                {contactPhone && (
                  <div className="mt-4 rounded-xl border border-edu-success-100 bg-edu-success-50 p-3">
                    <div className="text-xs font-semibold text-edu-success-900">Doğrudan iletişim</div>
                    <p className="mt-1 text-sm font-semibold text-paper-950">{contactPhone}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a
                        href={telHref(contactPhone)}
                        className="rounded-lg border border-edu-success-100 bg-white px-3 py-1.5 text-xs font-semibold text-edu-success-900 hover:bg-edu-success-50"
                      >
                        Telefon
                      </a>
                      {whatsappHref && (
                        <a
                          href={whatsappHref}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1eb85a]"
                        >
                          WhatsApp mesaj
                        </a>
                      )}
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-edu-success-900/65">
                      Öğretmen bu bilgiyi profilinde isteğe bağlı olarak yayınlamıştır.
                    </p>
                  </div>
                )}
              </aside>
            </div>
          </section>

          <nav className="mt-4 flex gap-2 overflow-x-auto rounded-2xl border border-edu-blue-100 bg-white/94 p-2 text-sm">
            {[
              ["Web sitesi", "#web-vitrin"],
              ["Tanıtım paketi", "#tanitim-paketi"],
              ["Sonuç planı", "#sonuc-plani"],
              ["Hakkımda", "#hakkimda"],
              ["Güven", "#guven"],
              ["Uygunluk", "#uygunluk"],
              ["Uzmanlıklar", "#uzmanliklar"],
              ["Ders yöntemi", "#ders-yontemi"],
              ["Kanıtlar", "#kanitlar"],
              ["Yorumlar", "#yorumlar"],
              ["SSS", "#sss"],
            ].map(([label, href]) => (
              <a key={href} href={href} className="shrink-0 rounded-xl px-3 py-2 font-medium text-paper-800 hover:bg-edu-indigo-50 hover:text-edu-indigo-800">
                {label}
              </a>
            ))}
          </nav>

          <section id="web-vitrin" className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-2xl border border-edu-blue-100 bg-white/94 p-6 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-edu-indigo-700/70">
                Kişisel web sayfası
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-paper-950">
                {teacher.display_name} için tek linkte profesyonel tanıtım, güven ve başvuru akışı
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-paper-800/70">
                Bu sayfa öğretmenin kendini anlatabileceği, ders yöntemini gösterebileceği ve öğrenci/veli başvurularını güvenli şekilde toplayabileceği kişisel tanıtım alanı olarak tasarlandı.
              </p>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {personalSiteHighlights.map((item) => (
                  <article key={item.title} className="rounded-xl border border-edu-blue-100 bg-edu-blue-50/60 p-4">
                    <h3 className="text-sm font-semibold text-paper-950">{item.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-paper-800/65">{item.body}</p>
                  </article>
                ))}
              </div>
            </div>
            <aside className="rounded-2xl border border-edu-indigo-200 bg-edu-indigo-50/70 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-edu-indigo-800/70">
                Öğretmen için kullanım
              </div>
              <h2 className="mt-2 text-lg font-semibold text-paper-950">
                Kendi web sayfan gibi paylaş
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-paper-800/70">
                Velilere, öğrencilere, WhatsApp mesajlarına ve sosyal medya biyografisine bu profil linki gönderilebilir.
              </p>
              <button
                type="button"
                onClick={() => void shareProfile()}
                className="mt-4 w-full rounded-xl bg-edu-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-edu-indigo-800"
              >
                Profil linkini paylaş
              </button>
              {shareOk ? <p className="mt-2 text-xs font-medium text-edu-indigo-800">{shareOk}</p> : null}
            </aside>
          </section>

          <section id="tanitim-paketi" className="mt-6 rounded-[2rem] border border-edu-sun-300 bg-white/94 p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-edu-sun-900/70">
                  Tanıtım paketi
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-paper-950">
                  Öğretmen bu sayfayı gönderirken hazır ve profesyonel bir metin kullanabilir.
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-paper-800/70">
                  Amaç sadece güzel profil göstermek değil; öğretmenin veliye, öğrenciye ve sosyal medya takipçilerine kendini güçlü anlatmasını kolaylaştırmak.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void copyIntroText()}
                  className="rounded-xl bg-edu-indigo-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-edu-indigo-800"
                >
                  Tanıtım metnini kopyala
                </button>
                <button
                  type="button"
                  onClick={() => void shareProfile()}
                  className="rounded-xl border border-paper-300 bg-white px-4 py-2.5 text-sm font-semibold text-paper-900 hover:bg-paper-50"
                >
                  Profil linkini paylaş
                </button>
              </div>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="rounded-2xl border border-edu-blue-100 bg-edu-blue-50/60 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-paper-800/55">
                  Hazır mesaj
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-paper-800/85">
                  {teacherIntroMessage}
                </p>
                <div className="mt-3 rounded-xl border border-paper-200 bg-white p-3">
                  <div className="text-xs font-semibold text-paper-900">Sosyal medya metni önerisi</div>
                  <p className="mt-1 text-xs leading-relaxed text-paper-800/65">{socialBioText}</p>
                </div>
                {introCopyOk ? <p className="mt-2 text-xs font-semibold text-brand-900">{introCopyOk}</p> : null}
                {shareOk ? <p className="mt-2 text-xs font-semibold text-paper-800/60">{shareOk}</p> : null}
              </div>
              <div className="grid gap-3">
                {brandKitCards.map((card) => (
                  <article key={card.title} className="rounded-2xl border border-edu-sun-300 bg-edu-sun-50/75 p-4">
                    <h3 className="text-sm font-semibold text-paper-950">{card.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-paper-800/65">{card.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section id="sonuc-plani" className="mt-6 overflow-hidden rounded-[2rem] border border-edu-success-100 bg-[radial-gradient(circle_at_top_right,#d1fae5_0%,#ffffff_36%,#eff6ff_70%,#fffbeb_100%)] p-6 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-edu-success-900/70">
                  Sonuç odaklı ders planı
                </div>
                <h2 className="mt-2 max-w-3xl text-2xl font-semibold tracking-tight text-paper-950">
                  Veli ve öğrenci, bu öğretmenle sürecin nasıl ilerleyeceğini daha ilk bakışta görür.
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-paper-800/70">
                  Güçlü profil sadece öğretmeni anlatmaz; başlangıçtan gelişim takibine kadar dersin nasıl yönetileceğini de açıkça gösterir.
                </p>
              </div>
              <Link
                href={demoTalepEntryHref}
                className="shrink-0 rounded-xl bg-edu-indigo-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-edu-indigo-800"
              >
                Demo ile planı netleştir
              </Link>
            </div>
            <div className="mt-5 grid gap-3 lg:grid-cols-4">
              {outcomeRoadmap.map((item) => (
                <article key={item.step} className="rounded-2xl border border-white bg-white/85 p-4 shadow-sm">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-edu-indigo-600 via-edu-blue-500 to-edu-success-500 text-sm font-semibold text-white">
                    {item.step}
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-paper-950">{item.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-paper-800/65">{item.body}</p>
                </article>
              ))}
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-2xl border border-paper-200 bg-white/85 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-paper-800/55">
                  Demo öncesi karar kontrolü
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {firstCallChecklist.map((item) => (
                    <div key={item} className="rounded-xl border border-paper-200 bg-paper-50 p-3 text-xs leading-relaxed text-paper-800">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <aside className="rounded-2xl border border-edu-sun-300 bg-edu-sun-50/85 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-edu-sun-900/70">
                  Değer önerisi
                </div>
                <div className="mt-3 space-y-2">
                  {audienceValueCards.map((card) => (
                    <div key={card.title} className="rounded-xl bg-white p-3 ring-1 ring-edu-sun-300">
                      <h3 className="text-xs font-semibold text-paper-950">{card.title}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-paper-800/65">{card.body}</p>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          </section>

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
                  Abonelikli profil özeti
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

            <section id="uygunluk" className="mt-4 rounded-2xl border border-paper-200 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-800/70">
                    Uygunluk ve karar desteği
                  </div>
                  <h2 className="mt-1 text-base font-semibold text-paper-950">
                    Bu öğretmen hangi durumda daha iyi aday?
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-paper-800/65">
                    Profil sinyalleri; hedef, güven ve ödeme süreci açısından hızlı karar vermeniz için özetlenir.
                  </p>
                </div>
                <div className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-950">
                  <div className="text-xs font-semibold text-brand-900/70">Karar güveni</div>
                  <div className="mt-0.5 text-xl font-semibold">{confidenceScore}/100</div>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                {fitCards.map((item) => (
                  <article key={item.title} className="rounded-xl border border-paper-200 bg-paper-50 p-3">
                    <h3 className="text-sm font-semibold text-paper-950">{item.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-paper-800/65">{item.body}</p>
                  </article>
                ))}
              </div>
              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-brand-100 bg-brand-50/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-relaxed text-brand-950">
                  {authRole === "guardian"
                    ? "Veli hesabınızla öğrenciniz adına ilan açabilir, bu öğretmenden gelen teklifi diğer tekliflerle karşılaştırabilirsiniz."
                    : "Öğrenci hesabınızla demo talebi oluşturabilir veya bu öğretmeni kısa listenize ekleyip teklifleri karşılaştırabilirsiniz."}
                </p>
                <Link
                  href={talepEntryHref}
                  className="shrink-0 rounded-xl bg-brand-800 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-brand-900"
                >
                  Bu öğretmenle talep oluştur
                </Link>
              </div>
              <div className="mt-4 rounded-xl border border-paper-200 bg-paper-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-paper-800/55">
                  Demo veya ilk mesajda sorulacak sorular
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {decisionQuestions.map((question) => (
                    <div key={question} className="rounded-xl border border-paper-200 bg-white p-3 text-xs leading-relaxed text-paper-800">
                      {question}
                    </div>
                  ))}
                </div>
              </div>
            </section>

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
                  {availabilitySlots.length > 0 ? (
                    <label className="text-sm text-paper-900">
                      Ders saati
                      <select
                        value={selectedSlotStart}
                        onChange={(e) => setSelectedSlotStart(e.target.value)}
                        className="mt-1 block w-full min-w-[220px] rounded-lg border border-paper-200 bg-white px-2 py-1.5 text-sm"
                      >
                        <option value="">Saat seçin (isteğe bağlı)</option>
                        {availabilitySlots.map((slot) => (
                          <option key={slot.start} value={slot.start}>
                            {slot.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
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
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-800/70">
                      Kanıt vitrini
                    </div>
                    <h2 className="mt-1 text-sm font-semibold text-paper-900">
                      Profilde karar destekleyen içerikler
                    </h2>
                  </div>
                  <Link href={demoTalepEntryHref} className="text-xs font-semibold text-brand-800 underline">
                    İçerikleri demo ile doğrula
                  </Link>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  {proofCards.map((card) => (
                    <article
                      key={card.title}
                      className={`rounded-xl border p-3 ${
                        card.ready ? "border-brand-200 bg-brand-50/50" : "border-paper-200 bg-paper-50"
                      }`}
                    >
                      <div className="text-xs font-semibold text-paper-950">{card.title}</div>
                      <p className="mt-1 text-xs leading-relaxed text-paper-800/65">{card.body}</p>
                      <div className={card.ready ? "mt-2 text-[11px] font-semibold text-brand-900" : "mt-2 text-[11px] font-semibold text-paper-800/55"}>
                        {card.ready ? "Hazır" : "Sorulmalı"}
                      </div>
                    </article>
                  ))}
                </div>
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

            <section id="hakkimda" className="mt-8 overflow-hidden rounded-2xl border border-paper-200 bg-white">
              <div className="grid gap-0 lg:grid-cols-[260px_minmax(0,1fr)]">
                <div className="bg-paper-950 p-6 text-white">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
                    Hakkımda
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                    {teacher.display_name}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-white/70">
                    {primaryBranchName} için hedef, seviye ve düzenli takip odaklı özel ders sayfası.
                  </p>
                  <div className="mt-5 rounded-2xl bg-white/10 p-4">
                    <div className="text-xs text-white/55">Öne çıkan alan</div>
                    <div className="mt-1 text-sm font-semibold">{primaryBranchName}</div>
                  </div>
                </div>
                <div className="p-6">
                  {teacher.bio_raw ? (
                    <p className="whitespace-pre-wrap text-base leading-relaxed text-paper-800/85">
                      {teacher.bio_raw}
                    </p>
                  ) : (
                    <p className="text-base leading-relaxed text-paper-800/70">
                      Bu öğretmen henüz ayrıntılı biyografi eklememiş. Demo talebi oluşturarak ders yaklaşımını, hedef planını ve öğrenciye uygun çalışma yöntemini netleştirebilirsiniz.
                    </p>
                  )}
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-paper-200 bg-paper-50 p-3">
                      <div className="text-xs text-paper-800/55">Ders odağı</div>
                      <div className="mt-1 text-sm font-semibold text-paper-950">{primaryBranchName}</div>
                    </div>
                    <div className="rounded-xl border border-paper-200 bg-paper-50 p-3">
                      <div className="text-xs text-paper-800/55">Başlangıç</div>
                      <div className="mt-1 text-sm font-semibold text-paper-950">Demo veya teklif</div>
                    </div>
                    <div className="rounded-xl border border-paper-200 bg-paper-50 p-3">
                      <div className="text-xs text-paper-800/55">Takip</div>
                      <div className="mt-1 text-sm font-semibold text-paper-950">Ders sonu notları</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section id="uzmanliklar" className="mt-8 rounded-2xl border border-paper-200 bg-white p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-800/70">
                    Uzmanlık vitrini
                  </div>
                  <h2 className="mt-1 text-xl font-semibold text-paper-950">
                    Ders verdiği alanlar ve fiyat aralığı
                  </h2>
                </div>
                <Link href={talepEntryHref} className="text-sm font-semibold text-brand-800 underline">
                  Bu alanda teklif al
                </Link>
              </div>
              {branches.length === 0 ? (
                <p className="mt-4 text-sm text-paper-800/55">Branş kaydı yok.</p>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {branches.map((b) => (
                    <article
                      key={b.branch_id}
                      className={`rounded-2xl border p-4 ${
                        b.is_primary ? "border-brand-200 bg-brand-50/60" : "border-paper-200 bg-paper-50"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="text-base font-semibold text-paper-950">{b.branch_name}</h3>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {b.is_primary && (
                              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-brand-900 ring-1 ring-brand-100">
                                Ana uzmanlık
                              </span>
                            )}
                            {b.years_experience != null && (
                              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-paper-800 ring-1 ring-paper-200">
                                {b.years_experience} yıl deneyim
                              </span>
                            )}
                          </div>
                        </div>
                        {b.hourly_rate_min_minor != null &&
                          b.hourly_rate_max_minor != null && (
                            <div className="rounded-xl bg-white px-3 py-2 text-right ring-1 ring-paper-200">
                              <div className="text-[11px] text-paper-800/55">Saatlik</div>
                              <div className="text-sm font-semibold text-paper-950">
                                {minorToTl(b.hourly_rate_min_minor)} - {minorToTl(b.hourly_rate_max_minor)} TL
                              </div>
                            </div>
                          )}
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-paper-800/65">
                        Bu alan için seviye, hedef, ders sıklığı ve kaynak planı talep veya demo aşamasında netleştirilir.
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </section>
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

          {authRole === "student" && teacherLessonVideos.length > 0 && (
            <section className="mt-8 rounded-xl border border-paper-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-paper-900">Ders videoları</h2>
              <p className="mt-1 text-xs text-paper-800/55">
                Sınıfınıza uygun onaylı videolar — tam listeyi video kütüphanesinden izleyin.
              </p>
              <ul className="mt-4 space-y-2">
                {teacherLessonVideos.slice(0, 5).map((v) => (
                  <li key={v.id} className="rounded-lg border border-paper-100 bg-paper-50 px-3 py-2 text-sm">
                    <span className="font-medium text-paper-950">{v.title}</span>
                    <span className="text-paper-800/55"> · {v.topicTitle}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/student/ders-videolari"
                className="mt-4 inline-flex text-sm font-semibold text-brand-800 underline"
              >
                Tüm videoları aç
              </Link>
            </section>
          )}

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
          <section className="mt-8 overflow-hidden rounded-[2rem] border border-brand-200 bg-[linear-gradient(135deg,#083344_0%,#0f766e_48%,#f97316_100%)] p-6 text-white shadow-xl shadow-paper-900/10">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">
                  Paylaşılabilir öğretmen web sayfası
                </div>
                <h2 className="mt-2 max-w-3xl text-2xl font-semibold tracking-tight sm:text-3xl">
                  {teacher.display_name} bu sayfayı kendi profesyonel tanıtım linki olarak kullanabilir.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/75">
                  Profil; öğretmenin anlatımını, uzmanlıklarını, kanıtlarını, yorumlarını, demo talebini ve güvenli ödeme sürecini tek sayfada toplar.
                </p>
              </div>
              <div className="rounded-2xl bg-white/12 p-4 ring-1 ring-white/20">
                <button
                  type="button"
                  onClick={() => void shareProfile()}
                  className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-paper-950 hover:bg-paper-50"
                >
                  Profil linkini paylaş
                </button>
                <Link
                  href={demoTalepEntryHref}
                  className="mt-2 flex w-full justify-center rounded-xl border border-white/35 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Demo talebi oluştur
                </Link>
                {shareOk ? <p className="mt-2 text-xs font-medium text-white/75">{shareOk}</p> : null}
              </div>
            </div>
          </section>
          <aside className="fixed bottom-6 right-6 z-30 hidden w-80 rounded-2xl border border-brand-200 bg-white/95 p-4 shadow-xl shadow-paper-900/10 backdrop-blur sm:block">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-800/70">
              Hızlı karar
            </div>
            <h2 className="mt-1 text-base font-semibold text-paper-950">
              {teacher.display_name} ile başlamadan önce demo veya teklif alın
            </h2>
            <div className="mt-2 text-xs text-paper-800/60">
              {profileSite?.priceLabel ?? hourlyRange ?? "Ücret teklif sonrası"} · {profileSite?.locationLabel ?? teacher.city_name ?? "Çevrim içi"}
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
