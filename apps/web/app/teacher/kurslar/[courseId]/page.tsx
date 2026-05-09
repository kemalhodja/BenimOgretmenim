"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../../lib/api";
import { loginHrefWithReturn } from "../../../lib/authRedirect";
import { clearToken, getToken } from "../../../lib/auth";

type CourseManage = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  delivery_mode: string;
  language_code: string;
  price_minor: number;
  currency: string;
  branch_id: number | null;
  branch_name: string | null;
  created_at: string;
  updated_at: string;
};

type CohortRow = {
  id: string;
  title: string;
  status: string;
  capacity: number | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  enrolled_count: number;
  session_count: number;
};

function minorToTl(n: number): string {
  return (n / 100).toFixed(2);
}

export default function TeacherCourseManagePage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const params = useParams<{ courseId: string }>();
  const courseId = params.courseId;

  const [token, setToken] = useState<string | null>(null);
  const [course, setCourse] = useState<CourseManage | null>(null);
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [cohortTitle, setCohortTitle] = useState("");
  const [cohortCap, setCohortCap] = useState<string>("");

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [router, pathname]);

  const load = useCallback(
    async (t: string) => {
      setError(null);
      const r = await apiFetch<{ course: CourseManage; cohorts: CohortRow[] }>(
        `/v1/courses/${courseId}/manage`,
        { token: t },
      );
      setCourse(r.course);
      setCohorts(r.cohorts);
    },
    [courseId],
  );

  useEffect(() => {
    if (!token || !courseId) return;
    load(token).catch((e) => {
      const msg = e instanceof Error ? e.message : "load_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
        return;
      }
      if (msg.includes("[403]")) {
        setError("Bu kursu yönetme izniniz yok.");
      }
    });
  }, [token, courseId, load, router, pathname]);

  async function createCohort() {
    if (!token) return;
    const title = cohortTitle.trim();
    if (title.length < 3) {
      setError("Grup başlığı en az 3 karakter olmalı.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const cap = cohortCap.trim() ? Number(cohortCap) : null;
      await apiFetch(`/v1/courses/${courseId}/cohorts`, {
        method: "POST",
        token,
        body: JSON.stringify({
          title,
          capacity: cap != null && Number.isFinite(cap) ? cap : null,
        }),
      });
      setCohortTitle("");
      setCohortCap("");
      await load(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "create_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Bu kursa grup ekleme izniniz yok.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function patchCohort(cohortId: string, body: Record<string, unknown>) {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/v1/courses/${courseId}/cohorts/${cohortId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(body),
      });
      await load(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "update_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Bu grubu güncelleme izniniz yok.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (!token) return null;
  if (!course && !error) {
    return (
      <div className="min-h-screen bg-paper-50 px-6 py-10 text-sm text-paper-800/75">Yükleniyor…</div>
    );
  }

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div>
          <Link
            href="/teacher/kurslar"
            className="text-sm font-medium text-brand-800 underline decoration-brand-400 underline-offset-4"
          >
            ← Kurs listesi
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-paper-900">
            {course?.title ?? "Kurs"}
          </h1>
          {course && (
            <p className="mt-1 text-sm text-paper-800/75">
              {course.status} · {course.delivery_mode} · {minorToTl(course.price_minor)}{" "}
              {course.currency}
              {course.branch_name ? ` · ${course.branch_name}` : ""}
            </p>
          )}
          {course && (
            <p className="mt-2 text-sm">
              <Link
                href={`/courses/${course.id}`}
                className="text-paper-800/75 underline decoration-paper-300 underline-offset-4 hover:text-paper-900"
              >
                Vitrin sayfasını önizle
              </Link>
            </p>
          )}
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {course?.description ? (
          <p className="mt-6 rounded-xl border border-paper-200 bg-white p-4 text-sm text-paper-800 shadow-sm">
            {course.description}
          </p>
        ) : null}

        <section className="mt-10 rounded-xl border border-paper-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-paper-900">Yeni grup (cohort)</h2>
          <p className="mt-1 text-xs text-paper-800/55">
            Grup açtıktan sonra ders oturumlarını o grubun sayfasından ekleyebilirsiniz.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm">
              <span className="text-xs font-medium text-paper-800/75">Başlık</span>
              <input
                value={cohortTitle}
                onChange={(e) => setCohortTitle(e.target.value)}
                className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2 text-sm"
                placeholder="Örn. Şubat 2026 — Hafta içi akşam"
              />
            </label>
            <label className="w-full sm:w-32 text-sm">
              <span className="text-xs font-medium text-paper-800/75">Kontenjan</span>
              <input
                value={cohortCap}
                onChange={(e) => setCohortCap(e.target.value)}
                className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2 text-sm"
                placeholder="Boş"
                inputMode="numeric"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void createCohort()}
              className="rounded-xl bg-brand-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Grup oluştur
            </button>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-semibold text-paper-900">Gruplar</h2>
          <div className="mt-3 space-y-3">
            {cohorts.length === 0 ? (
              <div className="rounded-xl border border-paper-200 bg-white p-5 text-sm text-paper-800/75 shadow-sm">
                Henüz grup yok. Yukarıdan oluşturun.
              </div>
            ) : (
              cohorts.map((g) => (
                <div
                  key={g.id}
                  className="rounded-xl border border-paper-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-paper-900">{g.title}</div>
                      <div className="mt-1 text-xs text-paper-800/55">
                        {g.status} · {g.enrolled_count} kayıt · {g.session_count} oturum
                        {g.capacity != null ? ` · kontenjan ${g.capacity}` : ""}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/teacher/kurslar/${courseId}/cohort/${g.id}`}
                        className="rounded-xl bg-brand-800 px-3 py-2 text-sm font-medium text-white"
                      >
                        Ders oturumları
                      </Link>
                      {g.status === "planned" && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void patchCohort(g.id, { status: "active" })}
                          className="rounded-xl border border-brand-300 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-900 disabled:opacity-50"
                        >
                          Aktifleştir
                        </button>
                      )}
                      {g.status !== "completed" && g.status !== "cancelled" && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void patchCohort(g.id, { status: "completed" })}
                          className="rounded-xl border border-paper-200 bg-white px-3 py-2 text-sm font-medium text-paper-800 disabled:opacity-50"
                        >
                          Tamamlandı
                        </button>
                      )}
                      {g.status !== "cancelled" && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void patchCohort(g.id, { status: "cancelled" })}
                          className="rounded-xl border border-paper-200 bg-white px-3 py-2 text-sm font-medium text-paper-800/75 disabled:opacity-50"
                        >
                          İptal
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
