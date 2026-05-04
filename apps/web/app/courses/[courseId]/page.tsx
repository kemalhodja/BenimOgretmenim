"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/courses"
            className="text-sm font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-900"
          >
            ← Kurslar
          </Link>
          <div className="flex flex-wrap justify-end gap-2">
            <Link
              href="/panel"
              className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 shadow-sm"
            >
              Panele git
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Ana sayfa
            </Link>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
        {ok && (
          <div className="mt-6 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
            <p>{ok}</p>
            <Link
              href="/student/kurslar"
              className="mt-2 inline-block font-medium text-brand-950 underline decoration-brand-400"
            >
              Kurslarım sayfasına git →
            </Link>
          </div>
        )}

        {!course ? (
          <div className="mt-8 text-sm text-zinc-600">Yükleniyor…</div>
        ) : (
          <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-zinc-500">Site</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
              {course.title}
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              {course.teacher_display_name} · {course.branch_name ?? "—"} · {course.delivery_mode} ·{" "}
              {minorToTl(course.price_minor)} {course.currency}
            </p>
            {course.description && (
              <p className="mt-4 whitespace-pre-wrap text-sm text-zinc-700">
                {course.description}
              </p>
            )}

            <h2 className="mt-8 text-base font-semibold text-zinc-900">Cohortlar</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Başlangıç tarihine göre listelenir. Kayıt için öğrenci hesabıyla giriş yapın.
            </p>

            <div className="mt-4 space-y-3">
              {cohorts.length === 0 ? (
                <div className="text-sm text-zinc-600">Şu an açık cohort yok.</div>
              ) : (
                cohorts.map((c) => {
                  const full =
                    c.capacity != null && c.enrolled_count >= c.capacity;
                  return (
                    <div
                      key={c.id}
                      className="rounded-xl border border-zinc-100 bg-zinc-50 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-zinc-900">{c.title}</div>
                        <div className="text-xs text-zinc-500">{c.status}</div>
                      </div>
                      <div className="mt-1 text-xs text-zinc-600">
                        Başlangıç: {c.starts_at ? new Date(c.starts_at).toLocaleString("tr-TR") : "—"}
                        {" · "}
                        Kontenjan: {c.capacity ?? "—"}{" "}
                        {c.capacity != null ? `(${c.enrolled_count}/${c.capacity})` : `(${c.enrolled_count})`}
                      </div>
                      <button
                        type="button"
                        disabled={busyId === c.id || full}
                        onClick={() => void enroll(c.id)}
                        className="mt-3 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
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

