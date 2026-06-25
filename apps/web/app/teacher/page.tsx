"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { TeacherZigoPublish } from "../components/teacher/TeacherZigoPublish";
import { QuickStartBanner, TEACHER_START_STEPS } from "../components/QuickStartBanner";
import { TeacherFlowExplainer } from "../components/TeacherFlowExplainer";
import { apiFetch } from "../lib/api";
import { loginHrefWithReturn } from "../lib/authRedirect";
import { clearToken, getToken } from "../lib/auth";
import { trackEvent } from "../lib/trackEvent";
import { notificationKindLabel, resolveNotificationHref } from "../lib/notifications";

type SubMe = {
  active: boolean;
  subscription: null | {
    plan_code: string;
    status: string;
    expires_at: string;
    promo_multiplier: number;
    title: string;
  };
};

type TeacherMe = {
  teacher: {
    id: string;
    email: string;
    displayName: string;
    verificationStatus: string;
    ratingAvg: number | null;
    ratingCount: number | null;
    cityId: number | null;
    districtId: number | null;
    bioRaw: string | null;
    videoUrl: string | null;
    availability: Record<string, unknown>;
    branches: Array<{ branchId: number; name: string; slug: string; isPrimary: boolean }>;
  };
  checklist: Record<string, boolean>;
  completionScore: number;
  profileQualityScore: number;
  profileQualitySignals: Array<{
    key: string;
    label: string;
    points: number;
    maxPoints: number;
  }>;
};

type DashboardReview = {
  rating: number;
  commentPreview: string | null;
  createdAt: string;
  sessionIndex: number;
  reviewerLabel: string;
};

type Dashboard = {
  activePackages: number;
  completedPackages: number;
  upcomingScheduledSessions: number;
  sessionsCompletedLast30d: number;
  lifetimeCompletedLessonsInPackages: number;
  packagesPaymentHeldInEscrow: number;
  packagesInDispute: number;
  recentReviews?: DashboardReview[];
};

type InAppNotification = {
  id: string;
  title: string;
  body: string;
  sent_at: string | null;
  read_at: string | null;
  payload_jsonb?: unknown;
};

type BankInstructions = {
  accountName: string;
  iban: string;
  description: string;
  amountTry: string;
  note: string;
};

function teacherCampaignSummary(planCode?: string, promoMultiplier?: number): string {
  if (planCode === "teacher_6m") return "Erken erişim: 6 ay aboneliğe 24 ay ücretsiz hediye süre";
  if (planCode === "teacher_12m") return "Erken erişim: 12 ay aboneliğe 48 ay ücretsiz hediye süre";
  return promoMultiplier && promoMultiplier > 1 ? "Erken erişim hediye süresi uygulanır" : "Standart abonelik";
}

function verificationStatusLabel(status?: string | null): string {
  const labels: Record<string, string> = {
    unverified: "Doğrulanmadı",
    pending: "İnceleme bekliyor",
    verified: "Doğrulandı",
    rejected: "Reddedildi",
  };
  return status ? labels[status] ?? "Durum güncelleniyor" : "Durum güncelleniyor";
}

const teacherSubscriptionBenefits = [
  "Sınırsız teklif: abonesizken günde 1 normal teklif ücretsiz, abonelikte teklif sınırı yok.",
  "Tam public profil: bio, video, kanıtlar, fiyat, yorum, telefon ve WhatsApp tercihi görünür.",
  "Kişisel web sayfası: profil linkinizi velilere, öğrencilere ve sosyal medyaya gönderebilirsiniz.",
  "Reklam/kampanya alanı: ilk kampanya ücretsiz, sonraki yeni ilanlar 1000 TL cüzdan bakiyesiyle açılır.",
  "Daha fazla gelir kanalı: kurs, grup ders, doğrudan ders ve Akademi alanlarında görünürlük kazanırsınız.",
  "Operasyon kontrolü: başvuru, bildirim, cüzdan, hak ediş ve ödeme kayıtlarını panelden takip edersiniz.",
] as const;

const teacherSubscriptionReasons = [
  {
    title: "Daha çok öğrenciye görünürsünüz",
    body: "Profiliniz sınırlı görünümden çıkar; ders yaklaşımı, kanıtlar, fiyat aralığı ve iletişim tercihleri karar vermeyi kolaylaştırır.",
  },
  {
    title: "Teklif fırsatını kaçırmazsınız",
    body: "Günlük ücretsiz teklif sınırına takılmadan öğrenci taleplerine hızlı dönebilir, kısa liste ve demo fırsatlarını değerlendirebilirsiniz.",
  },
  {
    title: "Profiliniz reklam sayfasına dönüşür",
    body: "Paylaşılabilir profil linki, hazır tanıtım metni ve kampanya alanı öğretmenin kendi pazarlamasını güçlendirir.",
  },
] as const;

function tryYoutubeEmbed(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") {
      const id = u.pathname.replace("/", "").trim();
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.hostname.endsWith("youtube.com")) {
      const id = u.searchParams.get("v")?.trim();
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    return null;
  } catch {
    return null;
  }
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-paper-200 bg-white p-4">
      <div className="text-xs font-medium text-paper-800/55">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-paper-900">
        {value}
      </div>
    </div>
  );
}

function qualityLabel(score: number): string {
  if (score >= 80) return "Çok güçlü vitrin";
  if (score >= 60) return "Güçlü vitrin";
  if (score >= 40) return "Gelişen vitrin";
  return "Görünürlük düşük";
}

function qualitySignalHref(key: string): string | null {
  const hrefs: Record<string, string> = {
    city: "/teacher/edit?focus=city",
    bio: "/teacher/edit?focus=bio",
    video: "/teacher/edit?focus=video",
    branches: "/teacher/edit?focus=branches",
    examDocs: "/teacher/edit?focus=examDocs",
    platformLinks: "/teacher/edit?focus=platformLinks",
  };
  return hrefs[key] ?? null;
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

export default function TeacherHomePage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [me, setMe] = useState<TeacherMe | null>(null);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [sub, setSub] = useState<SubMe | null>(null);
  const [bankInstructions, setBankInstructions] = useState<BankInstructions | null>(
    null,
  );
  const [bankRefDraft, setBankRefDraft] = useState("");
  const [subPayBusy, setSubPayBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [notifBusyId, setNotifBusyId] = useState<string | null>(null);
  const [sharePanelOk, setSharePanelOk] = useState<string | null>(null);
  const [instantReady, setInstantReady] = useState(false);
  const [instantBusy, setInstantBusy] = useState(false);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [router, pathname]);

  useEffect(() => {
    setShowOnboarding(new URLSearchParams(window.location.search).get("onboarding") === "1");
  }, []);

  const load = useCallback(async (t: string) => {
    setLoading(true);
    setError(null);
    try {
      const [m, d, n] = await Promise.all([
        apiFetch<TeacherMe>("/v1/teacher/me", { token: t }),
        apiFetch<Dashboard>("/v1/teacher/dashboard", { token: t }),
        apiFetch<{ notifications: InAppNotification[] }>(
          "/v1/notifications?limit=8",
          { token: t },
        ).catch(() => ({ notifications: [] as InAppNotification[] })),
      ]);
      setMe(m);
      setDash(d);
      setNotifications(n.notifications);
      const s = await apiFetch<SubMe>("/v1/subscriptions/me", { token: t });
      setSub(s);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "load_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Bu panel yalnızca öğretmen hesabı içindir.");
      }
    } finally {
      setLoading(false);
    }
  }, [router, pathname]);

  async function markNotificationRead(id: string) {
    if (!token) return;
    setNotifBusyId(id);
    try {
      await apiFetch(`/v1/notifications/${id}/read`, {
        method: "PATCH",
        token,
      });
      setNotifications((prev) =>
        prev.map((x) =>
          x.id === id ? { ...x, read_at: x.read_at ?? new Date().toISOString() } : x,
        ),
      );
    } catch {
      /* yoksay */
    } finally {
      setNotifBusyId(null);
    }
  }

  async function copyShareText(kind: "link" | "intro" | "bio") {
    if (!me) return;
    const primaryBranch =
      me.teacher.branches.find((branch) => branch.isPrimary) ?? me.teacher.branches[0] ?? null;
    const profilePath = teacherProfilePath(
      me.teacher.displayName,
      primaryBranch?.name,
      me.teacher.id,
    );
    const profileUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}${profilePath}`
        : profilePath;
    const introText = `Merhaba, ben ${me.teacher.displayName}. ${primaryBranch?.name ?? "özel ders"} alanında öğrencinin seviyesini ve hedefini netleştirerek kişiye özel ders planı oluşturuyorum. Profilimden ders yaklaşımımı, uzmanlık alanlarımı, güven bilgilerini ve demo/teklif adımlarını inceleyebilirsiniz: ${profileUrl}`;
    const bioText = `${me.teacher.displayName} | ${primaryBranch?.name ?? "Özel ders"} öğretmeni | Demo talebi, güvenli ödeme ve ders sonrası takip için profilimi inceleyin: ${profileUrl}`;
    const text = kind === "link" ? profileUrl : kind === "intro" ? introText : bioText;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setSharePanelOk(
          kind === "link"
            ? "Profil linki kopyalandı."
            : kind === "intro"
              ? "Tanıtım mesajı kopyalandı."
              : "Sosyal medya bio metni kopyalandı.",
        );
        trackEvent("teacher_profile_share_asset_copy", {
          entityType: "teacher",
          entityId: me.teacher.id,
          metadata: { source: "teacher_panel_share_center", kind },
        });
      } else {
        setSharePanelOk("Tarayıcı kopyalamayı desteklemiyor.");
      }
    } catch {
      setSharePanelOk("Kopyalama tamamlanamadı.");
    }
  }

  async function buyFromWallet(planCode: "teacher_6m" | "teacher_12m") {
    if (!token) return;
    setSubPayBusy(true);
    setError(null);
    try {
      await apiFetch<{ ok: true }>("/v1/subscriptions/purchase-from-wallet", {
        method: "POST",
        token,
        body: JSON.stringify({ planCode }),
      });
      setBankInstructions(null);
      await load(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "purchase_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Abonelik satın almak için öğretmen hesabı gerekir.");
      }
      if (msg.includes("[409]") && msg.includes("insufficient")) {
        setError(
          "Bakiye yetersiz. PayTR ile ödeyebilir veya havale seçebilirsiniz; cüzdan için /teacher/cuzdan.",
        );
      }
    } finally {
      setSubPayBusy(false);
    }
  }

  async function buyWithPaytr(planCode: "teacher_6m" | "teacher_12m") {
    if (!token) return;
    setSubPayBusy(true);
    setError(null);
    setBankInstructions(null);
    try {
      const r = await apiFetch<{ next: { checkout: string } }>(
        "/v1/subscriptions/purchase",
        {
          method: "POST",
          token,
          body: JSON.stringify({ planCode, method: "paytr_iframe" }),
        },
      );
      const ck = await apiFetch<{ iframeUrl: string }>(r.next.checkout, { token });
      window.open(ck.iframeUrl, "_blank", "noopener,noreferrer");
      await load(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "purchase_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Abonelik satın almak için öğretmen hesabı gerekir.");
      }
    } finally {
      setSubPayBusy(false);
    }
  }

  async function buyWithBank(planCode: "teacher_6m" | "teacher_12m") {
    if (!token) return;
    setSubPayBusy(true);
    setError(null);
    try {
      const ref = bankRefDraft.trim();
      const r = await apiFetch<{ instructions: BankInstructions }>(
        "/v1/subscriptions/purchase",
        {
          method: "POST",
          token,
          body: JSON.stringify({
            planCode,
            method: "bank_transfer",
            ...(ref ? { bankRef: ref } : {}),
          }),
        },
      );
      setBankInstructions(r.instructions);
      await load(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "purchase_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Abonelik satın almak için öğretmen hesabı gerekir.");
      }
    } finally {
      setSubPayBusy(false);
    }
  }

  useEffect(() => {
    if (token) void load(token);
  }, [token, load]);

  const checklistItems = useMemo(() => {
    const c = me?.checklist ?? {};
    const labels: Record<string, string> = {
      branchesSelected: "Branş seçildi",
      citySet: "Şehir seçildi",
      districtSet: "İlçe seçildi",
      availabilitySet: "Müsaitlik girildi",
      bioFilled: "Biyografi dolduruldu",
      videoLinked: "Video eklendi",
      instagramLinked: "Instagram eklendi",
      platformLinksAdded: "Ders bağlantıları eklendi",
      examDocsAdded: "Doküman eklendi",
      onboardingInterviewDone: "İlk kurulum görüşmesi tamam",
      curriculumStarted: "Müfredat başlatıldı",
    };
    const fixHref: Record<string, string> = {
      branchesSelected: "/teacher/edit?focus=branches",
      citySet: "/teacher/edit?focus=city",
      districtSet: "/teacher/edit?focus=city",
      availabilitySet: "/teacher/edit?focus=availability",
      bioFilled: "/teacher/edit?focus=bio",
      videoLinked: "/teacher/edit?focus=video",
      instagramLinked: "/teacher/edit?focus=instagram",
      platformLinksAdded: "/teacher/edit?focus=platformLinks",
      examDocsAdded: "/teacher/edit?focus=examDocs",
    };
    return Object.entries(c).map(([k, v]) => ({
      key: labels[k] ?? k,
      done: Boolean(v),
      fix: fixHref[k] ?? null,
    }));
  }, [me]);

  if (!token) return null;

  const profileQualityScore = me?.profileQualityScore ?? 0;
  const qualitySignals = me?.profileQualitySignals ?? [];
  const unreadNotifications = notifications.filter((n) => n.read_at == null).length;
  const latestNotification = notifications[0] ?? null;
  const latestNotificationHref = latestNotification
    ? resolveNotificationHref(latestNotification.payload_jsonb, "teacher")
    : null;
  const reviewScore = me?.teacher.ratingCount
    ? Math.min(20, Math.round(Number(me.teacher.ratingAvg ?? 0) * 4))
    : 0;
  const lessonCompletionScore = dash
    ? Math.min(25, dash.sessionsCompletedLast30d * 5 + Math.min(10, dash.lifetimeCompletedLessonsInPackages))
    : 0;
  const proofScore = Math.round(profileQualityScore * 0.45);
  const teacherOpsQualityScore = Math.min(100, proofScore + lessonCompletionScore + reviewScore + (unreadNotifications === 0 ? 10 : 0));
  const missingQualitySignals = [...qualitySignals]
    .filter((item) => item.points < item.maxPoints)
    .sort((a, b) => b.maxPoints - b.points - (a.maxPoints - a.points));
  const nextBestAction =
    profileQualityScore < 80
      ? {
          title: "Profilinizi tamamlayın",
          body: "Branş, ücret ve tanıtım bilgileri olmadan öğrenciler sizi bulamaz.",
          href: "/teacher/edit",
          cta: "Profili düzenle",
        }
      : !sub?.active
        ? {
            title: "Aboneliği etkinleştirin",
            body: "Sınırsız teklif ve tam profil görünürlüğü için abonelik gerekir.",
            href: "#ogretmen-aboneligi",
            cta: "Aboneliğe git",
          }
        : (dash?.upcomingScheduledSessions ?? 0) === 0
          ? {
              title: "Açık taleplere teklif verin",
              body: "Branşınıza uygun öğrenci taleplerini inceleyin.",
              href: "/teacher/requests",
              cta: "Talepleri aç",
            }
          : {
              title: "Yaklaşan dersinizi hazırlayın",
              body: "Sınıf bağlantısı ve materyalleri dersler ekranından kontrol edin.",
              href: "/teacher/dersler",
              cta: "Derslerim",
            };
  const primaryTeacherBranch =
    me?.teacher.branches.find((branch) => branch.isPrimary) ?? me?.teacher.branches[0] ?? null;
  const teacherProfileHref = me
    ? teacherProfilePath(me.teacher.displayName, primaryTeacherBranch?.name, me.teacher.id)
    : "/ogretmenler";

  async function toggleInstantReady() {
    if (!token) return;
    setInstantBusy(true);
    try {
      const next = !instantReady;
      await apiFetch("/v1/teacher/me/instant-ready", {
        method: "PATCH",
        token,
        body: JSON.stringify({ available: next, readyMinutes: 120 }),
      });
      setInstantReady(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "instant_ready_failed");
    } finally {
      setInstantBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Panel özeti</h1>
        <p className="mt-1 text-sm text-paper-800/75">
          Sıradaki işlem aşağıda. Teklif, profil ve dersler alt menüden de açılır.
        </p>

        <div className="mt-5">
          <QuickStartBanner
            eyebrow={showOnboarding ? "Hoş geldiniz" : "Şimdi ne yapmalısınız?"}
            title={nextBestAction.title}
            body={nextBestAction.body}
            href={nextBestAction.href}
            cta={nextBestAction.cta}
            steps={showOnboarding ? TEACHER_START_STEPS : undefined}
          />
        </div>

        <div className="mt-4">
          <TeacherFlowExplainer variant="panel" />
        </div>

        {showOnboarding ? (
          <section className="mt-4 rounded-2xl border border-brand-200 bg-brand-50/70 p-5">
            <h2 className="text-sm font-semibold text-brand-950">Neden BenimÖğretmenim?</h2>
            <ul className="mt-3 grid gap-2 text-sm text-brand-900 sm:grid-cols-3">
              <li className="rounded-xl bg-white/80 p-3">
                <strong>Komisyon yok:</strong> Öğrenci platforma öder; sizden kesinti alınmaz.
              </li>
              <li className="rounded-xl bg-white/80 p-3">
                <strong>Platform içi ders:</strong> Tahta, materyal ve mesaj tek akışta.
              </li>
              <li className="rounded-xl bg-white/80 p-3">
                <strong>Doğrulama rozeti:</strong> Güven artar; doğru öğrenciye görünürsünüz.
              </li>
            </ul>
          </section>
        ) : (
          <details className="mt-4 rounded-2xl border border-paper-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-semibold text-paper-900">Platform avantajları</summary>
            <p className="mt-2 text-sm text-paper-800/70">
              Komisyon yok · platform içi ders · doğrulama rozeti. Detay:{" "}
              <Link href="/guven" className="text-brand-800 underline">
                Güven sayfası
              </Link>
            </p>
          </details>
        )}

        <section className="mt-4 rounded-2xl border border-paper-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-paper-900">Anlık derse hazırım</h2>
              <p className="mt-1 text-xs text-paper-800/65">
                Açıkken öğrenciler 10–15 dk hızlı soru çözümü talep edebilir (ek gelir).
              </p>
            </div>
            <button
              type="button"
              disabled={instantBusy}
              onClick={() => void toggleInstantReady()}
              className={`rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                instantReady ? "bg-brand-800 text-white" : "border border-paper-300 bg-paper-50 text-paper-900"
              }`}
            >
              {instantBusy ? "…" : instantReady ? "Hazır (açık)" : "Hazır değil"}
            </button>
          </div>
        </section>

        <TeacherZigoPublish token={token} branchSlug={primaryTeacherBranch?.slug ?? null} />

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-lg font-medium text-paper-800">{me?.teacher.displayName ?? "—"}</p>
            <div className="mt-1 text-sm text-paper-800/75">
              Doğrulama:{" "}
              <span className="font-medium text-paper-900">
                {verificationStatusLabel(me?.teacher.verificationStatus)}
              </span>
              {" · "}
              <Link href="/teacher/dogrulama" className="font-medium text-brand-800 underline">
                KYC / belgeler
              </Link>
              {" · "}
              Tamamlanma:{" "}
              <span className="font-medium text-paper-900">
                {me?.completionScore ?? 0}%
              </span>
              {" · "}
              Vitrin kalite:{" "}
              <span className="font-medium text-paper-900">
                {profileQualityScore}/100
              </span>
              {me?.teacher.ratingCount != null &&
                me.teacher.ratingCount > 0 &&
                me.teacher.ratingAvg != null && (
                  <>
                    {" · "}
                    <span className="font-medium text-paper-900">
                      Yorum ort. {Number(me.teacher.ratingAvg).toFixed(2)} (
                      {me.teacher.ratingCount})
                    </span>
                  </>
                )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => token && load(token)}
              className="rounded-xl border border-paper-200 bg-white px-3 py-2 text-sm font-medium text-paper-800 shadow-sm"
            >
              Yenile
            </button>
            <button
              onClick={() => {
                clearToken();
                router.push("/login");
              }}
              className="rounded-xl border border-paper-300 bg-white px-3 py-2 text-sm font-medium text-paper-900 hover:bg-paper-50"
            >
              Çıkış
            </button>
          </div>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/teacher/odev-havuzu", title: "Soru havuzu", body: "Yeni soruları üstlen ve çözüm gönder." },
            { href: "/teacher/requests", title: "Ders talepleri", body: "Teklif bekleyen öğrencileri kontrol et." },
            { href: "/teacher/dersler", title: "Canlı dersler", body: "Yaklaşan derslerin sınıf bağlantılarını aç." },
            { href: "/teacher/edit", title: "Profili güçlendir", body: "Video, belge ve branş bilgilerini tamamla." },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-2xl border border-paper-200 bg-white p-4 shadow-sm transition hover:border-brand-200 hover:bg-brand-50/30"
            >
              <div className="text-sm font-semibold text-paper-900">{item.title}</div>
              <p className="mt-1 text-xs leading-relaxed text-paper-800/65">{item.body}</p>
            </Link>
          ))}
        </section>

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-paper-200 bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-800/70">
                Profilimi paylaş
              </div>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-paper-950">
                Kendi öğretmen web sayfanı veliye, öğrenciye ve sosyal medyaya gönder.
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-paper-800/70">
                Profil sayfan; uzmanlıklarını, güven bilgilerini, demo talebini, teklif akışını ve hazır tanıtım metnini tek linkte toplar.
              </p>
              <div className="mt-4 rounded-2xl border border-paper-200 bg-paper-50 p-4">
                <div className="text-xs font-semibold text-paper-800/55">Paylaşılacak profil</div>
                <div className="mt-1 break-all text-sm font-semibold text-paper-950">
                  {teacherProfileHref}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void copyShareText("link")}
                    className="rounded-xl bg-paper-950 px-3 py-2 text-xs font-semibold text-white hover:bg-paper-800"
                  >
                    Linki kopyala
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyShareText("intro")}
                    className="rounded-xl border border-paper-300 bg-white px-3 py-2 text-xs font-semibold text-paper-900 hover:bg-paper-50"
                  >
                    Veli mesajını kopyala
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyShareText("bio")}
                    className="rounded-xl border border-paper-300 bg-white px-3 py-2 text-xs font-semibold text-paper-900 hover:bg-paper-50"
                  >
                    Bio metnini kopyala
                  </button>
                  <Link
                    href={teacherProfileHref}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-900 hover:bg-brand-100"
                  >
                    Profili aç
                  </Link>
                </div>
                {sharePanelOk ? (
                  <p className="mt-2 text-xs font-semibold text-brand-900">{sharePanelOk}</p>
                ) : null}
              </div>
            </div>
            <aside className="border-t border-paper-200 bg-[radial-gradient(circle_at_top_right,#ecfeff_0%,#ffffff_48%,#fff7ed_100%)] p-5 lg:border-l lg:border-t-0">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-warm-900/70">
                Tanıtım gücü
              </div>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    title: primaryTeacherBranch?.name ?? "Özel ders vitrini",
                    body: "Ana uzmanlık profilde ve paylaşım metninde öne çıkar.",
                  },
                  {
                    title: `${profileQualityScore}/100 vitrin kalitesi`,
                    body: "Profil kalitesi yükseldikçe öğretmenin kendini anlatma gücü artar.",
                  },
                  {
                    title: "Tek link başvuru",
                    body: "Demo, teklif ve kısa liste aksiyonları aynı sayfadan başlar.",
                  },
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl border border-white bg-white/85 p-4">
                    <h3 className="text-sm font-semibold text-paper-950">{item.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-paper-800/65">{item.body}</p>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-800/70">
                Öğretmen kalite programı
              </div>
              <h2 className="mt-1 text-lg font-semibold text-paper-900">
                Operasyon kalite skoru · {teacherOpsQualityScore}/100
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-paper-800/65">
                Profil kanıtları, ders tamamlama, yorum ve bekleyen işler birlikte izlenir.
              </p>
            </div>
            <Link href="/teacher/edit" className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-900">
              Kanıtları güçlendir
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {[
              ["Profil kanıtı", proofScore, "Video, belge, bio, branş"],
              ["Ders tamamlama", lessonCompletionScore, `${dash?.sessionsCompletedLast30d ?? 0} ders / 30g`],
              ["Yorum gücü", reviewScore, `${me?.teacher.ratingCount ?? 0} yorum`],
              ["Bekleyen iş", unreadNotifications === 0 ? 10 : 0, unreadNotifications ? `${unreadNotifications} okunmamış` : "Temiz"],
            ].map(([label, value, hint]) => (
              <div key={String(label)} className="rounded-xl border border-paper-200 bg-paper-50 p-3">
                <div className="text-xs font-semibold text-paper-800/55">{label}</div>
                <div className="mt-1 text-2xl font-semibold text-paper-950">{value}</div>
                <div className="text-xs text-paper-800/60">{hint}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-warm-200 bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_62%,#ecfeff_100%)] p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-warm-900/70">
                Kazanç ve görünürlük içgörüsü
              </div>
              <h2 className="mt-1 text-lg font-semibold text-paper-900">
                Daha iyi profil, daha net teklif ve daha hızlı dönüş
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-paper-800/70">
                Bu panel kesin kazanç taahhüdü vermez; profil kalitesi, tamamlanan ders, yorum ve bekleyen iş
                bilgilerini görünürlük ve teklif hazırlığı açısından okur.
              </p>
            </div>
            <Link href="/teacher/requests" className="rounded-xl bg-warm-600 px-3 py-2 text-xs font-semibold text-white hover:bg-warm-700">
              Açık talepleri gör
            </Link>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <div className="rounded-xl border border-warm-200 bg-white/80 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-paper-800/50">Görünürlük seviyesi</div>
              <div className="mt-1 text-xl font-semibold text-paper-950">
                {profileQualityScore >= 80 ? "Güçlü vitrin" : profileQualityScore >= 60 ? "Gelişen vitrin" : "Tamamlanmalı"}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-paper-800/65">
                {missingQualitySignals[0]
                  ? `İlk öneri: ${missingQualitySignals[0].label} alanını tamamlayın.`
                  : "Profil bilgileriniz güçlü; teklif yanıt hızını koruyun."}
              </p>
            </div>
            <div className="rounded-xl border border-warm-200 bg-white/80 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-paper-800/50">Ders ivmesi</div>
              <div className="mt-1 text-xl font-semibold text-paper-950">
                {dash?.sessionsCompletedLast30d ?? 0} ders / 30 gün
              </div>
              <p className="mt-2 text-xs leading-relaxed text-paper-800/65">
                Tamamlanan ders ve düzenli değerlendirme, öğrenci/veli güvenini artıran en güçlü kayıtlardan biridir.
              </p>
            </div>
            <div className="rounded-xl border border-warm-200 bg-white/80 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-paper-800/50">Teklif hazırlığı</div>
              <div className="mt-1 text-xl font-semibold text-paper-950">
                {unreadNotifications === 0 ? "Takip temiz" : `${unreadNotifications} iş bekliyor`}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-paper-800/65">
                Hızlı yanıt, net ücret ve kısa ders planı teklif kabul ihtimalini güçlendirir.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-paper-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-paper-800/55">
                Olay zaman çizelgesi
              </div>
              <h2 className="mt-1 text-base font-semibold text-paper-900">
                {unreadNotifications > 0
                  ? `${unreadNotifications} okunmamış iş var`
                  : latestNotification
                    ? "Son iş kaydı tutuldu"
                    : "Yeni iş kaydı yok"}
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-paper-800/70">
                Teklif, ödev, ders, kurs ve doğrudan ders gelişmeleri tek sırada takip edilir.
              </p>
            </div>
            {latestNotificationHref ? (
              <Link
                href={latestNotificationHref}
                className="w-fit rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-900 hover:bg-brand-100"
              >
                Son detaya git
              </Link>
            ) : null}
          </div>
          {latestNotification ? (
            <div className="mt-4 rounded-xl border border-paper-200 bg-paper-50 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-paper-800 ring-1 ring-paper-200">
                  {notificationKindLabel(latestNotification.payload_jsonb)}
                </span>
                <span className="text-xs text-paper-800/55">
                  {latestNotification.sent_at ? new Date(latestNotification.sent_at).toLocaleString("tr-TR") : "Zaman yok"}
                </span>
              </div>
              <div className="mt-2 font-semibold text-paper-900">{latestNotification.title}</div>
              <p className="mt-1 line-clamp-2 text-paper-800/70">{latestNotification.body}</p>
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-paper-200 bg-paper-50 p-3 text-sm text-paper-800/65">
              İlk teklif, ödev veya ders bildirimi geldiğinde burada özetlenecek.
            </p>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-paper-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-paper-800/55">
                Arama görünürlüğü
              </div>
              <h2 className="mt-2 text-lg font-semibold text-paper-900">
                {qualityLabel(profileQualityScore)} · {profileQualityScore}/100
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-paper-800/70">
                Bu skor öğrencinin gördüğü öğretmen kartlarında kullanılan doğrulama, biyografi, video,
                branş, doküman ve yorum bilgilerinden hesaplanır.
              </p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-paper-100">
                <div
                  className="h-full rounded-full bg-brand-700"
                  style={{ width: `${Math.min(100, Math.max(0, profileQualityScore))}%` }}
                />
              </div>
            </div>
            <Link
              href={missingQualitySignals[0] ? (qualitySignalHref(missingQualitySignals[0].key) ?? "/teacher/edit") : "/teacher/edit"}
              className="shrink-0 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-950 hover:bg-brand-100"
            >
              {missingQualitySignals[0] ? `${missingQualitySignals[0].label} tamamla` : "Profili düzenle"}
            </Link>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {qualitySignals.map((item) => {
              const done = item.points >= item.maxPoints;
              const href = qualitySignalHref(item.key);
              return (
                <div
                  key={item.key}
                  className={`rounded-xl border p-3 text-sm ${
                    done ? "border-brand-100 bg-brand-50/50" : "border-paper-200 bg-paper-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-paper-900">{item.label}</div>
                    <div className={done ? "text-brand-800" : "text-paper-800/55"}>
                      {item.points}/{item.maxPoints}
                    </div>
                  </div>
                  {!done && href ? (
                    <Link className="mt-2 inline-block text-xs font-medium text-brand-800 underline" href={href}>
                      Düzenle
                    </Link>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {notifications.length > 0 && (
          <div className="mt-8 rounded-xl border border-paper-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-paper-900">Bildirimler</h2>
            <p className="mt-1 text-xs text-paper-800/55">Ödev, yorum ve bildirimler.</p>
            <ul className="mt-4 space-y-3">
              {notifications.map((n) => {
                const unread = n.read_at == null;
                const actionHref = resolveNotificationHref(n.payload_jsonb, "teacher");
                return (
                  <li
                    key={n.id}
                    className={`rounded-xl border px-3 py-2 text-sm ${
                      unread
                        ? "border-brand-200 bg-brand-50/60"
                        : "border-paper-100 bg-paper-50"
                    }`}
                  >
                    <div className="font-medium text-paper-900">{n.title}</div>
                    <p className="mt-1 text-paper-800">{n.body}</p>
                    {actionHref ? (
                      <Link
                        href={actionHref}
                        className="mt-2 inline-block text-xs font-medium text-brand-800 underline"
                      >
                        Detaya git
                      </Link>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-paper-800/55">
                      <span>
                        {n.sent_at
                          ? new Date(n.sent_at).toLocaleString("tr-TR")
                          : "—"}
                      </span>
                      {unread && (
                        <button
                          type="button"
                          disabled={notifBusyId === n.id}
                          onClick={() => void markNotificationRead(n.id)}
                          className="rounded-lg border border-paper-300 bg-white px-2 py-1 text-xs font-medium text-paper-800 hover:bg-paper-100 disabled:opacity-50"
                        >
                          {notifBusyId === n.id ? "…" : "Okundu"}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Aktif paket" value={dash?.activePackages ?? 0} />
          <Stat label="Yaklaşan ders" value={dash?.upcomingScheduledSessions ?? 0} />
          <Stat label="30g tamamlanan" value={dash?.sessionsCompletedLast30d ?? 0} />
          <Stat label="Escrow'da paket" value={dash?.packagesPaymentHeldInEscrow ?? 0} />
        </div>

        {(dash?.recentReviews?.length ?? 0) > 0 && (
          <div className="mt-8 rounded-xl border border-paper-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-paper-900">Son yorumlar</h2>
              {me?.teacher.id && (
                <Link
                  href={`/ogretmenler/${me.teacher.id}`}
                  className="text-sm font-medium text-brand-800 underline"
                >
                  Herkese açık profilim
                </Link>
              )}
            </div>
            <p className="mt-1 text-xs text-paper-800/55">
              Yorumdaki adlar gizlilik için kısaltılır; puan herkese açık profilde de görünür.
            </p>
            <ul className="mt-4 space-y-3">
              {(dash?.recentReviews ?? []).map((rv) => (
                <li
                  key={`${rv.createdAt}-${rv.sessionIndex}-${rv.reviewerLabel}-${rv.rating}`}
                  className="rounded-xl border border-paper-100 bg-paper-50 px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-amber-800">★ {rv.rating}/5</span>
                    <span className="text-xs text-paper-800/55">
                      {rv.reviewerLabel} · ders #{rv.sessionIndex} ·{" "}
                      {new Date(rv.createdAt).toLocaleString("tr-TR")}
                    </span>
                  </div>
                  {rv.commentPreview && (
                    <p className="mt-1 text-paper-800 line-clamp-3">{rv.commentPreview}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8 rounded-xl border border-paper-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-paper-900">
              Örnek ders anlatım videosu
            </h2>
            <Link
              href="/teacher/edit?focus=video"
              className="text-sm font-medium text-brand-800 underline"
            >
              {me?.teacher.videoUrl ? "Düzenle" : "Video ekle"}
            </Link>
          </div>
          <p className="mt-1 text-xs text-paper-800/55">
            YouTube veya Loom gibi bir video bağlantısı ekleyin. Bu video herkese açık öğretmen profilinizde de gösterilir.
          </p>

          {me?.teacher.videoUrl ? (
            <div className="mt-4">
              {(() => {
                const embed = tryYoutubeEmbed(me.teacher.videoUrl);
                if (embed) {
                  return (
                    <div className="aspect-video w-full overflow-hidden rounded-xl border border-paper-200 bg-black">
                      <iframe
                        src={embed}
                        className="h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        title="Örnek ders videosu"
                      />
                    </div>
                  );
                }
                return (
                  <a
                    href={me.teacher.videoUrl}
                    className="inline-block rounded-xl border border-paper-200 bg-white px-3 py-2 text-sm font-medium text-brand-800 underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Videoyu aç
                  </a>
                );
              })()}
              <div className="mt-2 text-xs text-paper-800/55">
                Video bağlantısı: <span className="font-mono">{me.teacher.videoUrl}</span>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-paper-100 bg-paper-50 p-4 text-sm text-paper-800">
              Henüz video eklenmedi. Profilinizin dönüşümü için önerilir.
            </div>
          )}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-paper-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-paper-900">
                Profil checklist
              </h2>
              <div className="text-sm font-medium text-paper-900">
                {me?.completionScore ?? 0}%
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {checklistItems.map((it) => (
                <div
                  key={it.key}
                  className="flex items-center justify-between rounded-xl border border-paper-100 bg-paper-50 px-3 py-2"
                >
                  <div className="text-sm text-paper-800">{it.key}</div>
                  <div className="flex items-center gap-3">
                    {!it.done && it.fix && (
                      <Link
                        href={it.fix}
                        className="text-xs font-medium text-brand-800 underline decoration-brand-200 underline-offset-4"
                      >
                        Düzelt
                      </Link>
                    )}
                    <div
                      className={`text-xs font-semibold ${it.done ? "text-brand-700" : "text-paper-800/55"}`}
                    >
                      {it.done ? "OK" : "Eksik"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-sm text-paper-800/75">
              {(() => {
                const next = checklistItems.find((it) => !it.done && it.fix);
                if (!next?.fix) {
                  return (
                    <>
                      Profil tamam.{" "}
                      <Link className="font-medium text-paper-900 underline" href="/teacher/requests">
                        Taleplere git
                      </Link>
                    </>
                  );
                }
                return (
                  <>
                    Sıradaki adım:{" "}
                    <Link className="font-medium text-paper-900 underline" href={next.fix}>
                      {next.key}
                    </Link>
                  </>
                );
              })()}
            </div>
          </div>

          <div id="ogretmen-aboneligi" className="rounded-xl border border-paper-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-paper-900">Abonelik</h2>
            <p className="mt-1 text-sm leading-relaxed text-paper-800/70">
              Abonelik, öğretmenin sadece panel kullanması değil; daha çok öğrenciye görünmesi, daha çok teklif
              verebilmesi ve profilini satış sayfası gibi kullanması içindir.
            </p>
            <div className="mt-3 rounded-xl border border-paper-100 bg-paper-50 p-3">
              <div className="text-sm font-medium text-paper-900">
                {sub?.active ? "Aktif" : "Aktif değil"}
              </div>
              <div className="mt-1 text-xs text-paper-800/75">
                {sub?.active && sub.subscription
                  ? `${sub.subscription.title} · bitiş: ${new Date(sub.subscription.expires_at).toLocaleDateString("tr-TR")} · ${teacherCampaignSummary(sub.subscription.plan_code, sub.subscription.promo_multiplier)}`
                  : "Abonelik yokken public profil sınırlı görünür. Günde 1 normal teklif ücretsizdir; sınırsız teklif ve tam profil için abonelik gerekir."}
              </div>
            </div>

            <p className="mt-2 text-xs text-paper-800/75">
              Ödeme: <span className="font-medium text-paper-800">PayTR</span> (kart) veya{" "}
              <span className="font-medium text-paper-800">doğrudan havale/EFT</span>. Yeterli cüzdan
              bakiyesi varsa cüzdandan da alabilirsiniz.
            </p>

            <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50/60 p-4">
              <div className="text-sm font-semibold text-brand-950">Neden abone olmalıyım?</div>
              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                {teacherSubscriptionReasons.map((reason) => (
                  <article key={reason.title} className="rounded-xl border border-brand-100 bg-white/80 p-3">
                    <h3 className="text-xs font-semibold text-brand-950">{reason.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-brand-900/80">{reason.body}</p>
                  </article>
                ))}
              </div>
              <div className="mt-4 text-sm font-semibold text-brand-950">Abone öğretmen neler kazanır?</div>
              <ul className="mt-3 space-y-2 text-xs leading-relaxed text-brand-900">
                {teacherSubscriptionBenefits.map((benefit) => (
                  <li key={benefit} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-700" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            <label className="mt-3 block text-xs text-paper-800/75">
              Havale için dekont / referans (isteğe bağlı)
              <input
                type="text"
                value={bankRefDraft}
                onChange={(e) => setBankRefDraft(e.target.value)}
                maxLength={120}
                placeholder="Örn. EFT referans no"
                className="mt-1 w-full rounded-lg border border-paper-200 bg-white px-2 py-1.5 text-sm text-paper-900"
              />
            </label>

            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-paper-100 bg-paper-50/80 p-3">
                <div className="text-sm font-medium text-paper-900">
                  <span className="text-paper-800/45 line-through">14.000 TL</span>{" "}
                  6 ay abonelik · 24 ay ücretsiz hediye · toplam 30 ay
                </div>
                <p className="mt-1 text-xs font-semibold text-warm-800">
                  Kampanya kontenjanı ilk 500 öğretmendir. Ödeme tutarı: 1750 TL.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={subPayBusy}
                    onClick={() => void buyWithPaytr("teacher_6m")}
                    className="rounded-lg bg-brand-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-900 disabled:opacity-50"
                  >
                    PayTR
                  </button>
                  <button
                    type="button"
                    disabled={subPayBusy}
                    onClick={() => void buyWithBank("teacher_6m")}
                    className="rounded-lg border border-paper-200 bg-white px-3 py-1.5 text-xs font-medium text-paper-900 disabled:opacity-50"
                  >
                    Havale bilgisi
                  </button>
                  <button
                    type="button"
                    disabled={subPayBusy}
                    onClick={() => void buyFromWallet("teacher_6m")}
                    className="rounded-lg border border-paper-200 bg-white px-3 py-1.5 text-xs font-medium text-paper-900 disabled:opacity-50"
                  >
                    Cüzdandan
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-paper-100 bg-paper-50/80 p-3">
                <div className="text-sm font-medium text-paper-900">
                  <span className="text-paper-800/45 line-through">20.000 TL</span>{" "}
                  12 ay abonelik · 48 ay ücretsiz hediye · toplam 60 ay
                </div>
                <p className="mt-1 text-xs font-semibold text-warm-800">
                  Kampanya kontenjanı ilk 500 öğretmendir. Ödeme tutarı: 2500 TL.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={subPayBusy}
                    onClick={() => void buyWithPaytr("teacher_12m")}
                    className="rounded-lg bg-brand-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-900 disabled:opacity-50"
                  >
                    PayTR
                  </button>
                  <button
                    type="button"
                    disabled={subPayBusy}
                    onClick={() => void buyWithBank("teacher_12m")}
                    className="rounded-lg border border-paper-200 bg-white px-3 py-1.5 text-xs font-medium text-paper-900 disabled:opacity-50"
                  >
                    Havale bilgisi
                  </button>
                  <button
                    type="button"
                    disabled={subPayBusy}
                    onClick={() => void buyFromWallet("teacher_12m")}
                    className="rounded-lg border border-paper-200 bg-white px-3 py-1.5 text-xs font-medium text-paper-900 disabled:opacity-50"
                  >
                    Cüzdandan
                  </button>
                </div>
              </div>
            </div>

            {bankInstructions && (
              <div className="mt-3 rounded-xl border border-paper-100 bg-paper-50 p-3 text-xs text-paper-800">
                <div className="font-medium text-paper-900">Havale talimatı</div>
                <dl className="mt-2 space-y-1.5">
                  <div>
                    <dt className="text-paper-800/55">Hesap adı</dt>
                    <dd className="font-medium text-paper-900">{bankInstructions.accountName}</dd>
                  </div>
                  <div>
                    <dt className="text-paper-800/55">IBAN</dt>
                    <dd className="break-all font-mono text-paper-900">{bankInstructions.iban || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-paper-800/55">Açıklama (zorunlu)</dt>
                    <dd className="break-all font-mono text-paper-900">{bankInstructions.description}</dd>
                  </div>
                  <div>
                    <dt className="text-paper-800/55">Tutar (TRY)</dt>
                    <dd className="font-mono text-paper-900">{bankInstructions.amountTry}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-paper-800/75">{bankInstructions.note}</p>
              </div>
            )}

            <div className="mt-5">
              <h2 className="text-base font-semibold text-paper-900">Branşlar</h2>
            <div className="mt-3 space-y-2">
              {(me?.teacher.branches ?? []).length === 0 ? (
                <div className="text-sm text-paper-800/75">Henüz seçilmedi.</div>
              ) : (
                me?.teacher.branches.map((b) => (
                  <div
                    key={b.branchId}
                    className="flex items-center justify-between rounded-xl border border-paper-100 px-3 py-2"
                  >
                    <div className="text-sm font-medium text-paper-900">
                      {b.name}
                    </div>
                    <div className="text-xs text-paper-800/55">
                      {b.isPrimary ? "Ana" : "—"}
                    </div>
                  </div>
                ))
              )}
            </div>
            </div>
          </div>
        </div>

        {loading && (
          <div className="mt-6 text-sm text-paper-800/55">Yükleniyor...</div>
        )}
      </div>
    </div>
  );
}

