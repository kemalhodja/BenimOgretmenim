"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useRequireAdmin } from "../useRequireAdmin";

type Item = { href: string; title: string; desc: string };
type Overview = {
  counts: {
    openDemoRequests: number;
    unansweredDemoRequests: number;
    pendingTeacherVerification: number;
    weakTeacherProfiles: number;
    pendingBankPayments: number;
    pendingSubscriptionPayments: number;
    parentNotificationsUnread: number;
    homeworkPostsActive: number;
    homeworkQualityQueue: number;
    openSupportThreads: number;
    classroomNoteCount: number;
    classroomRecordingCount: number;
    classroomMessageCount: number;
    activeStudyPlans: number;
    recentAssessmentAttempts: number;
    guardianInvitesActive: number;
    guardianInvitesAccepted: number;
    guardianInvitesExpired: number;
    homeworkSlaBreaches: number;
    supportSlaBreaches: number;
    teacherQualityAvg: number;
    reconciliationIssues30d: number;
    completedLessons30d: number;
  };
};
type HealthStatus = "ok" | "degraded" | "down";
type SystemHealthCheck = {
  name: string;
  status: HealthStatus;
  latencyMs?: number;
  message?: string;
  metadata?: Record<string, unknown>;
};
type SystemHealth = {
  status: HealthStatus;
  generatedAt: string;
  runtime: {
    nodeEnv: string;
    nodeVersion: string;
    uptimeSeconds: number;
    memory: {
      rssMb: number;
      heapUsedMb: number;
      heapTotalMb: number;
    };
  };
  checks: SystemHealthCheck[];
};
type WeeklyQualityReport = {
  generatedAt: string;
  warnings?: {
    missingTables?: string[];
    partial?: boolean;
  };
  revenue: {
    teacherSubscriptionsMinor: number;
    studentSubscriptionsMinor: number;
    walletTopupsMinor: number;
  };
  seo: {
    activeCityBranchTeacherCombos: number;
  };
  operations: {
    openPaymentRisks: number;
    pendingCampaignModeration: number;
    supportSlaBreaches: number;
  };
};

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: "Özet ve kimlik",
    items: [
      { href: "/admin", title: "Özet", desc: "Canlı metrikler" },
      { href: "/admin/users", title: "Kullanıcılar", desc: "Arama, rol, rol güncelleme" },
      { href: "/admin/teachers", title: "Öğretmenler", desc: "Doğrulama durumu yönetimi" },
      { href: "/admin/support", title: "Canlı destek", desc: "Kullanıcı mesajları ve yanıt" },
    ],
  },
  {
    title: "Finans ve abonelik",
    items: [
      { href: "/admin/bank", title: "Havale onayı", desc: "Öğretmen aboneliği banka ödemeleri" },
      { href: "/admin/payments", title: "Abonelik ödemeleri", desc: "Tüm subscription_payments" },
      { href: "/admin/wallet", title: "Cüzdan grant", desc: "Manuel bakiye ekleme" },
      { href: "/admin/veri?k=ledger", title: "Cüzdan defteri", desc: "Tüm ledger satırları" },
      { href: "/admin/veri?k=wallet-topups", title: "Cüzdan PayTR yüklemeleri", desc: "wallet_topup_payments" },
      { href: "/admin/veri?k=teacher-withdrawals", title: "Öğretmen para çekme", desc: "IBAN talepleri, ödeme/red operasyonu" },
      { href: "/admin/veri?k=course-accounting", title: "Kurs muhasebesi", desc: "Tahsilat, iade, hakediş, net platform" },
      { href: "/admin/veri?k=reconciliation", title: "Ödeme mutabakatı", desc: "PayTR callback uyumsuzlukları" },
      { href: "/admin/veri?k=student-sub-payments", title: "Öğrenci platform ödemeleri", desc: "student_sub_payments" },
    ],
  },
  {
    title: "İçerik ve ders",
    items: [
      { href: "/admin/courses", title: "Kurslar", desc: "Durum yönetimi (taslak / yayın / arşiv)" },
      { href: "/admin/veri?k=enrollments", title: "Kurs kayıtları", desc: "course_enrollments" },
      { href: "/admin/requests", title: "Ders talepleri", desc: "Liste ve iptal (uygun durumlarda)" },
      { href: "/admin/veri?k=packages", title: "Ders paketleri", desc: "lesson_packages" },
      { href: "/admin/direct-bookings", title: "Doğrudan ders anlaşmaları", desc: "Liste ve iptal" },
      { href: "/admin/group-lessons", title: "Grup ders talepleri", desc: "Durum ve iptal" },
      { href: "/admin/homework", title: "Ödev / soru havuzu", desc: "Liste ve iptal" },
      { href: "/admin/veri?k=homework", title: "Soru kalite kuyruğu", desc: "Cevap kalite / revizyon takibi" },
      { href: "/admin/veri?k=classroom", title: "Canlı sınıf notları", desc: "Tahta ve ders içi not kayıtları" },
      { href: "/admin/veri?k=recordings", title: "Sınıf kayıtları", desc: "Tekrar izleme linkleri ve kayıt durumu" },
      { href: "/admin/veri?k=messages", title: "Sınıf mesajları", desc: "Sohbet, soru, cevap ve duyurular" },
      { href: "/admin/veri?k=learning", title: "Çalışma ve deneme", desc: "Planlar ve assessment kayıtları" },
      { href: "/admin/veri?k=funnel", title: "Funnel raporu", desc: "Dönüşüm ve operasyon sinyalleri" },
    ],
  },
  {
    title: "Abonelik ve bildirim",
    items: [
      { href: "/admin/veri?k=teacher-subs", title: "Öğretmen abonelikleri", desc: "teacher_subscriptions" },
      { href: "/admin/veri?k=notifications", title: "Veli bildirimleri", desc: "parent_notifications" },
      { href: "/admin/veri?k=guardian-invites", title: "Veli davet kodları", desc: "Aktif, kullanılan ve süresi dolan kodlar" },
    ],
  },
];

function healthLabel(status: HealthStatus): string {
  if (status === "ok") return "Sağlıklı";
  if (status === "degraded") return "Uyarı var";
  return "Kritik";
}

function healthClass(status: HealthStatus): string {
  if (status === "ok") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "degraded") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-red-200 bg-red-50 text-red-800";
}

function uptimeLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}dk`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}s`;
  return `${Math.floor(hours / 24)}g`;
}

function checkHint(check: SystemHealthCheck): string {
  const metadata = check.metadata ?? {};
  if (check.message) return check.message;
  if (check.name === "database") {
    const db = typeof metadata.database_name === "string" ? metadata.database_name : "database";
    const version = typeof metadata.server_version === "string" ? metadata.server_version : "";
    return [db, version ? `PostgreSQL ${version}` : "", check.latencyMs != null ? `${check.latencyMs}ms` : ""]
      .filter(Boolean)
      .join(" · ");
  }
  if (check.name === "migrations") {
    const count = typeof metadata.applied_count === "number" ? metadata.applied_count : "-";
    const latest = typeof metadata.latest_migration === "string" ? metadata.latest_migration : "yok";
    return `Uygulanan: ${count} · Son: ${latest}`;
  }
  if (check.name === "configuration") {
    const warnings = Array.isArray(metadata.warnings) ? metadata.warnings : [];
    return warnings.length ? `${warnings.length} konfigürasyon uyarısı` : "Zorunlu kontroller temiz";
  }
  return "Kontrol tamamlandı";
}

function riskTone(value: number): string {
  if (value >= 5) return "border-red-200 bg-red-50 text-red-900";
  if (value > 0) return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-emerald-200 bg-emerald-50 text-emerald-900";
}

function readinessClass(status: "ready" | "watch" | "action"): string {
  if (status === "ready") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "watch") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-red-200 bg-red-50 text-red-900";
}

export default function AdminMerkezPage() {
  const token = useRequireAdmin();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyQualityReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [weeklyReportError, setWeeklyReportError] = useState<string | null>(null);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderResult, setReminderResult] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    apiFetch<Overview>("/api/admin/overview", { token })
      .then((r) => {
        if (!cancelled) setOverview(r);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "overview_failed");
      });
    apiFetch<SystemHealth>("/api/admin/system-health", { token })
      .then((r) => {
        if (!cancelled) setSystemHealth(r);
      })
      .catch((e) => {
        if (!cancelled) setHealthError(e instanceof Error ? e.message : "system_health_failed");
      });
    apiFetch<WeeklyQualityReport>("/api/admin/quality-weekly-report", { token })
      .then((r) => {
        if (!cancelled) {
          setWeeklyReport(r);
          setWeeklyReportError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setWeeklyReportError(e instanceof Error ? e.message : "weekly_report_failed");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token) return null;

  const c = overview?.counts;
  const opsPriority =
    c == null
      ? []
      : [
          {
            title: "Ödev SLA",
            value: c.homeworkSlaBreaches,
            href: "/admin/homework",
            action: c.homeworkSlaBreaches > 0 ? "Geciken soruları öğretmen/havuz durumuna göre çöz" : "SLA temiz",
          },
          {
            title: "Destek SLA",
            value: c.supportSlaBreaches,
            href: "/admin/support",
            action: c.supportSlaBreaches > 0 ? "24 saati aşan destek konularını kapat" : "Destek ritmi temiz",
          },
          {
            title: "Ödeme mutabakatı",
            value: c.reconciliationIssues30d,
            href: "/admin/veri?k=reconciliation",
            action: c.reconciliationIssues30d > 0 ? "PayTR ve cüzdan kayıtlarını karşılaştır" : "Son 30 gün temiz",
          },
          {
            title: "Öğretmen kalite",
            value: Math.max(0, 70 - c.teacherQualityAvg),
            href: "/admin/teachers",
            action: c.teacherQualityAvg < 70 ? "Zayıf profilleri doğrulama ve içerik tamamlama akışına al" : "Kalite ortalaması iyi",
          },
        ];
  const readinessChecks =
    c == null
      ? []
      : [
          {
            title: "Sistem",
            status: systemHealth?.status === "ok" ? "ready" : systemHealth ? "action" : "watch",
            value: systemHealth ? healthLabel(systemHealth.status) : "Yükleniyor",
            action: systemHealth?.status === "ok" ? "Runtime ve DB kontrolleri temiz" : "Sistem sağlığı detayını incele",
          },
          {
            title: "SLA",
            status: c.homeworkSlaBreaches + c.supportSlaBreaches === 0 ? "ready" : "action",
            value: `${c.homeworkSlaBreaches + c.supportSlaBreaches} risk`,
            action:
              c.homeworkSlaBreaches + c.supportSlaBreaches === 0
                ? "Ödev ve destek SLA temiz"
                : "Geciken ödev/destek işlerini kapat",
          },
          {
            title: "Ödeme",
            status: c.reconciliationIssues30d === 0 ? "ready" : "action",
            value: `${c.reconciliationIssues30d} uyumsuzluk`,
            action: c.reconciliationIssues30d === 0 ? "PayTR mutabakatı temiz" : "Mutabakat kayıtlarını kontrol et",
          },
          {
            title: "Öğretmen kalite",
            status: c.teacherQualityAvg >= 75 ? "ready" : c.teacherQualityAvg >= 60 ? "watch" : "action",
            value: `${c.teacherQualityAvg}/100`,
            action:
              c.teacherQualityAvg >= 75
                ? "Vitrin kalitesi iyi"
                : "Doğrulama ve profil tamamlama kuyruğunu büyüt",
          },
        ] as const;
  const readinessActionCount = readinessChecks.filter((item) => item.status === "action").length;

  async function runReminders() {
    if (!token) return;
    setReminderBusy(true);
    setReminderResult(null);
    setError(null);
    try {
      const r = (await apiFetch("/api/admin/reminders/run", {
        method: "POST",
        token,
      })) as { result?: { created?: number } };
      setReminderResult(`${r.result?.created ?? 0} yeni ders hatırlatması üretildi.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "reminders_failed");
    } finally {
      setReminderBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link
          href="/admin"
          className="text-sm font-medium text-brand-800 underline decoration-brand-400 underline-offset-4"
        >
          ← Özet
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-paper-900">Kontrol merkezi</h1>
        <p className="mt-2 text-sm text-paper-800/75">
          Tüm yönetim modülleri ve veri görünümleri. İşlemler API üzerinden audit edilir; üretimde{" "}
          <span className="font-mono">ADMIN_API_SECRET</span> önerilir.
        </p>

        {error ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Operasyon özeti yüklenemedi: {error}
          </div>
        ) : null}

        {healthError ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Sistem sağlığı yüklenemedi: {healthError}
          </div>
        ) : null}

        {systemHealth ? (
          <section className="mt-6 rounded-xl border border-paper-200 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-paper-900">Sistem sağlığı</h2>
                <p className="mt-1 text-xs text-paper-800/55">
                  DB, migration, runtime ve konfigürasyon kontrolleri. Son kontrol:{" "}
                  {new Date(systemHealth.generatedAt).toLocaleString("tr-TR")}
                </p>
              </div>
              <span
                className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${healthClass(systemHealth.status)}`}
              >
                {healthLabel(systemHealth.status)}
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-paper-200 bg-paper-50 p-3">
                <div className="text-xs text-paper-800/55">Runtime</div>
                <div className="mt-1 text-sm font-semibold text-paper-900">
                  {systemHealth.runtime.nodeEnv} · {systemHealth.runtime.nodeVersion}
                </div>
                <div className="mt-1 text-xs text-paper-800/55">
                  Uptime {uptimeLabel(systemHealth.runtime.uptimeSeconds)}
                </div>
              </div>
              <div className="rounded-xl border border-paper-200 bg-paper-50 p-3">
                <div className="text-xs text-paper-800/55">Bellek</div>
                <div className="mt-1 text-sm font-semibold text-paper-900">
                  RSS {systemHealth.runtime.memory.rssMb} MB
                </div>
                <div className="mt-1 text-xs text-paper-800/55">
                  Heap {systemHealth.runtime.memory.heapUsedMb}/{systemHealth.runtime.memory.heapTotalMb} MB
                </div>
              </div>
              <div className="rounded-xl border border-paper-200 bg-paper-50 p-3">
                <div className="text-xs text-paper-800/55">Kontrol sayısı</div>
                <div className="mt-1 text-sm font-semibold text-paper-900">{systemHealth.checks.length} sinyal</div>
                <div className="mt-1 text-xs text-paper-800/55">Admin-only görünürlük</div>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {systemHealth.checks.map((check) => (
                <div key={check.name} className={`rounded-xl border p-3 ${healthClass(check.status)}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold uppercase tracking-wide">{check.name}</div>
                    <div className="text-[11px] font-semibold">{healthLabel(check.status)}</div>
                  </div>
                  <p className="mt-1 text-xs opacity-80">{checkHint(check)}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {c ? (
          <section className="mt-6 rounded-2xl border border-paper-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-paper-800/55">
                  Canlı operasyon durumu
                </div>
                <h2 className="mt-2 text-lg font-semibold text-paper-900">
                  {readinessActionCount === 0 ? "Platform canlı akış için hazır" : `${readinessActionCount} kritik aksiyon bekliyor`}
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-paper-800/70">
                  Sistem sağlığı, SLA, ödeme mutabakatı ve öğretmen kalite sinyalleri tek go/no-go özetinde izlenir.
                </p>
              </div>
              <Link
                href="/admin/veri?k=reconciliation"
                className="w-fit rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-900 hover:bg-brand-100"
              >
                Mutabakatı aç
              </Link>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {readinessChecks.map((item) => (
                <div key={item.title} className={`rounded-xl border p-3 ${readinessClass(item.status)}`}>
                  <div className="text-xs font-semibold uppercase tracking-wide">{item.title}</div>
                  <div className="mt-1 text-lg font-semibold">{item.value}</div>
                  <p className="mt-1 text-xs opacity-80">{item.action}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {weeklyReportError ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Haftalık ürün kalite raporu hazırlanamadı: {weeklyReportError}
          </div>
        ) : null}

        {weeklyReport ? (
          <section className="mt-6 rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-800/70">
                  Haftalık ürün kalite raporu
                </div>
                <h2 className="mt-1 text-lg font-semibold text-paper-900">Dönüşüm, gelir, SEO ve açık riskler</h2>
                <p className="mt-1 text-xs text-paper-800/55">
                  Üretim zamanı: {new Date(weeklyReport.generatedAt).toLocaleString("tr-TR")}
                </p>
              </div>
              <Link href="/admin/veri?k=funnel" className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-900">
                Funnel detayları
              </Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              {[
                ["Gelir sinyali", `${Math.round((weeklyReport.revenue.teacherSubscriptionsMinor + weeklyReport.revenue.studentSubscriptionsMinor + weeklyReport.revenue.walletTopupsMinor) / 100)} TL`],
                ["SEO landing gücü", weeklyReport.seo.activeCityBranchTeacherCombos],
                ["Açık ödeme riski", weeklyReport.operations.openPaymentRisks],
                ["Bekleyen moderasyon", weeklyReport.operations.pendingCampaignModeration],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl border border-paper-200 bg-paper-50 p-3">
                  <div className="text-xs font-semibold text-paper-800/55">{label}</div>
                  <div className="mt-1 text-xl font-semibold text-paper-950">{value}</div>
                </div>
              ))}
            </div>
            {weeklyReport.warnings?.partial ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                Rapor kısmi veriyle hazırlandı. Eksik kaynaklar:{" "}
                {(weeklyReport.warnings.missingTables ?? []).join(", ") || "bilinmiyor"}.
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="mt-6 rounded-xl border border-paper-200 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-paper-900">Otomatik ders hatırlatmaları</h2>
              <p className="mt-1 text-xs text-paper-800/55">
                Yaklaşan birebir ve kurs dersleri için 24 saat / 2 saat kala bildirim üretir.
              </p>
            </div>
            <button
              type="button"
              disabled={reminderBusy}
              onClick={() => void runReminders()}
              className="rounded-xl bg-brand-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {reminderBusy ? "Çalışıyor…" : "Hatırlatmaları üret"}
            </button>
          </div>
          {reminderResult ? <p className="mt-3 text-xs font-medium text-brand-800">{reminderResult}</p> : null}
        </section>

        {c ? (
          <section className="mt-8 rounded-2xl border border-brand-200 bg-[linear-gradient(135deg,#ecfeff_0%,#ffffff_58%,#fff7ed_100%)] p-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-800/70">
                  Kurum paneli
                </div>
                <h2 className="mt-2 text-lg font-semibold text-paper-900">
                  SLA, öğretmen performansı ve finans takibi
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-paper-800/70">
                  Geciken işler, ders hacmi, öğretmen kalitesi ve ödeme uyumsuzlukları tek yerde izlenir.
                </p>
              </div>
              <Link
                href="/admin/veri?k=ledger"
                className="w-fit rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900"
              >
                Finans defteri
              </Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                ["Ödev SLA ihlali", c.homeworkSlaBreaches, "Açık/üstlenilmiş geciken soru", "/admin/homework"],
                ["Destek SLA riski", c.supportSlaBreaches, "24 saati aşan açık destek", "/admin/support"],
                ["Öğretmen kalite", `${c.teacherQualityAvg}/100`, "Profil kalite ortalaması", "/admin/teachers"],
                ["Ödeme uyumu", c.reconciliationIssues30d, "30g PayTR uyumsuzluğu", "/admin/veri?k=reconciliation"],
                ["Ders hacmi", c.completedLessons30d, "30g tamamlanan ders", "/admin/veri?k=packages"],
              ].map(([label, value, hint, href]) => (
                <Link
                  key={String(label)}
                  href={String(href)}
                  className="rounded-xl border border-paper-200 bg-white/80 p-4 transition hover:border-brand-200 hover:bg-white"
                >
                  <div className="text-xs font-medium uppercase tracking-wide text-paper-800/55">{label}</div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums text-paper-900">{value}</div>
                  <div className="mt-1 text-xs text-paper-800/55">{hint}</div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {c ? (
          <section className="mt-6 rounded-2xl border border-paper-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-paper-800/55">
                  Bugünün operasyon önceliği
                </div>
                <h2 className="mt-2 text-lg font-semibold text-paper-900">
                  Önce güveni etkileyen kuyruğu kapat
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-paper-800/70">
                  SLA gecikmesi, destek beklemesi, ödeme uyumsuzluğu ve düşük öğretmen kalitesi platform güvenini doğrudan etkiler.
                </p>
              </div>
              <div className="rounded-xl border border-paper-200 bg-paper-50 px-4 py-3 text-sm">
                <div className="text-xs text-paper-800/55">30 gün ders hacmi</div>
                <div className="mt-1 text-xl font-semibold text-paper-900">{c.completedLessons30d}</div>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {opsPriority.map((item) => (
                <Link key={item.title} href={item.href} className={`rounded-xl border p-3 ${riskTone(item.value)}`}>
                  <div className="text-xs font-semibold uppercase tracking-wide">{item.title}</div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums">{item.value}</div>
                  <p className="mt-1 text-xs opacity-80">{item.action}</p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {c ? (
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-paper-800/55">
              Kritik operasyon kuyruğu
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Açık demo", c.openDemoRequests, "Yanıtsız: " + c.unansweredDemoRequests, "/admin/requests"],
                ["Doğrulama", c.pendingTeacherVerification, "Öğretmen bekliyor", "/admin/teachers"],
                ["Zayıf profil", c.weakTeacherProfiles, "Kalite skoru 40 altı", "/admin/teachers"],
                ["Ödeme bekliyor", c.pendingBankPayments + c.pendingSubscriptionPayments, "Havale + abonelik", "/admin/payments"],
                ["Okunmamış bildirim", c.parentNotificationsUnread, "Veli/öğrenci in-app", "/admin/veri?k=notifications"],
                ["Açık ödev", c.homeworkPostsActive, "Ödev/soru operasyonu", "/admin/homework"],
                ["Kalite kuyruğu", c.homeworkQualityQueue, "Cevap revizyonları", "/admin/veri?k=homework"],
                ["Açık destek", c.openSupportThreads, "SLA takibi", "/admin/support"],
                ["Sınıf notu", c.classroomNoteCount, "Tahta kayıtları", "/admin/veri?k=classroom"],
                ["Sınıf kaydı", c.classroomRecordingCount, "Tekrar izleme arşivi", "/admin/veri?k=recordings"],
                ["Sınıf mesajı", c.classroomMessageCount, "Soru/cevap akışı", "/admin/veri?k=messages"],
                ["Çalışma planı", c.activeStudyPlans, `7g deneme: ${c.recentAssessmentAttempts}`, "/admin/veri?k=learning"],
                [
                  "Veli daveti",
                  c.guardianInvitesActive,
                  `Kabul: ${c.guardianInvitesAccepted} · Süresi dolan: ${c.guardianInvitesExpired}`,
                  "/admin/veri?k=guardian-invites",
                ],
              ].map(([label, value, hint, href]) => (
                <Link
                  key={String(label)}
                  href={String(href)}
                  className="rounded-xl border border-paper-200 bg-white p-4 transition hover:border-brand-200 hover:bg-paper-50"
                >
                  <div className="text-xs font-medium uppercase tracking-wide text-paper-800/55">{label}</div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums text-paper-900">{value}</div>
                  <div className="mt-1 text-xs text-paper-800/55">{hint}</div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <div className="mt-8 space-y-10">
          {SECTIONS.map((sec) => (
            <section key={sec.title}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-paper-800/55">{sec.title}</h2>
              <ul className="mt-3 divide-y divide-paper-200 rounded-xl border border-paper-200 bg-white">
                {sec.items.map((it) => (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      className="flex flex-col gap-0.5 px-4 py-3 transition hover:bg-paper-50 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="font-medium text-brand-900">{it.title}</span>
                      <span className="text-sm text-paper-800/55">{it.desc}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
