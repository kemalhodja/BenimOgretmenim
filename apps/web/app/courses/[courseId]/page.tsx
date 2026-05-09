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
  branch_name: string | null;
  teacher_id: string;
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
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
        const r = await apiFetch<{ course: CourseDetail; cohorts: CohortRow[] }>(
          `/v1/courses/${courseId}`,
        );
        if (!cancelled) {
          setCourse(r.course);
          setCohorts(r.cohorts);
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
        setOk("Kayıt alındı.");
        const r = await apiFetch<{ course: CourseDetail; cohorts: CohortRow[] }>(
          `/v1/courses/${courseId}`,
        );
        setCourse(r.course);
        setCohorts(r.cohorts);
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
            {course.description && (
              <p className="mt-4 whitespace-pre-wrap text-sm text-paper-800">
                {course.description}
              </p>
            )}

            <h2 className="mt-8 text-base font-semibold text-paper-900">Cohortlar</h2>
            <p className="mt-1 text-xs text-paper-800/55">
              Başlangıç tarihine göre listelenir. Kayıt için öğrenci hesabıyla giriş yapın.
            </p>

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
                      <button
                        type="button"
                        disabled={busyId === c.id || full}
                        onClick={() => void enroll(c.id)}
                        className="mt-3 rounded-xl bg-brand-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {full ? "Dolu" : busyId === c.id ? "…" : "Kayıt ol"}
                      </button>
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

