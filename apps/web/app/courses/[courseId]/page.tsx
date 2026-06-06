"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AuthEntryLink } from "../../components/AuthEntryLink";
import { apiFetch } from "../../lib/api";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { clearToken, getToken } from "../../lib/auth";

type CourseDetail = {
  id: string;
  title: string;
  description: string | null;
  delivery_mode: string;
  language_code: string;
  price_minor: number;
  currency: string;
  origin: string;
  application_status: string;
  campaign_details_jsonb?: {
    targetAudience?: string | null;
    outcomes?: string[];
    requirements?: string[];
    applicationNote?: string | null;
  };
  branch_name: string | null;
  teacher_id: string | null;
  teacher_display_name: string;
};

type CohortRow = {
  id: string;
  title: string;
  status: string;
  capacity: number | null;
  starts_at: string | null;
  ends_at: string | null;
  enrolled_count: number;
  application_count?: number;
  schedule_jsonb?: { summary?: string };
};

type LessonScheduleRow = {
  id: string;
  cohort_id: string;
  session_index: number;
  title: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  duration_minutes: number | null;
  label: string;
};

function minorToTl(n: number): string {
  return (n / 100).toFixed(2);
}

export default function CourseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = typeof params.courseId === "string" ? params.courseId : "";

  const [token, setToken] = useState<string | null>(null);
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [lessonSchedule, setLessonSchedule] = useState<LessonScheduleRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [goalNote, setGoalNote] = useState("");

  useEffect(() => {
    // Kayıt ekranı public; enroll için token gerekir.
    setToken(getToken());
  }, []);

  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const r = await apiFetch<{ course: CourseDetail; cohorts: CohortRow[]; lessonSchedule?: LessonScheduleRow[] }>(
          `/v1/courses/${courseId}`,
        );
        if (!cancelled) {
          setCourse(r.course);
          setCohorts(r.cohorts);
          setLessonSchedule(r.lessonSchedule ?? []);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "load_failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  type EnrollOk = {
    enrollment: { id: string; enrolled_at: string };
    free?: boolean;
    walletHold?: { holdId: string } | null;
  };

  async function enroll(cohortId: string) {
    if (!token) {
      router.push(loginHrefWithReturn(`/courses/${courseId}`));
      return;
    }
    setBusyId(cohortId);
    setError(null);
    setOk(null);
    try {
      const raw = await apiFetch<EnrollOk>(
        `/v1/courses/${courseId}/cohorts/${cohortId}/enroll`,
        {
          method: "POST",
          token,
        },
      );
      if ("enrollment" in raw) {
        setOk(raw.walletHold ? "Kayıt alındı; kurs ücreti bakiyenizde bloke edildi." : "Kayıt alındı.");
        const r = await apiFetch<{ course: CourseDetail; cohorts: CohortRow[]; lessonSchedule?: LessonScheduleRow[] }>(
          `/v1/courses/${courseId}`,
        );
        setCourse(r.course);
        setCohorts(r.cohorts);
        setLessonSchedule(r.lessonSchedule ?? []);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "enroll_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        setToken(null);
        router.replace(loginHrefWithReturn(`/courses/${courseId}`));
        return;
      }
      if (msg.includes("[403]")) {
        setError("Bu gruba kayıt için uygun hesap veya izin yok.");
      }
      if (msg.includes("[409]") && msg.includes("insufficient")) {
        setError("Bakiye yetersiz. Öğrenci panelinden cüzdana bakiye yükleyin.");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function applyForCampaign(cohortId: string | null) {
    if (!token) {
      router.push(loginHrefWithReturn(`/courses/${courseId}`));
      return;
    }
    setBusyId(cohortId ?? courseId);
    setError(null);
    setOk(null);
    try {
      await apiFetch(`/v1/courses/${courseId}/student-applications`, {
        method: "POST",
        token,
        body: JSON.stringify({ cohortId, goalNote }),
      });
      setOk("Ön kayıt başvurunuz alındı. Admin uygunluk ve kontenjan için dönüş yapacak.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "application_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        setToken(null);
        router.replace(loginHrefWithReturn(`/courses/${courseId}`));
        return;
      }
      if (msg.includes("[403]")) {
        setError("Ön kayıt için öğrenci hesabıyla giriş yapın.");
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <Link
            href="/courses"
            className="text-sm font-medium text-paper-800/75 underline decoration-paper-300 underline-offset-4 hover:text-paper-900"
          >
            ← Kurslar
          </Link>
          <p className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-sm">
            <AuthEntryLink
              path="/panel"
              className="font-medium text-brand-800 underline decoration-brand-400 underline-offset-4"
            >
              Panele git
            </AuthEntryLink>
            <Link
              href="/"
              className="text-paper-800/75 underline decoration-paper-300 underline-offset-4 hover:text-paper-900"
            >
              Ana sayfa
            </Link>
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
        {ok && (
          <div className="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
            <p>{ok}</p>
            <AuthEntryLink
              path="/student/kurslar"
              className="mt-2 inline-block font-medium text-brand-950 underline decoration-brand-400"
            >
              Kurslarım sayfasına git →
            </AuthEntryLink>
          </div>
        )}

        {!course ? (
          <div className="mt-8 text-sm text-paper-800/75">Yükleniyor…</div>
        ) : (
          <div className="mt-6 rounded-xl border border-paper-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-semibold tracking-tight text-paper-900">
              {course.title}
            </h1>
            <p className="mt-1 text-sm text-paper-800/75">
              {course.teacher_display_name} · {course.branch_name ?? "—"} · {course.delivery_mode} ·{" "}
              {minorToTl(course.price_minor)} {course.currency}
            </p>
            {course.origin === "admin_campaign" ? (
              <div className="mt-3 rounded-2xl border border-brand-200 bg-brand-50/70 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-brand-900/70">
                  Admin kurs kampanyası
                </div>
                <h2 className="mt-1 text-base font-semibold text-paper-950">
                  Ön kayıtla ilerleyen ayrıntılı kurs kampanyası
                </h2>
                <p className="mt-1 text-sm text-paper-800/70">
                  Öğrenci fiyatı: {minorToTl(course.price_minor)} {course.currency}. Öğretmen seçimi ve ön kayıt onayı admin tarafından yönetilir.
                </p>
                {course.campaign_details_jsonb?.applicationNote ? (
                  <p className="mt-2 text-xs text-paper-800/60">{course.campaign_details_jsonb.applicationNote}</p>
                ) : null}
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {[
                    ["1", "Ön kayıt", "Öğrenci hedefini ve uygunluğunu iletir."],
                    ["2", "Admin kontrolü", "Kontenjan, seviye ve öğretmen seçimi netleşir."],
                    ["3", "Kayıt adımı", "Uygunsa bakiye bloke edilir; kurs başlayınca tahsil edilir."],
                  ].map(([step, title, body]) => (
                    <div key={step} className="rounded-xl bg-white/80 p-3 text-xs ring-1 ring-brand-100">
                      <div className="font-semibold text-brand-900">Adım {step}</div>
                      <div className="mt-1 font-semibold text-paper-950">{title}</div>
                      <p className="mt-1 text-paper-800/60">{body}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {course.description && (
              <p className="mt-4 whitespace-pre-wrap text-sm text-paper-800">
                {course.description}
              </p>
            )}

            {course.origin === "admin_campaign" ? (
              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-paper-200 bg-paper-50 p-4">
                  <h2 className="text-sm font-semibold text-paper-900">Kazanımlar</h2>
                  {(course.campaign_details_jsonb?.outcomes?.length ?? 0) > 0 ? (
                    <ul className="mt-2 space-y-1 text-sm text-paper-800/75">
                      {course.campaign_details_jsonb?.outcomes?.map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-paper-800/60">Kurs hedefleri açıklama alanında belirtilir.</p>
                  )}
                </div>
                <div className="rounded-xl border border-paper-200 bg-paper-50 p-4">
                  <h2 className="text-sm font-semibold text-paper-900">Başvuru şartları</h2>
                  {(course.campaign_details_jsonb?.requirements?.length ?? 0) > 0 ? (
                    <ul className="mt-2 space-y-1 text-sm text-paper-800/75">
                      {course.campaign_details_jsonb?.requirements?.map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-paper-800/60">Ön kayıt sonrası admin uygunluğu kontrol eder.</p>
                  )}
                </div>
                <div className="rounded-xl border border-paper-200 bg-paper-50 p-4 md:col-span-2">
                  <h2 className="text-sm font-semibold text-paper-900">Ders günleri ve saatleri</h2>
                  {lessonSchedule.length > 0 ? (
                    <ul className="mt-2 grid gap-2 text-sm text-paper-800/75 sm:grid-cols-2">
                      {lessonSchedule.map((session) => (
                        <li key={session.id} className="rounded-lg bg-white px-3 py-2 ring-1 ring-paper-200">
                          Ders {session.session_index}: {session.label}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-paper-800/60">
                      {cohorts[0]?.schedule_jsonb?.summary ?? "Ders gün/saatleri admin tarafından netleştirilecek."}
                    </p>
                  )}
                </div>
              </div>
            ) : null}

            <h2 className="mt-8 text-base font-semibold text-paper-900">Cohortlar</h2>
            <p className="mt-1 text-xs text-paper-800/55">
              {course.origin === "admin_campaign"
                ? "Ön kayıt için öğrenci hesabıyla giriş yapın; admin onayında bakiye bloke edilir, kurs başlayınca tahsil edilir."
                : "Başlangıç tarihine göre listelenir. Kayıtta bakiye bloke edilir, kurs başlayınca tahsil edilir."}
            </p>
            {course.origin === "admin_campaign" ? (
              <label className="mt-4 block text-sm">
                <span className="font-medium text-paper-800">Ön kayıt notu</span>
                <textarea
                  value={goalNote}
                  onChange={(e) => setGoalNote(e.target.value)}
                  className="mt-1 min-h-20 w-full rounded-xl border border-paper-200 px-3 py-2 outline-none focus:border-brand-400"
                  placeholder="Hedefinizi, sınıfınızı veya uygun saatlerinizi yazabilirsiniz."
                />
              </label>
            ) : null}

            <div className="mt-4 space-y-3">
              {cohorts.length === 0 ? (
                <div className="text-sm text-paper-800/75">Şu an açık cohort yok.</div>
              ) : (
                cohorts.map((c) => {
                  const full =
                    c.capacity != null && c.enrolled_count >= c.capacity;
                  return (
                    <div
                      key={c.id}
                      className="rounded-xl border border-paper-100 bg-paper-50 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-paper-900">{c.title}</div>
                        <div className="text-xs text-paper-800/55">{c.status}</div>
                      </div>
                      <div className="mt-1 text-xs text-paper-800/75">
                        Başlangıç: {c.starts_at ? new Date(c.starts_at).toLocaleString("tr-TR") : "—"}
                        {" · "}
                        Kontenjan: {c.capacity ?? "—"}{" "}
                        {c.capacity != null ? `(${c.enrolled_count}/${c.capacity})` : `(${c.enrolled_count})`}
                      </div>
                      {course.origin === "admin_campaign" ? (
                        <button
                          type="button"
                          disabled={busyId === c.id || course.application_status !== "open"}
                          onClick={() => void applyForCampaign(c.id)}
                          className="mt-3 rounded-xl bg-brand-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                        >
                          {busyId === c.id ? "…" : "Ön kayıt başvurusu yap"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === c.id || full}
                          onClick={() => void enroll(c.id)}
                          className="mt-3 rounded-xl bg-brand-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                        >
                          {full ? "Dolu" : busyId === c.id ? "…" : "Kayıt ol"}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

