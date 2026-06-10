"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../../lib/api";
import { loginHrefWithReturn } from "../../../lib/authRedirect";
import { clearToken, getRoleFromToken, getToken } from "../../../lib/auth";
import { RequestChat } from "../../../components/RequestChat";

type Branch = { id: number; parent_id: number | null; name: string; slug: string };

type MyRequest = {
  id: string;
  status: string;
  student_id?: string;
  student_display_name?: string;
  request_kind?: "regular" | "demo";
  target_teacher_id: string | null;
  target_teacher_display_name: string | null;
  topic_text: string | null;
  branch_id: number;
  created_at: string;
  offers_count: number;
};

type Offer = {
  id: string;
  teacher_id: string;
  status: string;
  message: string;
  proposed_hourly_rate_minor: number | null;
  created_at: string;
  display_name: string;
  rating_avg: string | number | null;
  rating_count: number | null;
  verification_status: string;
  profile_quality_score: number;
  has_video: boolean;
  has_exam_docs: boolean;
  completed_sessions_count: number;
  is_shortlisted_teacher: boolean;
  response_minutes: number;
  lowest_proposed_hourly_rate_minor: number | null;
  comparison_score: number;
};

function offerStatusTr(status: string): string {
  switch (status) {
    case "sent":
      return "Beklemede";
    case "accepted":
      return "Kabul edildi";
    case "rejected":
      return "Reddedildi";
    case "withdrawn":
      return "Geri çekildi";
    default:
      return status;
  }
}

function requestStatusTr(status: string): string {
  const m: Record<string, string> = {
    open: "Açık",
    matched: "Eşleşti",
    cancelled: "İptal edildi",
    expired: "Süresi doldu",
  };
  return m[status] ?? status;
}

function tl(minor: number | null): string {
  if (minor == null) return "Belirtilmedi";
  return `${(minor / 100).toFixed(2)} TL`;
}

function responseLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} dk içinde`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} saat içinde`;
  return `${Math.round(hours / 24)} gün içinde`;
}

function qualityLabel(score: number): string {
  if (score >= 80) return "Çok güçlü profil";
  if (score >= 60) return "Güçlü profil";
  if (score >= 40) return "Gelişen profil";
  return "Yeni profil";
}

function packageTotalLabel(hourlyMinor: number | null, lessonCount: number, durationMinutes: number): string {
  if (hourlyMinor == null) return "Teklif ücreti bekleniyor";
  return tl(Math.round(hourlyMinor * lessonCount * (durationMinutes / 60)));
}

function offerDecisionReasons(offer: Offer): string[] {
  const reasons: string[] = [];
  if (offer.comparison_score >= 80) reasons.push("Karşılaştırma skoru yüksek");
  if (offer.verification_status === "verified") reasons.push("Doğrulanmış öğretmen");
  if (offer.is_shortlisted_teacher) reasons.push("Kısa listenizdeydi");
  if (offer.completed_sessions_count >= 10) reasons.push("Ders geçmişi güçlü");
  if (offer.has_video) reasons.push("Video profili var");
  if (offer.has_exam_docs) reasons.push("Belge/doküman var");
  if (
    offer.lowest_proposed_hourly_rate_minor != null &&
    offer.proposed_hourly_rate_minor === offer.lowest_proposed_hourly_rate_minor
  ) {
    reasons.push("En düşük fiyatlı teklif");
  }
  return reasons.slice(0, 3);
}

export default function StudentRequestDetailPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const params = useParams();
  const requestId = typeof params.requestId === "string" ? params.requestId : "";

  const [token, setToken] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  /** undefined: henüz yüklenmedi; null: listede yok; nesne: özet */
  const [summary, setSummary] = useState<MyRequest | null | undefined>(undefined);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [packageLessonCount, setPackageLessonCount] = useState(4);
  const [lessonDurationMinutes, setLessonDurationMinutes] = useState(60);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [router, pathname]);

  const branchName = useMemo(() => {
    if (!summary) return "";
    const b = branches.find((x) => x.id === summary.branch_id);
    return b?.name ?? "Branş bilgisi eksik";
  }, [branches, summary]);

  const bestOffer = useMemo(() => {
    return offers.find((o) => o.status === "sent") ?? offers[0] ?? null;
  }, [offers]);

  const load = useCallback(
    async (t: string) => {
      setError(null);
      setOk(null);
      const [b, m] = await Promise.all([
        apiFetch<{ branches: Branch[] }>("/v1/meta/branches"),
        apiFetch<{ requests: MyRequest[] }>("/v1/lesson-requests/mine", { token: t }),
      ]);
      setBranches(b.branches);
      const row = m.requests.find((r) => r.id === requestId);
      if (!row) {
        setSummary(null);
        setOffers([]);
        return;
      }
      setSummary(row);
      const o = await apiFetch<{ offers: Offer[] }>(
        `/v1/lesson-requests/${requestId}/offers`,
        { token: t },
      );
      setOffers(o.offers);
    },
    [requestId],
  );

  useEffect(() => {
    if (!token || !requestId) return;
    load(token).catch((e) => {
      const msg = e instanceof Error ? e.message : "load_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
        return;
      }
      if (msg.includes("[403]")) {
        setError("Bu talebe erişim izniniz yok.");
      }
    });
  }, [token, requestId, load, router, pathname]);

  useEffect(() => {
    if (summary?.request_kind !== "demo") return;
    setPackageLessonCount(1);
    setLessonDurationMinutes(30);
  }, [summary?.request_kind]);

  async function cancelRequest() {
    if (!token) return;
    if (
      !window.confirm(
        "Bu talebi iptal etmek istediğinize emin misiniz? Bekleyen teklifler reddedilir.",
      )
    ) {
      return;
    }
    setCancelling(true);
    setError(null);
    setOk(null);
    try {
      await apiFetch(`/v1/lesson-requests/${requestId}/cancel`, {
        method: "POST",
        token,
      });
      await load(token);
      setOk("Talep iptal edildi.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "cancel_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Bu talep üzerinde işlem yapma yetkiniz yok.");
      }
    } finally {
      setCancelling(false);
    }
  }

  async function decide(offerId: string, decision: "accept" | "reject") {
    if (!token) return;
    setBusyId(offerId);
    setError(null);
    setOk(null);
    try {
      const accepted = await apiFetch<{
        packageId?: string;
        lessonSessionId?: string;
        payment?: { status: string; totalAmountMinor: number; holdId: string | null };
      }>(`/v1/lesson-requests/${requestId}/offers/${offerId}/decide`, {
        method: "POST",
        token,
        body: JSON.stringify({
          decision,
          ...(decision === "accept"
            ? {
                packageLessonCount,
                lessonDurationMinutes,
              }
            : {}),
        }),
      });
      await load(token);
      setOk(
        decision === "accept"
          ? `Teklif kabul edildi; paket oluşturuldu${
              accepted.payment?.totalAmountMinor
                ? ` ve ${tl(accepted.payment.totalAmountMinor)} cüzdanda güvenceye alındı`
                : ""
            }.`
          : "Teklif reddedildi.",
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "decide_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Bu teklif üzerinde işlem yapma yetkiniz yok.");
      }
      if (msg.includes("insufficient_wallet_available")) {
        setError(
          getRoleFromToken(token) === "guardian"
            ? "Kullanılabilir cüzdan bakiyesi paketi güvenceye almak için yetersiz."
            : "Kullanılabilir cüzdan bakiyesi paketi güvenceye almak için yetersiz. Öğrenci panelinden bakiye yükleyin.",
        );
      }
    } finally {
      setBusyId(null);
    }
  }

  if (!token) return null;
  const role = getRoleFromToken(token);
  const isGuardian = role === "guardian";
  const requestBaseHref = isGuardian ? "/guardian/requests" : "/student/requests";

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div>
          <Link
            href={requestBaseHref}
            className="text-sm font-medium text-paper-800/75 underline decoration-paper-300 underline-offset-4 hover:text-paper-900"
          >
            ← İlanlarım
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-paper-900">
            {summary?.request_kind === "demo" ? "Demo talebi ve teklifler" : "Talep ve teklifler"}
          </h1>
          {summary && (
            <p className="mt-1 text-sm text-paper-800/75">
              {branchName} · durum:{" "}
              <span className="font-medium">{requestStatusTr(summary.status)}</span>
              {isGuardian && summary.student_display_name ? ` · öğrenci: ${summary.student_display_name}` : ""}
            </p>
          )}
          {summary?.request_kind === "demo" && (
            <p className="mt-2 text-sm text-brand-900">
              Demo ders talebi
              {summary.target_teacher_display_name
                ? ` · Öğretmen: ${summary.target_teacher_display_name}`
                : ""}
            </p>
          )}
          {summary?.topic_text && (
            <p className="mt-1 text-sm text-paper-800/65">Konu: {summary.topic_text}</p>
          )}
          <p className="mt-2 text-sm text-paper-800/65">
            {isGuardian
              ? "Teklifi kabul ettiğinizde ödeme güvencesi işlemi yapan veli hesabı üzerinden kontrol edilir."
              : (
                <>
                  Diğer sayfalar üst menüden. Ödeme ve bakiye:{" "}
                  <Link
                    href="/student/panel"
                    className="font-medium text-brand-800 underline-offset-4 hover:underline"
                  >
                    özet / cüzdan
                  </Link>
                  .
                </>
              )}
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {ok && (
          <div className="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
            {ok}
          </div>
        )}

        {summary === undefined && !error && (
          <div className="mt-8 text-sm text-paper-800/75">Yükleniyor…</div>
        )}

        {summary === null && (
          <div className="mt-8 rounded-xl border border-paper-200 bg-white p-5 text-sm text-paper-800/75 shadow-sm">
            Bu talep bulunamadı veya size ait değil.
          </div>
        )}

        {summary != null && (
          <div className="mt-8 space-y-3">
            <section className="rounded-2xl border border-paper-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-paper-800/55">
                    Şeffaf ilerleme
                  </div>
                  <h2 className="mt-1 text-base font-semibold text-paper-900">
                    Teklifi kabul etmeden önce paket, ödeme güvencesi ve sonraki adım netleşir.
                  </h2>
                </div>
                {bestOffer ? (
                  <div className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-950">
                    <div className="text-xs font-medium text-brand-900/70">Seçili paket toplamı</div>
                    <div className="mt-0.5 font-semibold">
                      {packageTotalLabel(bestOffer.proposed_hourly_rate_minor, packageLessonCount, lessonDurationMinutes)}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-4">
                {[
                  ["1", "Teklifleri karşılaştır", "Puan, kalite, ücret ve yanıt hızı aynı kartta."],
                  ["2", "Paketi seç", `${packageLessonCount} ders · ${lessonDurationMinutes} dk ile toplam tutar hesaplanır.`],
                  ["3", "Tutar güvenceye alınır", "Kabulde tutar cüzdanda tutulur, ders bitmeden aktarılmaz."],
                  ["4", "Ders takibi başlar", "Canlı sınıf, özet ve veli görünürlüğü aynı panelde devam eder."],
                ].map(([step, title, body]) => (
                  <div key={step} className="rounded-xl border border-paper-200 bg-paper-50 p-3">
                    <div className="text-[11px] font-semibold text-brand-900">Adım {step}</div>
                    <div className="mt-1 text-xs font-semibold text-paper-900">{title}</div>
                    <p className="mt-1 text-xs leading-relaxed text-paper-800/60">{body}</p>
                  </div>
                ))}
              </div>
            </section>
            {summary.status === "open" ? (
              <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-4 text-sm text-brand-950">
                <div className="font-semibold">Paket ve ödeme güvencesi</div>
                <p className="mt-1">
                  Teklif kabulünde paket oluşturulur; seçtiğiniz ders sayısı ve süreye göre toplam tutar cüzdanınızda
                  güvenceye alınır. Dersler tamamlandıkça ödeme kayıtlarından izlenir.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl bg-white/80 p-3 ring-1 ring-brand-100">
                    <div className="text-xs font-semibold text-brand-950">1. Kalite skoru</div>
                    <p className="mt-1 text-xs text-brand-900/75">Önerilen teklif, karşılaştırma skoru ve kısa liste bilgisiyle öne çıkar.</p>
                  </div>
                  <div className="rounded-xl bg-white/80 p-3 ring-1 ring-brand-100">
                    <div className="text-xs font-semibold text-brand-950">2. Güvenli ödeme</div>
                    <p className="mt-1 text-xs text-brand-900/75">Ödeme ders tamamlanmadan öğretmene aktarılmaz; paket defterde izlenir.</p>
                  </div>
                  <div className="rounded-xl bg-white/80 p-3 ring-1 ring-brand-100">
                    <div className="text-xs font-semibold text-brand-950">3. Demo sonrası paket</div>
                    <p className="mt-1 text-xs text-brand-900/75">Demo için 30 dk seçilir; memnun kalınca aynı öğretmenle devam paketi büyütülür.</p>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-medium text-brand-950">Ders sayısı</span>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={packageLessonCount}
                      onChange={(e) => setPackageLessonCount(Math.min(60, Math.max(1, Number(e.target.value) || 1)))}
                      className="mt-1 w-full rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm text-paper-900"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-brand-950">Ders süresi (dk)</span>
                    <select
                      value={lessonDurationMinutes}
                      onChange={(e) => setLessonDurationMinutes(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm text-paper-900"
                    >
                      <option value={30}>30 dk</option>
                      <option value={45}>45 dk</option>
                      <option value={60}>60 dk</option>
                      <option value={90}>90 dk</option>
                      <option value={120}>120 dk</option>
                    </select>
                  </label>
                </div>
              </div>
            ) : null}
            {summary.status === "open" && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-paper-200 bg-white p-4 shadow-sm">
                <p className="text-sm text-paper-800/75">
                  Talebi artık istemiyorsanız iptal edebilirsiniz; öğretmenlerle
                  mesajlaşma kapanır.
                </p>
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={() => void cancelRequest()}
                  className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
                >
                  {cancelling ? "İptal ediliyor…" : "Talebi iptal et"}
                </button>
              </div>
            )}
            {offers.length === 0 ? (
              <div className="rounded-xl border border-paper-200 bg-white p-5 text-sm text-paper-800/75 shadow-sm">
                Henüz teklif yok. Öğretmenler talebi gördükçe burada listelenecek.
              </div>
            ) : (
              <>
                {bestOffer ? (
                  <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-950">
                    <div className="font-semibold">Önerilen teklif: {bestOffer.display_name}</div>
                    <p className="mt-1">
                      Karşılaştırma skoru {bestOffer.comparison_score}/100 · {tl(bestOffer.proposed_hourly_rate_minor)} / saat · cevap {responseLabel(bestOffer.response_minutes)}
                      {bestOffer.is_shortlisted_teacher ? " · kısa listenizdeydi" : ""}.
                    </p>
                  </div>
                ) : null}
                {offers.map((o) => {
                  const canAct =
                    summary.status === "open" && o.status === "sent";
                  const isBest = bestOffer?.id === o.id && o.status === "sent";
                  const decisionReasons = offerDecisionReasons(o);
                  return (
                  <div
                    key={o.id}
                    className={`rounded-xl border bg-white p-5 shadow-sm ${
                      isBest ? "border-brand-300" : "border-paper-200"
                    }`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-paper-900">
                            {o.display_name}
                          </div>
                          {isBest ? (
                            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-900">
                              Önerilen
                            </span>
                          ) : null}
                          {o.is_shortlisted_teacher ? (
                            <span className="rounded-full bg-warm-50 px-2 py-0.5 text-[11px] font-semibold text-warm-900">
                              Kısa listenizdeydi
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-paper-800/55">
                          {offerStatusTr(o.status)} ·{" "}
                          {new Date(o.created_at).toLocaleString("tr-TR")}
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="rounded-lg bg-paper-50 p-2">
                            <div className="text-[11px] text-paper-800/55">Saatlik teklif</div>
                            <div className="mt-0.5 text-sm font-semibold text-paper-900">
                              {tl(o.proposed_hourly_rate_minor)}
                            </div>
                          </div>
                          <div className="rounded-lg bg-paper-50 p-2">
                            <div className="text-[11px] text-paper-800/55">Karşılaştırma</div>
                            <div className="mt-0.5 text-sm font-semibold text-paper-900">
                              {o.comparison_score}/100
                            </div>
                          </div>
                          <div className="rounded-lg bg-paper-50 p-2">
                            <div className="text-[11px] text-paper-800/55">Puan</div>
                            <div className="mt-0.5 text-sm font-semibold text-paper-900">
                              {o.rating_count ? `${Number(o.rating_avg ?? 0).toFixed(1)} (${o.rating_count})` : "Yeni"}
                            </div>
                          </div>
                          <div className="rounded-lg bg-paper-50 p-2">
                            <div className="text-[11px] text-paper-800/55">Cevap süresi</div>
                            <div className="mt-0.5 text-sm font-semibold text-paper-900">
                              {responseLabel(o.response_minutes)}
                            </div>
                          </div>
                        </div>
                        {canAct ? (
                          <div className="mt-3 rounded-xl border border-paper-200 bg-paper-50 p-3 text-xs text-paper-800/75">
                            Paket toplamı:{" "}
                            <span className="font-semibold text-paper-900">
                              {packageTotalLabel(o.proposed_hourly_rate_minor, packageLessonCount, lessonDurationMinutes)}
                            </span>{" "}
                            · {packageLessonCount} ders · {lessonDurationMinutes} dk. Kabulde bu tutar cüzdanda güvenceye
                            alınır.
                          </div>
                        ) : null}
                        <div className="mt-3 rounded-xl border border-paper-100 bg-paper-50 p-3">
                          <div className="text-xs font-semibold text-paper-900">Neden dikkate alınmalı?</div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {(decisionReasons.length ? decisionReasons : ["Mesajı ve profil detayını inceleyin"]).map((reason) => (
                              <span key={reason} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-paper-800 ring-1 ring-paper-200">
                                {reason}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-paper-100 px-2 py-0.5 text-[11px] font-medium text-paper-800">
                            {qualityLabel(o.profile_quality_score)} · {o.profile_quality_score}/100
                          </span>
                          {o.verification_status === "verified" ? (
                            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-900">
                              Doğrulanmış
                            </span>
                          ) : null}
                          {o.has_video ? (
                            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-900">
                              Video var
                            </span>
                          ) : null}
                          {o.has_exam_docs ? (
                            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-900">
                              Belgeli
                            </span>
                          ) : null}
                          {o.completed_sessions_count > 0 ? (
                            <span className="rounded-full bg-paper-100 px-2 py-0.5 text-[11px] font-medium text-paper-800">
                              {o.completed_sessions_count} tamamlanan ders
                            </span>
                          ) : null}
                          {o.lowest_proposed_hourly_rate_minor != null &&
                          o.proposed_hourly_rate_minor === o.lowest_proposed_hourly_rate_minor ? (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                              En düşük fiyat
                            </span>
                          ) : null}
                          {o.is_shortlisted_teacher ? (
                            <span className="rounded-full bg-warm-50 px-2 py-0.5 text-[11px] font-medium text-warm-900">
                              Önceden seçtiğiniz öğretmen
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm text-paper-800">
                          {o.message}
                        </p>
                        <Link
                          href={`/ogretmenler/${o.teacher_id}`}
                          className="mt-3 inline-block text-xs font-medium text-brand-800 underline"
                        >
                          Öğretmen profilini incele
                        </Link>
                      </div>
                      {canAct && (
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            disabled={busyId === o.id}
                            onClick={() => void decide(o.id, "accept")}
                            className="rounded-xl bg-brand-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                          >
                            {busyId === o.id ? "…" : "Paketi kabul et"}
                          </button>
                          <button
                            type="button"
                            disabled={busyId === o.id}
                            onClick={() => void decide(o.id, "reject")}
                            className="rounded-xl border border-paper-300 bg-white px-3 py-2 text-sm font-medium text-paper-800 disabled:opacity-50"
                          >
                            Reddet
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })}
              </>
            )}
            {(summary.status === "open" || summary.status === "matched") && (
              <RequestChat token={token} requestId={requestId} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
