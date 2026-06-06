"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useRequireAdmin } from "../useRequireAdmin";

type Branch = { id: number; parent_id: number | null; name: string; slug: string };

type CourseRow = {
  id: string;
  title: string;
  status: string;
  price_minor: number;
  currency: string;
  created_at: string;
  delivery_mode: string;
  teacher_display_name: string;
  teacher_email: string | null;
  teacher_id: string | null;
  origin: string;
  teacher_hourly_rate_minor: number | null;
  application_status: string;
  teacher_application_count: number;
  student_application_count: number;
  student_application_pending_count: number;
  student_application_approved_count: number;
  student_application_rejected_count: number;
  enrollment_count: number;
  wallet_held_count: number;
  wallet_held_amount_minor: number | string;
  wallet_charged_count: number;
  wallet_charged_amount_minor: number | string;
  refunded_count: number;
  refunded_amount_minor: number | string;
  teacher_payout_count: number;
  teacher_payout_amount_minor: number | string;
};

type CourseApplications = {
  teacherApplications: Array<{
    id: string;
    status: string;
    message: string | null;
    experience_note: string | null;
    teacher_display_name: string;
    teacher_email: string;
    verification_status: string;
  }>;
  studentApplications: Array<{
    id: string;
    status: string;
    goal_note: string | null;
    guardian_note: string | null;
    student_display_name: string;
    student_email: string;
    cohort_title: string | null;
    enrollment_id: string | null;
    enrollment_price_minor: number | null;
    enrollment_currency: string | null;
    enrollment_payment_status: string | null;
    enrollment_charged_at: string | null;
    wallet_hold_status: string | null;
    wallet_hold_amount_minor: number | null;
    wallet_balance_minor: number | string;
    wallet_active_hold_minor: number | string;
    wallet_available_minor: number | string;
  }>;
};

function minorToTl(n: number | null | undefined): string {
  if (n == null) return "—";
  return (n / 100).toFixed(2);
}

function minorValue(n: number | string | null | undefined): number {
  if (n == null) return 0;
  return Number(n) || 0;
}

function datetimeLocalToIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const dt = new Date(trimmed);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

function tlToMinor(value: string): number {
  return Math.max(0, Math.round(Number(value.replace(",", ".") || "0") * 100));
}

function localLabel(value: string): string {
  const iso = datetimeLocalToIso(value);
  if (!iso) return "Geçersiz tarih/saat";
  return new Date(iso).toLocaleString("tr-TR");
}

function enrollmentPaymentLabel(app: CourseApplications["studentApplications"][number]): string {
  const amount = app.enrollment_price_minor != null ? `${minorToTl(app.enrollment_price_minor)} ${app.enrollment_currency ?? "TRY"}` : null;
  if (app.enrollment_payment_status === "wallet_held") return `${amount ?? "Ücret"} bloke edildi`;
  if (app.enrollment_payment_status === "wallet_charged") return `${amount ?? "Ücret"} tahsil edildi`;
  if (app.enrollment_payment_status === "external_paid") return "Harici ödeme tamamlandı";
  if (app.enrollment_payment_status === "refunded") return "İptal/iade tamamlandı";
  if (app.enrollment_payment_status === "cancelled") return "Kayıt iptal edildi";
  if (app.status === "approved" && !app.enrollment_id) return "Kayıt/ödeme bekleniyor";
  return "Ödeme bekliyor";
}

function walletReadinessLabel(app: CourseApplications["studentApplications"][number], priceMinor: number): string {
  const available = minorValue(app.wallet_available_minor);
  if (app.status === "approved" && app.enrollment_payment_status === "wallet_held") {
    return `Kullanılabilir: ${minorToTl(available)} TRY · ücret blokede`;
  }
  if (app.status === "approved" && app.enrollment_payment_status === "wallet_charged") {
    return "Tahsilat tamamlandı";
  }
  if (app.status === "approved" && app.enrollment_payment_status === "refunded") {
    return "İade tamamlandı";
  }
  if (app.status === "approved" && app.enrollment_payment_status === "cancelled") {
    return "Kayıt iptal edildi";
  }
  return available >= priceMinor
    ? `Bakiye yeterli: ${minorToTl(available)} TRY`
    : `Bakiye yetersiz: ${minorToTl(available)} / ${minorToTl(priceMinor)} TRY`;
}

export default function AdminCoursesPage() {
  const token = useRequireAdmin();
  const [status, setStatus] = useState("");
  const [origin, setOrigin] = useState("");
  const [teacherMissingOnly, setTeacherMissingOnly] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 40;
  const [rows, setRows] = useState<CourseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [createBusy, setCreateBusy] = useState(false);
  const [createdOk, setCreatedOk] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<CourseRow | null>(null);
  const [applications, setApplications] = useState<CourseApplications | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    branchId: "",
    studentPriceTl: "",
    teacherHourlyTl: "",
    capacity: "20",
    scheduleSummary: "Hafta içi 19:00-20:00",
    sessionLines: "",
    durationMinutes: "60",
    outcomes: "",
    requirements: "",
  });
  const sessionDraftLines = form.sessionLines
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const invalidSessionLines = sessionDraftLines.filter((line) => !datetimeLocalToIso(line));
  const validSessionLines = sessionDraftLines.filter((line) => datetimeLocalToIso(line));
  const opsStats = useMemo(() => {
    const adminCampaigns = rows.filter((row) => row.origin === "admin_campaign");
    return {
      adminCampaigns: adminCampaigns.length,
      waitingTeacher: adminCampaigns.filter((row) => !row.teacher_id).length,
      teacherApplications: adminCampaigns.reduce((sum, row) => sum + Number(row.teacher_application_count ?? 0), 0),
      studentApplications: adminCampaigns.reduce((sum, row) => sum + Number(row.student_application_count ?? 0), 0),
      approvedStudents: adminCampaigns.reduce((sum, row) => sum + Number(row.student_application_approved_count ?? 0), 0),
      enrollments: adminCampaigns.reduce((sum, row) => sum + Number(row.enrollment_count ?? 0), 0),
      heldAmount: adminCampaigns.reduce((sum, row) => sum + minorValue(row.wallet_held_amount_minor), 0),
      chargedAmount: adminCampaigns.reduce((sum, row) => sum + minorValue(row.wallet_charged_amount_minor), 0),
      refundedAmount: adminCampaigns.reduce((sum, row) => sum + minorValue(row.refunded_amount_minor), 0),
      teacherPayoutAmount: adminCampaigns.reduce((sum, row) => sum + minorValue(row.teacher_payout_amount_minor), 0),
    };
  }, [rows]);
  const selectedStats = useMemo(() => {
    const teacherPending = applications?.teacherApplications.filter((app) => app.status === "pending").length ?? 0;
    const studentPending = applications?.studentApplications.filter((app) => app.status === "pending").length ?? 0;
    const acceptedTeacher = applications?.teacherApplications.find((app) => app.status === "accepted") ?? null;
    return { teacherPending, studentPending, acceptedTeacher };
  }, [applications]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      if (status) sp.set("status", status);
      if (origin) sp.set("origin", origin);
      if (teacherMissingOnly) sp.set("teacherMissing", "1");
      sp.set("limit", String(limit));
      sp.set("offset", String(offset));
      const r = await apiFetch<{ courses: CourseRow[]; total: number }>(
        `/api/admin/courses?${sp.toString()}`,
        { token },
      );
      setRows(r.courses);
      setTotal(r.total);
      const d: Record<string, string> = {};
      for (const x of r.courses) d[x.id] = x.status;
      setDraft(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [token, status, origin, teacherMissingOnly, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    apiFetch<{ branches: Branch[] }>("/v1/meta/branches")
      .then((r) => setBranches(r.branches))
      .catch(() => setBranches([]));
  }, []);

  async function saveStatus(courseId: string, next: string) {
    if (!token) return;
    if (!window.confirm(`Kurs durumu "${next}" olarak güncellensin mi?`)) return;
    setBusyId(courseId);
    setError(null);
    try {
      await apiFetch(`/api/admin/courses/${courseId}/status`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status: next }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "hata");
    } finally {
      setBusyId(null);
    }
  }

  async function createCampaign() {
    if (!token) return;
    setCreateBusy(true);
    setError(null);
    setCreatedOk(null);
    try {
      if (invalidSessionLines.length > 0) {
        setError(`Geçersiz ders tarih/saat satırı: ${invalidSessionLines[0]}`);
        return;
      }
      const durationMinutes = Math.max(15, Math.min(240, Number(form.durationMinutes || "60") || 60));
      const sessions = validSessionLines
        .map((line) => datetimeLocalToIso(line))
        .filter((line): line is string => Boolean(line))
        .map((scheduledStart, index) => ({
          title: `Ders ${index + 1}`,
          scheduledStart,
          durationMinutes,
        }));
      const body = {
        title: form.title,
        description: form.description,
        branchId: form.branchId ? Number(form.branchId) : null,
        studentPriceMinor: tlToMinor(form.studentPriceTl),
        teacherHourlyRateMinor: tlToMinor(form.teacherHourlyTl),
        capacity: form.capacity ? Number(form.capacity) : null,
        schedule: { summary: form.scheduleSummary },
        details: {
          targetAudience: form.description.slice(0, 500),
          outcomes: form.outcomes.split(",").map((x) => x.trim()).filter(Boolean),
          requirements: form.requirements.split(",").map((x) => x.trim()).filter(Boolean),
          applicationNote: "Öğrenciler ön kayıt bırakır; admin uygunluk sonrası dönüş yapar.",
        },
        sessions,
      };
      const r = await apiFetch<{ course: { id: string; title: string } }>("/api/admin/courses", {
        method: "POST",
        token,
        body: JSON.stringify(body),
      });
      setCreatedOk(`${r.course.title} kampanyası açıldı.`);
      setForm((prev) => ({ ...prev, title: "", description: "", sessionLines: "", outcomes: "", requirements: "" }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "kampanya_olusturulamadi");
    } finally {
      setCreateBusy(false);
    }
  }

  async function loadApplications(course: CourseRow) {
    if (!token) return;
    setSelectedCourse(course);
    setApplications(null);
    setError(null);
    try {
      const r = await apiFetch<CourseApplications>(`/api/admin/courses/${course.id}/applications`, { token });
      setApplications(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "basvurular_yuklenemedi");
    }
  }

  async function decideTeacherApplication(appId: string, status: "accepted" | "rejected") {
    if (!token || !selectedCourse) return;
    setBusyId(appId);
    try {
      await apiFetch(`/api/admin/courses/${selectedCourse.id}/teacher-applications/${appId}/status`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status }),
      });
      await loadApplications(selectedCourse);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "basvuru_guncellenemedi");
    } finally {
      setBusyId(null);
    }
  }

  async function decideStudentApplication(appId: string, status: "approved" | "rejected") {
    if (!token || !selectedCourse) return;
    setBusyId(appId);
    try {
      await apiFetch(`/api/admin/courses/${selectedCourse.id}/student-applications/${appId}/status`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status }),
      });
      await loadApplications(selectedCourse);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "on_kayit_guncellenemedi";
      setError(msg.includes("insufficient_balance") ? "Öğrencinin kullanılabilir bakiyesi yetersiz; onay için önce cüzdan bakiyesi tamamlanmalı." : msg);
    } finally {
      setBusyId(null);
    }
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Kurslar</h1>
          <Link
            href="/admin/merkez"
            className="text-sm font-medium text-brand-800 underline decoration-brand-400 underline-offset-4"
          >
            Merkez
          </Link>
        </div>
        <p className="mt-2 text-sm text-paper-800/75">
          Tüm öğretmen kursları ve admin kampanyaları; durum filtresi. Halka açık liste:{" "}
          <Link href="/courses" className="text-brand-800 underline">
            /courses
          </Link>
        </p>

        <section className="mt-6 grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-paper-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-paper-800/55">Admin kampanyası</div>
            <div className="mt-1 text-2xl font-semibold text-paper-950">{opsStats.adminCampaigns}</div>
          </div>
          <div className="rounded-xl border border-warm-200 bg-warm-50/70 p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-warm-900/70">Öğretmen bekleyen</div>
            <div className="mt-1 text-2xl font-semibold text-warm-950">{opsStats.waitingTeacher}</div>
          </div>
          <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-brand-900/70">Öğretmen başvurusu</div>
            <div className="mt-1 text-2xl font-semibold text-brand-950">{opsStats.teacherApplications}</div>
          </div>
          <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-brand-900/70">Öğrenci huni</div>
            <div className="mt-1 text-2xl font-semibold text-brand-950">{opsStats.studentApplications}</div>
            <p className="mt-1 text-xs text-paper-800/55">
              {opsStats.approvedStudents} onay · {opsStats.enrollments} kayıt
            </p>
            <p className="mt-1 text-xs text-paper-800/55">
              {minorToTl(opsStats.heldAmount)} TL blokede · {minorToTl(opsStats.chargedAmount)} TL tahsil
            </p>
            <p className="mt-1 text-xs text-paper-800/55">
              {minorToTl(opsStats.teacherPayoutAmount)} TL öğretmen hakedişi · {minorToTl(opsStats.refundedAmount)} TL iade
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-900/70">
                Admin kurs kampanyası
              </div>
              <h2 className="mt-1 text-lg font-semibold text-paper-950">
                Öğrenci ön kayıtlı, öğretmen başvurulu kurs aç
              </h2>
              <p className="mt-1 text-sm text-paper-800/65">
                Öğrenci kurs fiyatını, öğretmen ders saat ücretini ve ders gün/saatlerini admin belirler.
              </p>
            </div>
            <button
              type="button"
              disabled={createBusy || !form.title.trim() || !form.studentPriceTl || !form.teacherHourlyTl}
              onClick={() => void createCampaign()}
              className="rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {createBusy ? "Açılıyor…" : "Kampanya aç"}
            </button>
          </div>
          {createdOk ? <div className="mt-3 rounded-xl bg-brand-50 p-3 text-sm text-brand-900">{createdOk}</div> : null}
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              <span className="font-medium text-paper-800">Kurs başlığı</span>
              <input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2 outline-none focus:border-brand-400"
                placeholder="LGS Matematik hızlandırma kampanyası"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium text-paper-800">Branş</span>
              <select
                value={form.branchId}
                onChange={(e) => setForm((p) => ({ ...p, branchId: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-paper-200 bg-white px-3 py-2 outline-none focus:border-brand-400"
              >
                <option value="">Seçiniz</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm md:col-span-2">
              <span className="font-medium text-paper-800">Ayrıntılı açıklama</span>
              <textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className="mt-1 min-h-24 w-full rounded-xl border border-paper-200 px-3 py-2 outline-none focus:border-brand-400"
                placeholder="Kampanya hedefi, kimlere uygun olduğu, ders akışı ve başarı beklentisi..."
              />
            </label>
            <label className="text-sm">
              <span className="font-medium text-paper-800">Öğrenci kurs fiyatı (TL)</span>
              <input
                type="number"
                min="0"
                value={form.studentPriceTl}
                onChange={(e) => setForm((p) => ({ ...p, studentPriceTl: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2 outline-none focus:border-brand-400"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium text-paper-800">Öğretmen ders saat ücreti (TL)</span>
              <input
                type="number"
                min="0"
                value={form.teacherHourlyTl}
                onChange={(e) => setForm((p) => ({ ...p, teacherHourlyTl: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2 outline-none focus:border-brand-400"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium text-paper-800">Kontenjan</span>
              <input
                type="number"
                min="1"
                value={form.capacity}
                onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2 outline-none focus:border-brand-400"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium text-paper-800">Ders gün/saat özeti</span>
              <input
                value={form.scheduleSummary}
                onChange={(e) => setForm((p) => ({ ...p, scheduleSummary: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2 outline-none focus:border-brand-400"
                placeholder="Pazartesi ve Çarşamba 19:00"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium text-paper-800">Ders süresi (dk)</span>
              <input
                type="number"
                min="15"
                max="240"
                value={form.durationMinutes}
                onChange={(e) => setForm((p) => ({ ...p, durationMinutes: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2 outline-none focus:border-brand-400"
              />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="font-medium text-paper-800">Ders başlangıçları</span>
              <textarea
                value={form.sessionLines}
                onChange={(e) => setForm((p) => ({ ...p, sessionLines: e.target.value }))}
                className="mt-1 min-h-20 w-full rounded-xl border border-paper-200 px-3 py-2 font-mono text-xs outline-none focus:border-brand-400"
                placeholder={"Her satıra bir tarih/saat yazın: 2026-06-15T19:00\n2026-06-17T19:00"}
              />
              <span className="mt-1 block text-xs text-paper-800/55">
                ISO formatı veya tarayıcının anlayacağı tarih/saat kullanılabilir. Boş bırakılırsa sadece özet gösterilir.
              </span>
            </label>
            <div className="rounded-xl border border-paper-200 bg-paper-50 p-4 text-sm md:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold text-paper-900">Ders planı önizlemesi</div>
                <div className="text-xs text-paper-800/55">
                  {validSessionLines.length} geçerli · {invalidSessionLines.length} hatalı
                </div>
              </div>
              {invalidSessionLines.length > 0 ? (
                <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  İlk hatalı satır: {invalidSessionLines[0]}
                </div>
              ) : null}
              {validSessionLines.length > 0 ? (
                <ol className="mt-3 grid gap-2 sm:grid-cols-2">
                  {validSessionLines.slice(0, 8).map((line, index) => (
                    <li key={`${line}-${index}`} className="rounded-lg bg-white px-3 py-2 text-xs text-paper-800 ring-1 ring-paper-200">
                      Ders {index + 1}: {localLabel(line)} · {form.durationMinutes || 60} dk
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-xs text-paper-800/60">
                  Henüz tarih/saat girilmedi. Kampanya yine açılabilir, ancak öğrenci ve öğretmen sadece özet bilgisini görür.
                </p>
              )}
            </div>
            <label className="text-sm">
              <span className="font-medium text-paper-800">Kazanımlar (virgülle)</span>
              <input
                value={form.outcomes}
                onChange={(e) => setForm((p) => ({ ...p, outcomes: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2 outline-none focus:border-brand-400"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium text-paper-800">Başvuru şartları (virgülle)</span>
              <input
                value={form.requirements}
                onChange={(e) => setForm((p) => ({ ...p, requirements: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2 outline-none focus:border-brand-400"
              />
            </label>
          </div>
        </section>

        {selectedCourse ? (
          <section className="mt-6 rounded-2xl border border-paper-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-paper-950">Başvurular: {selectedCourse.title}</h2>
                <p className="mt-1 text-sm text-paper-800/60">
                  Öğretmen seçimi kursun öğretmenini belirler; öğrenci ön kayıtları ödeme öncesi talep olarak kalır.
                </p>
                {applications ? (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-brand-50 px-2.5 py-1 font-semibold text-brand-900">
                      Bekleyen öğretmen: {selectedStats.teacherPending}
                    </span>
                    <span className="rounded-full bg-warm-50 px-2.5 py-1 font-semibold text-warm-900">
                      Bekleyen öğrenci: {selectedStats.studentPending}
                    </span>
                    <span className="rounded-full bg-brand-50 px-2.5 py-1 font-semibold text-brand-900">
                      Otomatik kayıt: {selectedCourse.enrollment_count}
                    </span>
                    <span className="rounded-full bg-brand-50 px-2.5 py-1 font-semibold text-brand-900">
                      Bloke: {minorToTl(minorValue(selectedCourse.wallet_held_amount_minor))} TL
                    </span>
                    <span className="rounded-full bg-paper-100 px-2.5 py-1 font-semibold text-paper-900">
                      Tahsil: {minorToTl(minorValue(selectedCourse.wallet_charged_amount_minor))} TL
                    </span>
                    <span className="rounded-full bg-paper-100 px-2.5 py-1 font-semibold text-paper-900">
                      İade: {minorToTl(minorValue(selectedCourse.refunded_amount_minor))} TL
                    </span>
                    <span className="rounded-full bg-paper-100 px-2.5 py-1 font-semibold text-paper-900">
                      Öğretmen hakedişi: {minorToTl(minorValue(selectedCourse.teacher_payout_amount_minor))} TL
                    </span>
                    {selectedStats.acceptedTeacher ? (
                      <span className="rounded-full bg-paper-100 px-2.5 py-1 font-semibold text-paper-900">
                        Seçilen: {selectedStats.acceptedTeacher.teacher_display_name}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <button type="button" onClick={() => setSelectedCourse(null)} className="text-sm font-semibold text-paper-700 underline">
                Kapat
              </button>
            </div>
            {!applications ? (
              <div className="mt-4 text-sm text-paper-800/60">Başvurular yükleniyor…</div>
            ) : (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold text-paper-900">Öğretmen başvuruları</h3>
                  <div className="mt-2 space-y-2">
                    {applications.teacherApplications.length === 0 ? (
                      <p className="text-sm text-paper-800/55">Henüz öğretmen başvurusu yok.</p>
                    ) : (
                      applications.teacherApplications.map((app) => (
                        <article key={app.id} className="rounded-xl border border-paper-200 bg-paper-50 p-3">
                          <div className="text-sm font-semibold text-paper-950">{app.teacher_display_name}</div>
                          <div className="text-xs text-paper-800/55">{app.teacher_email} · {app.status} · {app.verification_status}</div>
                          {app.message ? <p className="mt-2 text-xs text-paper-800/70">{app.message}</p> : null}
                          {app.experience_note ? <p className="mt-1 text-xs text-paper-800/55">{app.experience_note}</p> : null}
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              disabled={busyId === app.id || app.status === "accepted"}
                              onClick={() => void decideTeacherApplication(app.id, "accepted")}
                              className="rounded-lg bg-brand-800 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              Seç
                            </button>
                            <button
                              type="button"
                              disabled={busyId === app.id || app.status === "rejected"}
                              onClick={() => void decideTeacherApplication(app.id, "rejected")}
                              className="rounded-lg border border-paper-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-paper-800 disabled:opacity-50"
                            >
                              Reddet
                            </button>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-paper-900">Öğrenci ön kayıtları</h3>
                  <div className="mt-2 space-y-2">
                    {applications.studentApplications.length === 0 ? (
                      <p className="text-sm text-paper-800/55">Henüz öğrenci ön kaydı yok.</p>
                    ) : (
                      applications.studentApplications.map((app) => {
                        const walletReady = minorValue(app.wallet_available_minor) >= selectedCourse.price_minor;
                        return (
                        <article key={app.id} className="rounded-xl border border-paper-200 bg-paper-50 p-3">
                          <div className="text-sm font-semibold text-paper-950">{app.student_display_name}</div>
                          <div className="text-xs text-paper-800/55">{app.student_email} · {app.status} · {app.cohort_title ?? "Grup"}</div>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            <span className={`rounded-full px-2.5 py-1 font-semibold ring-1 ${
                              app.status === "approved" || walletReady
                                ? "bg-brand-50 text-brand-900 ring-brand-100"
                                : "bg-red-50 text-red-800 ring-red-100"
                            }`}>
                              {walletReadinessLabel(app, selectedCourse.price_minor)}
                            </span>
                            <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-brand-900 ring-1 ring-brand-100">
                              {enrollmentPaymentLabel(app)}
                            </span>
                            {app.wallet_hold_status ? (
                              <span className="rounded-full bg-paper-100 px-2.5 py-1 font-semibold text-paper-800">
                                Hold: {app.wallet_hold_status}
                              </span>
                            ) : null}
                            {app.enrollment_charged_at ? (
                              <span className="rounded-full bg-paper-100 px-2.5 py-1 font-semibold text-paper-800">
                                Tahsil: {new Date(app.enrollment_charged_at).toLocaleString("tr-TR")}
                              </span>
                            ) : null}
                          </div>
                          {app.goal_note ? <p className="mt-2 text-xs text-paper-800/70">{app.goal_note}</p> : null}
                          {app.guardian_note ? <p className="mt-1 text-xs text-paper-800/55">{app.guardian_note}</p> : null}
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              disabled={busyId === app.id || app.status === "approved" || !walletReady}
                              onClick={() => void decideStudentApplication(app.id, "approved")}
                              className="rounded-lg bg-brand-800 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              {!walletReady && app.status !== "approved" ? "Bakiye bekleniyor" : "Onayla"}
                            </button>
                            <button
                              type="button"
                              disabled={busyId === app.id || app.status === "rejected"}
                              onClick={() => void decideStudentApplication(app.id, "rejected")}
                              className="rounded-lg border border-paper-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-paper-800 disabled:opacity-50"
                            >
                              Reddet
                            </button>
                          </div>
                        </article>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        ) : null}

        <section className="mt-4 grid gap-3 rounded-2xl border border-paper-200 bg-white p-4 shadow-sm md:grid-cols-3">
          <label className="text-sm">
            <span className="font-medium text-paper-800">Durum</span>
            <select
              className="mt-1 w-full rounded-xl border border-paper-200 bg-white px-3 py-2 text-sm capitalize"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setOffset(0);
              }}
            >
              <option value="">Tümü</option>
              <option value="published">published</option>
              <option value="draft">draft</option>
              <option value="archived">archived</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="font-medium text-paper-800">Kaynak</span>
            <select
              className="mt-1 w-full rounded-xl border border-paper-200 bg-white px-3 py-2 text-sm"
              value={origin}
              onChange={(e) => {
                setOrigin(e.target.value);
                setOffset(0);
              }}
            >
              <option value="">Tüm kurslar</option>
              <option value="admin_campaign">Admin kampanyaları</option>
              <option value="teacher_created">Öğretmen kursları</option>
            </select>
          </label>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 rounded-xl border border-paper-200 bg-paper-50 px-3 py-2 text-sm text-paper-800">
              <input
                type="checkbox"
                checked={teacherMissingOnly}
                onChange={(e) => {
                  setTeacherMissingOnly(e.target.checked);
                  if (e.target.checked) setOrigin("admin_campaign");
                  setOffset(0);
                }}
              />
              Sadece öğretmen bekleyen kampanyalar
            </label>
            {(status || origin || teacherMissingOnly) ? (
              <button
                type="button"
                onClick={() => {
                  setStatus("");
                  setOrigin("");
                  setTeacherMissingOnly(false);
                  setOffset(0);
                }}
                className="text-left text-xs font-semibold text-brand-800 underline"
              >
                Filtreleri temizle
              </button>
            ) : null}
          </div>
        </section>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        ) : null}

        <p className="mt-3 text-xs text-paper-800/55">
          Toplam {total} · sayfa {Math.floor(offset / limit) + 1}
        </p>

        <div className="mt-4 overflow-x-auto rounded-xl border border-paper-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-paper-200 bg-paper-50 text-xs font-semibold uppercase tracking-wide text-paper-800/75">
              <tr>
                <th className="px-3 py-2">Başlık</th>
                <th className="px-3 py-2">Öğretmen</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">Fiyat</th>
                <th className="px-3 py-2">Başvuru</th>
                <th className="px-3 py-2">Tarih</th>
                <th className="px-3 py-2">Detay</th>
                <th className="px-3 py-2">Yönet</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-paper-800/55">
                    Yükleniyor…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-paper-800/55">
                    Kayıt yok.
                  </td>
                </tr>
              ) : (
                rows.map((c) => (
                  <tr key={c.id} className="border-b border-paper-100 last:border-0">
                    <td className="max-w-[14rem] px-3 py-2 font-medium text-paper-900">
                      {c.title}
                      {c.origin === "admin_campaign" ? (
                        <div className="mt-1 w-fit rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-900">
                          Admin kampanyası
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-paper-900">{c.teacher_display_name}</div>
                      <div className="text-xs text-paper-800/75">{c.teacher_email ?? "Seçim bekliyor"}</div>
                    </td>
                    <td className="px-3 py-2 capitalize text-paper-800">{c.status}</td>
                    <td className="px-3 py-2 tabular-nums text-paper-800">
                      <div>Öğrenci: {minorToTl(c.price_minor)} {c.currency}</div>
                      {c.origin === "admin_campaign" ? (
                        <div className="text-xs text-paper-800/60">
                          Öğretmen saat: {minorToTl(c.teacher_hourly_rate_minor)} {c.currency}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-xs text-paper-800/75">
                      <div>Öğretmen: {c.teacher_application_count}</div>
                      <div>Öğrenci: {c.student_application_count}</div>
                      {c.origin === "admin_campaign" ? (
                        <>
                          <div className="mt-1 rounded-lg border border-paper-200 bg-paper-50 px-2 py-1">
                            Bekleyen {c.student_application_pending_count} · Onay {c.student_application_approved_count} · Kayıt {c.enrollment_count}
                          </div>
                          <div className="mt-1 rounded-lg border border-brand-100 bg-brand-50 px-2 py-1 text-brand-950">
                            Bloke {minorToTl(minorValue(c.wallet_held_amount_minor))} TL · Tahsil {minorToTl(minorValue(c.wallet_charged_amount_minor))} TL
                          </div>
                          <div className="mt-1 rounded-lg border border-amber-100 bg-amber-50 px-2 py-1 text-amber-950">
                            İade {minorToTl(minorValue(c.refunded_amount_minor))} TL ({c.refunded_count})
                          </div>
                          <div className="mt-1 rounded-lg border border-paper-200 bg-white px-2 py-1">
                            Öğretmen hakedişi {minorToTl(minorValue(c.teacher_payout_amount_minor))} TL ({c.teacher_payout_count})
                          </div>
                          <button
                            type="button"
                            onClick={() => void loadApplications(c)}
                            className="mt-1 font-semibold text-brand-800 underline"
                          >
                            Yönet
                          </button>
                        </>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-paper-800/75">{new Date(c.created_at).toLocaleString("tr-TR")}</td>
                    <td className="px-3 py-2">
                      <Link href={`/courses/${c.id}`} className="text-brand-800 underline" target="_blank" rel="noreferrer">
                        Aç
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1">
                        <select
                          className="rounded border border-paper-200 px-1 py-1 text-xs capitalize"
                          value={draft[c.id] ?? c.status}
                          onChange={(e) => setDraft((d) => ({ ...d, [c.id]: e.target.value }))}
                        >
                          <option value="draft">draft</option>
                          <option value="published">published</option>
                          <option value="archived">archived</option>
                        </select>
                        <button
                          type="button"
                          disabled={busyId === c.id || (draft[c.id] ?? c.status) === c.status}
                          onClick={() => void saveStatus(c.id, draft[c.id] ?? c.status)}
                          className="rounded bg-brand-800 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40"
                        >
                          {busyId === c.id ? "…" : "Kaydet"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
