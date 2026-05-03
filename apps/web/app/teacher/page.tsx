"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../lib/api";
import { loginHrefWithReturn } from "../lib/authRedirect";
import { clearToken, getToken } from "../lib/auth";

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

function homeworkNotifHref(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const o = payload as { kind?: string };
  if (
    o.kind === "homework_rewarded" ||
    o.kind === "homework_answer_rejected" ||
    o.kind === "homework_new_post"
  ) {
    return "/teacher/odev-havuzu";
  }
  return null;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
        {value}
      </div>
    </div>
  );
}

export default function TeacherHomePage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
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

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [router, pathname]);

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
      platformLinksAdded: "Özel platform linkleri eklendi",
      examDocsAdded: "Doküman eklendi",
      onboardingInterviewDone: "Onboarding görüşmesi tamam",
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

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-medium text-zinc-500">
              Öğretmen paneli
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
              {me?.teacher.displayName ?? "—"}
            </h1>
            <div className="mt-1 text-sm text-zinc-600">
              Doğrulama:{" "}
              <span className="font-medium text-zinc-900">
                {me?.teacher.verificationStatus ?? "—"}
              </span>
              {" · "}
              Tamamlanma:{" "}
              <span className="font-medium text-zinc-900">
                {me?.completionScore ?? 0}%
              </span>
              {me?.teacher.ratingCount != null &&
                me.teacher.ratingCount > 0 &&
                me.teacher.ratingAvg != null && (
                  <>
                    {" · "}
                    <span className="font-medium text-zinc-900">
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
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm"
            >
              Yenile
            </button>
            <button
              onClick={() => {
                clearToken();
                router.push("/login");
              }}
              className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
            >
              Çıkış
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {notifications.length > 0 && (
          <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-900">Bildirimler</h2>
            <p className="mt-1 text-xs text-zinc-500">Ödev, yorum ve bildirimler.</p>
            <ul className="mt-4 space-y-3">
              {notifications.map((n) => {
                const unread = n.read_at == null;
                const hwHref = homeworkNotifHref(n.payload_jsonb);
                return (
                  <li
                    key={n.id}
                    className={`rounded-xl border px-3 py-2 text-sm ${
                      unread
                        ? "border-brand-200 bg-brand-50/60"
                        : "border-zinc-100 bg-zinc-50"
                    }`}
                  >
                    <div className="font-medium text-zinc-900">{n.title}</div>
                    <p className="mt-1 text-zinc-700">{n.body}</p>
                    {hwHref ? (
                      <Link
                        href={hwHref}
                        className="mt-2 inline-block text-xs font-medium text-brand-800 underline"
                      >
                        Ödev havuzuna git
                      </Link>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
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
                          className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-100 disabled:opacity-50"
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
          <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-zinc-900">Son yorumlar</h2>
              {me?.teacher.id && (
                <Link
                  href={`/ogretmenler/${me.teacher.id}`}
                  className="text-sm font-medium text-brand-800 underline"
                >
                  Herkese açık profilim
                </Link>
              )}
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Öğrenci adları gizlilik için kısaltılır; yıldızlar herkese açık profilde de görünür.
            </p>
            <ul className="mt-4 space-y-3">
              {(dash?.recentReviews ?? []).map((rv) => (
                <li
                  key={`${rv.createdAt}-${rv.sessionIndex}-${rv.reviewerLabel}-${rv.rating}`}
                  className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-amber-800">★ {rv.rating}/5</span>
                    <span className="text-xs text-zinc-500">
                      {rv.reviewerLabel} · ders #{rv.sessionIndex} ·{" "}
                      {new Date(rv.createdAt).toLocaleString("tr-TR")}
                    </span>
                  </div>
                  {rv.commentPreview && (
                    <p className="mt-1 text-zinc-700 line-clamp-3">{rv.commentPreview}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-zinc-900">
              Örnek ders anlatım videosu
            </h2>
            <Link
              href="/teacher/edit?focus=video"
              className="text-sm font-medium text-brand-800 underline"
            >
              {me?.teacher.videoUrl ? "Düzenle" : "Video ekle"}
            </Link>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            YouTube/Loom gibi bir link ekleyin. Bu video herkese açık öğretmen profilinizde de gösterilir.
          </p>

          {me?.teacher.videoUrl ? (
            <div className="mt-4">
              {(() => {
                const embed = tryYoutubeEmbed(me.teacher.videoUrl);
                if (embed) {
                  return (
                    <div className="aspect-video w-full overflow-hidden rounded-xl border border-zinc-200 bg-black">
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
                    className="inline-block rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-brand-800 underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Videoyu aç
                  </a>
                );
              })()}
              <div className="mt-2 text-xs text-zinc-500">
                URL: <span className="font-mono">{me.teacher.videoUrl}</span>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50 p-4 text-sm text-zinc-700">
              Henüz video eklenmedi. Profilinizin dönüşümü için önerilir.
            </div>
          )}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-900">
                Profil checklist
              </h2>
              <div className="text-sm font-medium text-zinc-900">
                {me?.completionScore ?? 0}%
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {checklistItems.map((it) => (
                <div
                  key={it.key}
                  className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2"
                >
                  <div className="text-sm text-zinc-700">{it.key}</div>
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
                      className={`text-xs font-semibold ${it.done ? "text-brand-700" : "text-zinc-500"}`}
                    >
                      {it.done ? "OK" : "Eksik"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-sm text-zinc-600">
              Sonraki adım:{" "}
              <Link className="font-medium text-zinc-900 underline" href="/teacher/edit">
                Profil & branş düzenle
              </Link>
            {" · "}
            <Link className="font-medium text-zinc-900 underline" href="/teacher/requests">
              Ders talepleri
            </Link>
            {" · "}
            <Link className="font-medium text-zinc-900 underline" href="/teacher/teklifler">
              Verdiğim teklifler
            </Link>
            {" · "}
            <Link className="font-medium text-zinc-900 underline" href="/teacher/kurslar">
              Online kurslar
            </Link>
            {" · "}
            <Link className="font-medium text-zinc-900 underline" href="/teacher/dersler">
              Ders oturumları
            </Link>
            {" · "}
            <Link className="font-medium text-zinc-900 underline" href="/teacher/grup-dersler">
              Grup ders ilanları
            </Link>
            {" · "}
            <Link className="font-medium text-zinc-900 underline" href="/teacher/cuzdan">
              Cüzdan
            </Link>
            {" · "}
            <Link className="font-medium text-zinc-900 underline" href="/teacher/dogrudan-dersler">
              Doğrudan dersler
            </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-900">Abonelik</h2>
            <div className="mt-3 rounded-xl border border-zinc-100 bg-zinc-50 p-3">
              <div className="text-sm font-medium text-zinc-900">
                {sub?.active ? "Aktif" : "Aktif değil"}
              </div>
              <div className="mt-1 text-xs text-zinc-600">
                {sub?.active && sub.subscription
                  ? `${sub.subscription.title} · bitiş: ${new Date(sub.subscription.expires_at).toLocaleDateString("tr-TR")} · kampanya x${sub.subscription.promo_multiplier}`
                  : "Sınırsız teklif ve Akademi’de ders verme hakkı için abonelik gerekli."}
              </div>
            </div>

            <p className="mt-2 text-xs text-zinc-600">
              Ödeme: <span className="font-medium text-zinc-800">PayTR</span> (kart) veya{" "}
              <span className="font-medium text-zinc-800">doğrudan havale/EFT</span>. Yeterli cüzdan
              bakiyesi varsa cüzdandan da alabilirsiniz.
            </p>

            <label className="mt-3 block text-xs text-zinc-600">
              Havale için dekont / referans (isteğe bağlı)
              <input
                type="text"
                value={bankRefDraft}
                onChange={(e) => setBankRefDraft(e.target.value)}
                maxLength={120}
                placeholder="Örn. EFT referans no"
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900"
              />
            </label>

            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-3">
                <div className="text-sm font-medium text-zinc-900">
                  6 Aylık (1750 TL) + 12 ay hediye
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={subPayBusy}
                    onClick={() => void buyWithPaytr("teacher_6m")}
                    className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  >
                    PayTR
                  </button>
                  <button
                    type="button"
                    disabled={subPayBusy}
                    onClick={() => void buyWithBank("teacher_6m")}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 disabled:opacity-50"
                  >
                    Havale bilgisi
                  </button>
                  <button
                    type="button"
                    disabled={subPayBusy}
                    onClick={() => void buyFromWallet("teacher_6m")}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 disabled:opacity-50"
                  >
                    Cüzdandan
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-3">
                <div className="text-sm font-medium text-zinc-900">
                  12 Aylık (2500 TL) + 24 ay hediye
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={subPayBusy}
                    onClick={() => void buyWithPaytr("teacher_12m")}
                    className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  >
                    PayTR
                  </button>
                  <button
                    type="button"
                    disabled={subPayBusy}
                    onClick={() => void buyWithBank("teacher_12m")}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 disabled:opacity-50"
                  >
                    Havale bilgisi
                  </button>
                  <button
                    type="button"
                    disabled={subPayBusy}
                    onClick={() => void buyFromWallet("teacher_12m")}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 disabled:opacity-50"
                  >
                    Cüzdandan
                  </button>
                </div>
              </div>
            </div>

            {bankInstructions && (
              <div className="mt-3 rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-xs text-zinc-700">
                <div className="font-medium text-zinc-900">Havale talimatı</div>
                <dl className="mt-2 space-y-1.5">
                  <div>
                    <dt className="text-zinc-500">Hesap adı</dt>
                    <dd className="font-medium text-zinc-900">{bankInstructions.accountName}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">IBAN</dt>
                    <dd className="break-all font-mono text-zinc-900">{bankInstructions.iban || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Açıklama (zorunlu)</dt>
                    <dd className="break-all font-mono text-zinc-900">{bankInstructions.description}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Tutar (TRY)</dt>
                    <dd className="font-mono text-zinc-900">{bankInstructions.amountTry}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-zinc-600">{bankInstructions.note}</p>
              </div>
            )}

            <div className="mt-5">
              <h2 className="text-base font-semibold text-zinc-900">Branşlar</h2>
            <div className="mt-3 space-y-2">
              {(me?.teacher.branches ?? []).length === 0 ? (
                <div className="text-sm text-zinc-600">Henüz seçilmedi.</div>
              ) : (
                me?.teacher.branches.map((b) => (
                  <div
                    key={b.branchId}
                    className="flex items-center justify-between rounded-xl border border-zinc-100 px-3 py-2"
                  >
                    <div className="text-sm font-medium text-zinc-900">
                      {b.name}
                    </div>
                    <div className="text-xs text-zinc-500">
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
          <div className="mt-6 text-sm text-zinc-500">Yükleniyor...</div>
        )}
      </div>
    </div>
  );
}

