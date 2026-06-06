"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useRequireAdmin } from "../useRequireAdmin";

type Cfg = {
  title: string;
  path: string;
  arrayKey: string;
};
type ReconciliationSummary = {
  byStatus: { status: string; resolution_status: string; count: number; latest_at: string | null }[];
  openIssues: number;
  issues30d: number;
  amountMismatches30d: number;
  unknownMerchantOids30d: number;
  failed30d: number;
  latestIssueAt: string | null;
};
type FunnelSummary = {
  days: number;
  funnel: { eventName: string; count: number; conversionFromSearch: number | null }[];
  operations?: {
    quotaExceeded?: { event_name: string; count: number }[];
    rateLimit?: { activeBuckets: number; limiters: { name: string; allowed: number; limited: number }[] };
  };
};
type CourseAccountingSummary = {
  held_amount_minor?: string | number;
  gross_collected_amount_minor?: string | number;
  refunded_amount_minor?: string | number;
  teacher_payout_amount_minor?: string | number;
  net_platform_amount_minor?: string | number;
};
type JobMonitoringSummary = { openAlerts?: number; total?: number };

const DATASETS: Record<string, Cfg> = {
  ledger: { title: "Cüzdan defteri", path: "/api/admin/wallet-ledger", arrayKey: "entries" },
  packages: { title: "Ders paketleri", path: "/api/admin/lesson-packages", arrayKey: "packages" },
  "teacher-subs": {
    title: "Öğretmen abonelikleri",
    path: "/api/admin/teacher-subscriptions",
    arrayKey: "subscriptions",
  },
  "wallet-topups": { title: "Cüzdan yüklemeleri", path: "/api/admin/wallet-topups", arrayKey: "topups" },
  "teacher-withdrawals": {
    title: "Öğretmen para çekme talepleri",
    path: "/api/admin/teacher-withdrawals",
    arrayKey: "withdrawals",
  },
  "job-monitoring": {
    title: "Job / cron izleme",
    path: "/api/admin/job-monitoring",
    arrayKey: "jobs",
  },
  disputes: {
    title: "Uyuşmazlık merkezi",
    path: "/api/admin/disputes",
    arrayKey: "disputes",
  },
  reconciliation: {
    title: "Ödeme mutabakatı",
    path: "/api/admin/payment-reconciliation",
    arrayKey: "events",
  },
  "student-sub-payments": {
    title: "Öğrenci platform ödemeleri",
    path: "/api/admin/student-sub-payments",
    arrayKey: "payments",
  },
  enrollments: {
    title: "Kurs kayıtları",
    path: "/api/admin/course-enrollments",
    arrayKey: "enrollments",
  },
  "course-accounting": {
    title: "Kurs muhasebesi",
    path: "/api/admin/course-accounting",
    arrayKey: "rows",
  },
  notifications: {
    title: "Veli bildirimleri",
    path: "/api/admin/parent-notifications",
    arrayKey: "notifications",
  },
  "guardian-invites": {
    title: "Veli davet kodları",
    path: "/api/admin/guardian-invites",
    arrayKey: "invites",
  },
  classroom: {
    title: "Sınıf notları ve tahta kayıtları",
    path: "/api/admin/classroom-notes",
    arrayKey: "notes",
  },
  recordings: {
    title: "Sınıf kayıtları ve tekrar izleme",
    path: "/api/admin/classroom-recordings",
    arrayKey: "recordings",
  },
  messages: {
    title: "Sınıf sohbet ve soru mesajları",
    path: "/api/admin/classroom-messages",
    arrayKey: "messages",
  },
  learning: {
    title: "Çalışma planı ve deneme kayıtları",
    path: "/api/admin/learning",
    arrayKey: "rows",
  },
  homework: {
    title: "Soru kalite kuyruğu",
    path: "/api/admin/homework-quality",
    arrayKey: "posts",
  },
  "teacher-campaigns": {
    title: "Öğretmen kampanyaları",
    path: "/api/admin/teacher-campaigns",
    arrayKey: "campaigns",
  },
  funnel: {
    title: "Funnel ve operasyon metrikleri",
    path: "/api/admin/funnel-summary",
    arrayKey: "funnel",
  },
};

export default function AdminVeriPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center bg-paper-50 text-sm text-paper-800/55">
          Yükleniyor…
        </div>
      }
    >
      <AdminVeriInner />
    </Suspense>
  );
}

function AdminVeriInner() {
  const token = useRequireAdmin();
  const sp = useSearchParams();
  const key = sp.get("k") ?? "ledger";
  const cfg = DATASETS[key] ?? DATASETS.ledger;

  const [userIdFilter, setUserIdFilter] = useState("");
  const [appliedUserId, setAppliedUserId] = useState("");
  const [reconciliationStatus, setReconciliationStatus] = useState("");
  const [reconciliationResolutionStatus, setReconciliationResolutionStatus] = useState("open");
  const [teacherCampaignStatus, setTeacherCampaignStatus] = useState("pending_review");
  const [teacherWithdrawalStatus, setTeacherWithdrawalStatus] = useState("pending");
  const [teacherWithdrawalQ, setTeacherWithdrawalQ] = useState("");
  const [teacherWithdrawalFrom, setTeacherWithdrawalFrom] = useState("");
  const [teacherWithdrawalTo, setTeacherWithdrawalTo] = useState("");
  const [disputeStatus, setDisputeStatus] = useState("open");
  const [reconciliationSummary, setReconciliationSummary] = useState<ReconciliationSummary | null>(null);
  const [funnelSummary, setFunnelSummary] = useState<FunnelSummary | null>(null);
  const [courseAccountingSummary, setCourseAccountingSummary] = useState<CourseAccountingSummary | null>(null);
  const [jobMonitoringSummary, setJobMonitoringSummary] = useState<JobMonitoringSummary | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 40;

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", String(limit));
    p.set("offset", String(offset));
    if (key === "ledger" && appliedUserId.trim()) p.set("userId", appliedUserId.trim());
    if (key === "reconciliation" && reconciliationStatus.trim()) p.set("status", reconciliationStatus.trim());
    if (key === "reconciliation" && reconciliationResolutionStatus.trim()) {
      p.set("resolutionStatus", reconciliationResolutionStatus.trim());
    }
    if (key === "teacher-campaigns" && teacherCampaignStatus.trim()) {
      p.set("status", teacherCampaignStatus.trim());
    }
    if (key === "teacher-withdrawals" && teacherWithdrawalStatus.trim()) {
      p.set("status", teacherWithdrawalStatus.trim());
    }
    if (key === "teacher-withdrawals" && teacherWithdrawalQ.trim()) p.set("q", teacherWithdrawalQ.trim());
    if (key === "teacher-withdrawals" && teacherWithdrawalFrom.trim()) p.set("from", teacherWithdrawalFrom.trim());
    if (key === "teacher-withdrawals" && teacherWithdrawalTo.trim()) p.set("to", teacherWithdrawalTo.trim());
    if (key === "disputes" && disputeStatus.trim()) p.set("status", disputeStatus.trim());
    return p.toString();
  }, [
    key,
    offset,
    appliedUserId,
    reconciliationStatus,
    reconciliationResolutionStatus,
    teacherCampaignStatus,
    teacherWithdrawalStatus,
    teacherWithdrawalQ,
    teacherWithdrawalFrom,
    teacherWithdrawalTo,
    disputeStatus,
  ]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const r = (await apiFetch(`${cfg.path}?${qs}`, { token })) as Record<string, unknown>;
      const arr = r[cfg.arrayKey];
      setRows(Array.isArray(arr) ? (arr as Record<string, unknown>[]) : []);
      setTotal(typeof r.total === "number" ? r.total : 0);
      setReconciliationSummary(key === "reconciliation" ? parseReconciliationSummary(r.summary) : null);
      setFunnelSummary(key === "funnel" ? (r as FunnelSummary) : null);
      setCourseAccountingSummary(key === "course-accounting" ? (r.summary as CourseAccountingSummary | null) : null);
      setJobMonitoringSummary(key === "job-monitoring" ? (r.summary as JobMonitoringSummary | null) : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [token, cfg, qs, key]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setOffset(0);
  }, [key]);

  if (!token) return null;

  async function markHomeworkQuality(id: string, qualityStatus: "accepted" | "revision_requested" | "flagged") {
    if (!token) return;
    setActionBusy(`${id}:${qualityStatus}`);
    setError(null);
    try {
      await apiFetch(`/api/admin/homework-quality/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          qualityStatus,
          qualityScore: qualityStatus === "accepted" ? 5 : null,
          note:
            qualityStatus === "accepted"
              ? "Admin kalite kontrolünden geçti."
              : qualityStatus === "revision_requested"
                ? "Admin revizyon istedi."
                : "Admin inceleme için işaretledi.",
        }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "aksiyon başarısız");
    } finally {
      setActionBusy(null);
    }
  }

  async function updateReconciliationResolution(
    id: string,
    resolutionStatus: "open" | "resolved" | "dismissed",
    resolutionKind?: "provider_retry" | "manual_adjustment" | "manual_refund" | "duplicate" | "not_actionable" | "other",
  ) {
    if (!token) return;
    const note =
      resolutionStatus === "open"
        ? "Admin yeniden incelemeye açtı."
        : window.prompt("Kısa çözüm notu girin:", resolutionStatus === "resolved" ? "İncelendi ve çözüldü." : "İncelendi, aksiyon gerekmiyor.");
    if (note === null) return;
    setActionBusy(`${id}:${resolutionStatus}`);
    setError(null);
    try {
      await apiFetch(`/api/admin/payment-reconciliation/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          resolutionStatus,
          resolutionKind: resolutionStatus === "open" ? null : (resolutionKind ?? "other"),
          note,
        }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "mutabakat aksiyonu başarısız");
    } finally {
      setActionBusy(null);
    }
  }

  async function updateTeacherCampaignStatus(
    id: string,
    status: "pending_review" | "published" | "rejected" | "paused" | "archived",
  ) {
    if (!token) return;
    const note =
      status === "published"
        ? "Admin onayladı."
        : status === "rejected"
          ? window.prompt("Red notu girin:", "Kampanya metni veya içerik politikası nedeniyle onaylanmadı.")
          : `Admin durumu ${status} olarak güncelledi.`;
    if (note === null) return;
    setActionBusy(`${id}:campaign:${status}`);
    setError(null);
    try {
      await apiFetch(`/api/admin/teacher-campaigns/${id}/status`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status, note }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "kampanya aksiyonu başarısız");
    } finally {
      setActionBusy(null);
    }
  }

  async function cancelCourseEnrollment(id: string, paymentStatus: unknown) {
    if (!token) return;
    const statusText = String(paymentStatus ?? "");
    const defaultReason =
      statusText === "wallet_charged" || statusText === "external_paid"
        ? "Admin kararıyla kurs kaydı iptal edildi; ücret öğrenci cüzdanına iade edildi."
        : "Admin kararıyla kurs kaydı iptal edildi.";
    const reason = window.prompt("İptal/iade notu girin:", defaultReason);
    if (reason === null) return;
    setActionBusy(`${id}:cancel`);
    setError(null);
    try {
      await apiFetch(`/api/admin/course-enrollments/${id}/cancel`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ reason }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "kurs kaydı iptal/iade edilemedi");
    } finally {
      setActionBusy(null);
    }
  }

  async function updateTeacherWithdrawalStatus(id: string, status: "paid" | "rejected") {
    if (!token) return;
    const note =
      status === "paid"
        ? window.prompt("Ödeme notu girin:", "Banka transferi tamamlandı.")
        : window.prompt("Red notu girin:", "IBAN veya hesap bilgisi doğrulanamadı.");
    if (note === null) return;
    const bankReceiptRef =
      status === "paid" ? window.prompt("Banka dekont / işlem referansı girin:", "Banka dekont no") : null;
    if (status === "paid" && !bankReceiptRef) return;
    setActionBusy(`${id}:withdrawal:${status}`);
    setError(null);
    try {
      await apiFetch(`/api/admin/teacher-withdrawals/${id}/status`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          status,
          note,
          bankReceiptRef: bankReceiptRef ?? undefined,
        }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "para çekme aksiyonu başarısız");
    } finally {
      setActionBusy(null);
    }
  }

  async function exportTeacherWithdrawals() {
    if (!token) return;
    setActionBusy("teacher-withdrawals:export");
    setError(null);
    try {
      const p = new URLSearchParams(qs);
      p.set("export", "bank_csv");
      const r = (await apiFetch(`/api/admin/teacher-withdrawals?${p.toString()}`, { token })) as {
        export?: { filename: string; csv: string };
      };
      if (!r.export) throw new Error("export_failed");
      const blob = new Blob([r.export.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.export.filename;
      a.click();
      URL.revokeObjectURL(url);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "export başarısız");
    } finally {
      setActionBusy(null);
    }
  }

  async function updateDisputeStatus(id: string, status: "waiting_user" | "resolved" | "rejected") {
    if (!token) return;
    const resolutionNote =
      status === "resolved" || status === "rejected"
        ? window.prompt("Çözüm notu girin:", status === "resolved" ? "Uyuşmazlık çözüldü." : "Talep uygun bulunmadı.")
        : window.prompt("Kullanıcıdan beklenen notu girin:", "Ek bilgi bekleniyor.");
    if (resolutionNote === null) return;
    setActionBusy(`${id}:dispute:${status}`);
    setError(null);
    try {
      await apiFetch(`/api/admin/disputes/${id}/status`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status, resolutionNote }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "dispute aksiyonu başarısız");
    } finally {
      setActionBusy(null);
    }
  }

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-paper-900">{cfg.title}</h1>
          <p className="flex flex-wrap gap-x-4 text-sm">
            <Link
              href="/admin/merkez"
              className="font-medium text-brand-800 underline decoration-brand-400 underline-offset-4"
            >
              Merkez
            </Link>
            <Link
              href="/admin"
              className="text-paper-800/75 underline decoration-paper-300 underline-offset-4 hover:text-paper-900"
            >
              Özet
            </Link>
          </p>
        </div>

        {key === "ledger" ? (
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <label className="text-sm">
              <span className="font-medium text-paper-800">userId (UUID)</span>
              <input
                className="mt-1 block rounded-xl border border-paper-200 px-3 py-2 font-mono text-xs"
                value={userIdFilter}
                onChange={(e) => setUserIdFilter(e.target.value)}
                placeholder="Filtre…"
              />
            </label>
            <button
              type="button"
              className="rounded-xl bg-brand-800 px-3 py-2 text-sm font-semibold text-white"
              onClick={() => {
                setAppliedUserId(userIdFilter.trim());
                setOffset(0);
              }}
            >
              Uygula
            </button>
          </div>
        ) : null}

        {key === "reconciliation" ? (
          <div className="mt-4 space-y-3">
            {reconciliationSummary ? (
              <div className="rounded-2xl border border-paper-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-paper-900">Mutabakat risk özeti</h2>
                    <p className="mt-1 text-xs text-paper-800/60">
                      Son 30 günde para güvenini etkileyen PayTR callback olayları.
                    </p>
                  </div>
                  <div className="text-xs text-paper-800/55">
                    Son risk:{" "}
                    {reconciliationSummary.latestIssueAt
                      ? new Date(reconciliationSummary.latestIssueAt).toLocaleString("tr-TR")
                      : "yok"}
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  {[
                    ["Açık risk", reconciliationSummary.openIssues, "", "Kapatılmamış olaylar"],
                    ["Tutar uyuşmazlığı", reconciliationSummary.amountMismatches30d, "amount_mismatch", "Bakiye/ödeme durdurulur"],
                    ["Bilinmeyen sipariş", reconciliationSummary.unknownMerchantOids30d, "unknown_merchant_oid", "PayTR kaydı eşleşmedi"],
                    ["Başarısız callback", reconciliationSummary.failed30d, "failed", "Ödeme başarısız döndü"],
                  ].map(([label, value, status, hint]) => (
                    <button
                      key={String(label)}
                      type="button"
                      onClick={() => {
                        setReconciliationStatus(String(status));
                        setReconciliationResolutionStatus("open");
                        setOffset(0);
                      }}
                      className={`rounded-xl border p-3 text-left transition hover:border-brand-200 ${
                        Number(value) > 0 ? "border-amber-200 bg-amber-50 text-amber-950" : "border-emerald-200 bg-emerald-50 text-emerald-900"
                      }`}
                    >
                      <div className="text-xs font-semibold uppercase tracking-wide">{label}</div>
                      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
                      <div className="mt-1 text-xs opacity-80">{hint}</div>
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {reconciliationSummary.byStatus.map((item) => (
                    <button
                      key={item.status}
                      type="button"
                      onClick={() => {
                        setReconciliationStatus(item.status);
                        setOffset(0);
                      }}
                      className="rounded-full border border-paper-200 bg-paper-50 px-3 py-1 text-xs font-medium text-paper-800 hover:border-brand-200 hover:bg-brand-50"
                    >
                      {item.status}/{item.resolution_status}: {item.count}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-end gap-2 rounded-xl border border-paper-200 bg-white p-4 shadow-sm">
              <label className="text-sm">
                <span className="font-medium text-paper-800">Mutabakat durumu</span>
                <select
                  className="mt-1 block rounded-xl border border-paper-200 px-3 py-2 text-sm"
                  value={reconciliationStatus}
                  onChange={(e) => {
                    setReconciliationStatus(e.target.value);
                    setOffset(0);
                  }}
                >
                  <option value="">Tümü</option>
                  <option value="amount_mismatch">amount_mismatch</option>
                  <option value="unknown_merchant_oid">unknown_merchant_oid</option>
                  <option value="failed">failed</option>
                  <option value="matched">matched</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="font-medium text-paper-800">Çözüm durumu</span>
                <select
                  className="mt-1 block rounded-xl border border-paper-200 px-3 py-2 text-sm"
                  value={reconciliationResolutionStatus}
                  onChange={(e) => {
                    setReconciliationResolutionStatus(e.target.value);
                    setOffset(0);
                  }}
                >
                  <option value="">Tümü</option>
                  <option value="open">open</option>
                  <option value="resolved">resolved</option>
                  <option value="dismissed">dismissed</option>
                </select>
              </label>
              <div className="max-w-xl text-xs leading-relaxed text-paper-800/60">
                PayTR callback olayları beklenen tutar, gelen tutar ve ödeme kaydıyla birlikte burada izlenir.
                Uyumsuz kayıtlar para güveni için öncelikli incelenmelidir.
              </div>
            </div>
          </div>
        ) : null}

        {key === "funnel" && funnelSummary ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-2xl border border-paper-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-paper-900">Funnel dönüşüm özeti</h2>
              <p className="mt-1 text-xs text-paper-800/60">Son {funnelSummary.days} gün için arama → profil → kısa liste → talep/ödeme hattı.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {funnelSummary.funnel.map((step) => (
                  <div key={step.eventName} className="rounded-xl border border-paper-200 bg-paper-50 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-paper-800/50">{step.eventName}</div>
                    <div className="mt-1 text-2xl font-semibold text-paper-950">{step.count}</div>
                    <div className="text-xs text-paper-800/60">
                      {step.conversionFromSearch == null ? "Dönüşüm yok" : `%${step.conversionFromSearch} aramadan`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-paper-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-paper-900">Operasyon sinyalleri</h2>
              <div className="mt-3 space-y-2 text-sm">
                <div className="rounded-xl bg-paper-50 p-3">
                  <div className="text-xs font-semibold text-paper-800/60">Aktif rate-limit bucket</div>
                  <div className="mt-1 text-xl font-semibold text-paper-950">
                    {funnelSummary.operations?.rateLimit?.activeBuckets ?? 0}
                  </div>
                </div>
                <div className="rounded-xl bg-paper-50 p-3">
                  <div className="text-xs font-semibold text-paper-800/60">Quota/risk eventleri</div>
                  <div className="mt-1 text-xs text-paper-800/70">
                    {(funnelSummary.operations?.quotaExceeded ?? []).length
                      ? (funnelSummary.operations?.quotaExceeded ?? []).map((item) => `${item.event_name}: ${item.count}`).join(", ")
                      : "Açık quota sinyali yok"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {key === "course-accounting" && courseAccountingSummary ? (
          <div className="mt-4 rounded-2xl border border-paper-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-paper-900">Kurs finans özeti</h2>
                <p className="mt-1 text-xs text-paper-800/60">
                  Brüt tahsilat, öğrenci iadeleri, öğretmen saatlik hakedişi ve platformda kalan net tutar.
                </p>
              </div>
              <Link href="/admin/courses" className="text-xs font-medium text-brand-800 underline decoration-brand-300 underline-offset-4">
                Kurs operasyonuna git
              </Link>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-5">
              {[
                ["Blokede", courseAccountingSummary.held_amount_minor, "Öğrenci bakiyesinde bekleyen"],
                ["Brüt tahsil", courseAccountingSummary.gross_collected_amount_minor, "Platforma gelen kurs ücreti"],
                ["İade", courseAccountingSummary.refunded_amount_minor, "Öğrenci cüzdanına dönen"],
                ["Öğretmen hakedişi", courseAccountingSummary.teacher_payout_amount_minor, "Komisyonsuz saatlik ödeme"],
                ["Net platform", courseAccountingSummary.net_platform_amount_minor, "Tahsil - iade - hakediş"],
              ].map(([label, value, hint]) => (
                <div key={String(label)} className="rounded-xl border border-paper-200 bg-paper-50 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-paper-800/50">{label}</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums text-paper-950">{minorToTl(value)} TL</div>
                  <div className="mt-1 text-xs text-paper-800/60">{hint}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {key === "teacher-campaigns" ? (
          <div className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-paper-200 bg-white p-4 shadow-sm">
            <label className="text-sm">
              <span className="font-medium text-paper-800">Kampanya durumu</span>
              <select
                className="mt-1 block rounded-xl border border-paper-200 px-3 py-2 text-sm"
                value={teacherCampaignStatus}
                onChange={(e) => {
                  setTeacherCampaignStatus(e.target.value);
                  setOffset(0);
                }}
              >
                <option value="pending_review">pending_review</option>
                <option value="published">published</option>
                <option value="rejected">rejected</option>
                <option value="paused">paused</option>
                <option value="archived">archived</option>
              </select>
            </label>
            <div className="max-w-xl text-xs leading-relaxed text-paper-800/60">
              Öğretmen kampanyaları public vitrine çıkmadan önce burada incelenir. Onaylanan kampanyalar
              `/kampanyalar` listesine düşer; reddedilenler öğretmen panelinde görünür ama public olmaz.
            </div>
          </div>
        ) : null}

        {key === "teacher-withdrawals" ? (
          <div className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-paper-200 bg-white p-4 shadow-sm">
            <label className="text-sm">
              <span className="font-medium text-paper-800">Talep durumu</span>
              <select
                className="mt-1 block rounded-xl border border-paper-200 px-3 py-2 text-sm"
                value={teacherWithdrawalStatus}
                onChange={(e) => {
                  setTeacherWithdrawalStatus(e.target.value);
                  setOffset(0);
                }}
              >
                <option value="">Tümü</option>
                <option value="pending">pending</option>
                <option value="paid">paid</option>
                <option value="rejected">rejected</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="font-medium text-paper-800">Arama</span>
              <input
                className="mt-1 block rounded-xl border border-paper-200 px-3 py-2 text-sm"
                value={teacherWithdrawalQ}
                onChange={(e) => {
                  setTeacherWithdrawalQ(e.target.value);
                  setOffset(0);
                }}
                placeholder="öğretmen, e-posta, hesap sahibi"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium text-paper-800">Başlangıç</span>
              <input
                type="date"
                className="mt-1 block rounded-xl border border-paper-200 px-3 py-2 text-sm"
                value={teacherWithdrawalFrom}
                onChange={(e) => {
                  setTeacherWithdrawalFrom(e.target.value);
                  setOffset(0);
                }}
              />
            </label>
            <label className="text-sm">
              <span className="font-medium text-paper-800">Bitiş</span>
              <input
                type="date"
                className="mt-1 block rounded-xl border border-paper-200 px-3 py-2 text-sm"
                value={teacherWithdrawalTo}
                onChange={(e) => {
                  setTeacherWithdrawalTo(e.target.value);
                  setOffset(0);
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => void exportTeacherWithdrawals()}
              disabled={actionBusy === "teacher-withdrawals:export"}
              className="rounded-xl bg-paper-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {actionBusy === "teacher-withdrawals:export" ? "Hazırlanıyor…" : "Banka CSV export"}
            </button>
            <div className="max-w-xl text-xs leading-relaxed text-paper-800/60">
              Öğretmen talep oluşturduğunda tutar cüzdandan ayrılır. Ödendi durumunda banka transferi tamamlanmış
              sayılır; reddedilirse tutar otomatik cüzdana geri döner.
            </div>
          </div>
        ) : null}

        {key === "job-monitoring" && jobMonitoringSummary ? (
          <div className="mt-4 rounded-2xl border border-paper-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-paper-900">Cron sağlık özeti</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className={`rounded-xl border p-3 ${Number(jobMonitoringSummary.openAlerts ?? 0) > 0 ? "border-red-200 bg-red-50 text-red-950" : "border-emerald-200 bg-emerald-50 text-emerald-950"}`}>
                <div className="text-xs font-semibold uppercase tracking-wide">Açık alarm</div>
                <div className="mt-1 text-2xl font-semibold">{jobMonitoringSummary.openAlerts ?? 0}</div>
              </div>
              <div className="rounded-xl border border-paper-200 bg-paper-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-paper-800/55">İzlenen job</div>
                <div className="mt-1 text-2xl font-semibold text-paper-950">{jobMonitoringSummary.total ?? 0}</div>
              </div>
            </div>
          </div>
        ) : null}

        {key === "disputes" ? (
          <div className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-paper-200 bg-white p-4 shadow-sm">
            <label className="text-sm">
              <span className="font-medium text-paper-800">Uyuşmazlık durumu</span>
              <select
                className="mt-1 block rounded-xl border border-paper-200 px-3 py-2 text-sm"
                value={disputeStatus}
                onChange={(e) => {
                  setDisputeStatus(e.target.value);
                  setOffset(0);
                }}
              >
                <option value="">Tümü</option>
                <option value="open">open</option>
                <option value="waiting_user">waiting_user</option>
                <option value="waiting_admin">waiting_admin</option>
                <option value="resolved">resolved</option>
                <option value="rejected">rejected</option>
              </select>
            </label>
            <div className="max-w-xl text-xs leading-relaxed text-paper-800/60">
              Öğrenci, veli, öğretmen ve admin uyuşmazlıkları tek kayıtlı merkezde takip edilir.
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        ) : null}

        <p className="mt-3 text-xs text-paper-800/55">
          Toplam {total} · gösterilen {rows.length} · offset {offset}
        </p>

        <div className="mt-4 overflow-x-auto rounded-xl border border-paper-200 bg-white shadow-sm">
          {loading ? (
            <p className="p-6 text-sm text-paper-800/55">Yükleniyor…</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-paper-800/55">Kayıt yok.</p>
          ) : (
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-paper-200 bg-paper-50 font-semibold text-paper-800/75">
                <tr>
                  {Object.keys(rows[0] ?? {}).map((col) => (
                    <th key={col} className="whitespace-nowrap px-2 py-2 font-mono">
                      {col}
                    </th>
                  ))}
                  {key === "homework" ||
                  key === "reconciliation" ||
                  key === "teacher-campaigns" ||
                  key === "teacher-withdrawals" ||
                  key === "disputes" ||
                  key === "enrollments" ? (
                    <th className="whitespace-nowrap px-2 py-2">Aksiyon</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-paper-100 last:border-0">
                    {Object.keys(rows[0] ?? {}).map((col) => (
                      <td key={col} className="max-w-[14rem] truncate px-2 py-1.5 font-mono text-paper-800">
                        {formatCell(row[col])}
                      </td>
                    ))}
                    {key === "homework" ? (
                      <td className="whitespace-nowrap px-2 py-1.5">
                        <div className="flex flex-wrap gap-1">
                          {(["accepted", "revision_requested", "flagged"] as const).map((status) => {
                            const id = typeof row.id === "string" ? row.id : "";
                            return (
                              <button
                                key={status}
                                type="button"
                                disabled={!id || actionBusy === `${id}:${status}`}
                                onClick={() => void markHomeworkQuality(id, status)}
                                className="rounded border border-paper-200 bg-white px-2 py-1 text-[11px] font-medium text-paper-900 disabled:opacity-40"
                              >
                                {actionBusy === `${id}:${status}` ? "…" : status}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    ) : null}
                    {key === "reconciliation" ? (
                      <td className="whitespace-nowrap px-2 py-1.5">
                        <div className="flex flex-wrap gap-1">
                          {(() => {
                            const id = typeof row.id === "string" ? row.id : "";
                            const status = typeof row.resolution_status === "string" ? row.resolution_status : "open";
                            const matched = row.status === "matched";
                            if (!id || matched) {
                              return <span className="text-[11px] text-paper-800/45">Aksiyon yok</span>;
                            }
                            if (status === "open") {
                              return (
                                <>
                                  <button
                                    type="button"
                                    disabled={actionBusy === `${id}:resolved`}
                                    onClick={() => void updateReconciliationResolution(id, "resolved", "other")}
                                    className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-900 disabled:opacity-40"
                                  >
                                    {actionBusy === `${id}:resolved` ? "…" : "Çözüldü"}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={actionBusy === `${id}:dismissed`}
                                    onClick={() => void updateReconciliationResolution(id, "dismissed", "not_actionable")}
                                    className="rounded border border-paper-200 bg-white px-2 py-1 text-[11px] font-medium text-paper-900 disabled:opacity-40"
                                  >
                                    {actionBusy === `${id}:dismissed` ? "…" : "Aksiyon yok"}
                                  </button>
                                </>
                              );
                            }
                            return (
                              <button
                                type="button"
                                disabled={actionBusy === `${id}:open`}
                                onClick={() => void updateReconciliationResolution(id, "open")}
                                className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-900 disabled:opacity-40"
                              >
                                {actionBusy === `${id}:open` ? "…" : "Tekrar aç"}
                              </button>
                            );
                          })()}
                        </div>
                      </td>
                    ) : null}
                    {key === "teacher-campaigns" ? (
                      <td className="whitespace-nowrap px-2 py-1.5">
                        <div className="flex flex-wrap gap-1">
                          {(() => {
                            const id = typeof row.id === "string" ? row.id : "";
                            const status = typeof row.status === "string" ? row.status : "";
                            if (!id) return <span className="text-[11px] text-paper-800/45">Aksiyon yok</span>;
                            return (
                              <>
                                {status !== "published" ? (
                                  <button
                                    type="button"
                                    disabled={actionBusy === `${id}:campaign:published`}
                                    onClick={() => void updateTeacherCampaignStatus(id, "published")}
                                    className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-900 disabled:opacity-40"
                                  >
                                    {actionBusy === `${id}:campaign:published` ? "…" : "Onayla"}
                                  </button>
                                ) : null}
                                {status !== "rejected" ? (
                                  <button
                                    type="button"
                                    disabled={actionBusy === `${id}:campaign:rejected`}
                                    onClick={() => void updateTeacherCampaignStatus(id, "rejected")}
                                    className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-900 disabled:opacity-40"
                                  >
                                    {actionBusy === `${id}:campaign:rejected` ? "…" : "Reddet"}
                                  </button>
                                ) : null}
                                {status === "published" ? (
                                  <button
                                    type="button"
                                    disabled={actionBusy === `${id}:campaign:paused`}
                                    onClick={() => void updateTeacherCampaignStatus(id, "paused")}
                                    className="rounded border border-paper-200 bg-white px-2 py-1 text-[11px] font-medium text-paper-900 disabled:opacity-40"
                                  >
                                    {actionBusy === `${id}:campaign:paused` ? "…" : "Duraklat"}
                                  </button>
                                ) : null}
                              </>
                            );
                          })()}
                        </div>
                      </td>
                    ) : null}
                    {key === "teacher-withdrawals" ? (
                      <td className="whitespace-nowrap px-2 py-1.5">
                        <div className="flex flex-wrap gap-1">
                          {(() => {
                            const id = typeof row.id === "string" ? row.id : "";
                            const status = typeof row.status === "string" ? row.status : "";
                            if (!id || status !== "pending") {
                              return <span className="text-[11px] text-paper-800/45">Aksiyon yok</span>;
                            }
                            return (
                              <>
                                <button
                                  type="button"
                                  disabled={actionBusy === `${id}:withdrawal:paid`}
                                  onClick={() => void updateTeacherWithdrawalStatus(id, "paid")}
                                  className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-900 disabled:opacity-40"
                                >
                                  {actionBusy === `${id}:withdrawal:paid` ? "…" : "Ödendi"}
                                </button>
                                <button
                                  type="button"
                                  disabled={actionBusy === `${id}:withdrawal:rejected`}
                                  onClick={() => void updateTeacherWithdrawalStatus(id, "rejected")}
                                  className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-900 disabled:opacity-40"
                                >
                                  {actionBusy === `${id}:withdrawal:rejected` ? "…" : "Reddet"}
                                </button>
                              </>
                            );
                          })()}
                        </div>
                      </td>
                    ) : null}
                    {key === "disputes" ? (
                      <td className="whitespace-nowrap px-2 py-1.5">
                        <div className="flex flex-wrap gap-1">
                          {(() => {
                            const id = typeof row.id === "string" ? row.id : "";
                            const status = typeof row.status === "string" ? row.status : "";
                            if (!id || status === "resolved" || status === "rejected") {
                              return <span className="text-[11px] text-paper-800/45">Aksiyon yok</span>;
                            }
                            return (
                              <>
                                <button
                                  type="button"
                                  disabled={actionBusy === `${id}:dispute:waiting_user`}
                                  onClick={() => void updateDisputeStatus(id, "waiting_user")}
                                  className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-900 disabled:opacity-40"
                                >
                                  Bilgi iste
                                </button>
                                <button
                                  type="button"
                                  disabled={actionBusy === `${id}:dispute:resolved`}
                                  onClick={() => void updateDisputeStatus(id, "resolved")}
                                  className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-900 disabled:opacity-40"
                                >
                                  Çöz
                                </button>
                                <button
                                  type="button"
                                  disabled={actionBusy === `${id}:dispute:rejected`}
                                  onClick={() => void updateDisputeStatus(id, "rejected")}
                                  className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-900 disabled:opacity-40"
                                >
                                  Reddet
                                </button>
                              </>
                            );
                          })()}
                        </div>
                      </td>
                    ) : null}
                    {key === "enrollments" ? (
                      <td className="whitespace-nowrap px-2 py-1.5">
                        {(() => {
                          const id = typeof row.id === "string" ? row.id : "";
                          const paymentStatus = typeof row.payment_status === "string" ? row.payment_status : "";
                          const finalized = paymentStatus === "cancelled" || paymentStatus === "refunded";
                          if (!id || finalized) {
                            return <span className="text-[11px] text-paper-800/45">Tamamlandı</span>;
                          }
                          return (
                            <button
                              type="button"
                              disabled={actionBusy === `${id}:cancel`}
                              onClick={() => void cancelCourseEnrollment(id, paymentStatus)}
                              className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-950 disabled:opacity-40"
                            >
                              {actionBusy === `${id}:cancel` ? "…" : "İptal/iade"}
                            </button>
                          );
                        })()}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <nav className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm" aria-label="Sayfalama">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - limit))}
            className="font-medium text-brand-800 underline decoration-brand-400 underline-offset-4 disabled:cursor-not-allowed disabled:opacity-30 disabled:no-underline"
          >
            ← Önceki
          </button>
          <button
            type="button"
            disabled={offset + limit >= total}
            onClick={() => setOffset((o) => o + limit)}
            className="text-paper-800/75 underline decoration-paper-300 underline-offset-4 disabled:cursor-not-allowed disabled:opacity-30 disabled:no-underline"
          >
            Sonraki →
          </button>
        </nav>
      </div>
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v).slice(0, 80);
  return String(v);
}

function minorToTl(v: unknown): string {
  const n = typeof v === "string" || typeof v === "number" ? Number(v) : 0;
  return (Number.isFinite(n) ? n / 100 : 0).toFixed(2);
}

function parseReconciliationSummary(v: unknown): ReconciliationSummary | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const byStatus = Array.isArray(r.byStatus)
    ? r.byStatus
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const row = item as Record<string, unknown>;
          return {
            status: typeof row.status === "string" ? row.status : "unknown",
            count: typeof row.count === "number" ? row.count : Number(row.count ?? 0),
            resolution_status: typeof row.resolution_status === "string" ? row.resolution_status : "open",
            latest_at: typeof row.latest_at === "string" ? row.latest_at : null,
          };
        })
        .filter((item): item is ReconciliationSummary["byStatus"][number] => item !== null)
    : [];
  return {
    byStatus,
    openIssues: typeof r.openIssues === "number" ? r.openIssues : Number(r.openIssues ?? 0),
    issues30d: typeof r.issues30d === "number" ? r.issues30d : Number(r.issues30d ?? 0),
    amountMismatches30d:
      typeof r.amountMismatches30d === "number" ? r.amountMismatches30d : Number(r.amountMismatches30d ?? 0),
    unknownMerchantOids30d:
      typeof r.unknownMerchantOids30d === "number" ? r.unknownMerchantOids30d : Number(r.unknownMerchantOids30d ?? 0),
    failed30d: typeof r.failed30d === "number" ? r.failed30d : Number(r.failed30d ?? 0),
    latestIssueAt: typeof r.latestIssueAt === "string" ? r.latestIssueAt : null,
  };
}
