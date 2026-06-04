"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { clearToken, getToken } from "../../lib/auth";

type CourseRow = {
  id: string;
  title: string;
  status: string;
  delivery_mode: string;
  language_code: string;
  price_minor: number;
  currency: string;
  branch_id: number | null;
  branch_name: string | null;
  created_at: string;
  updated_at: string;
  cohort_count: number;
  active_cohort_count: number;
  enrollment_count: number;
  next_session_id: string | null;
  next_session_index: number | null;
  next_session_title: string | null;
  next_scheduled_start: string | null;
  next_meeting_url: string | null;
  next_cohort_title: string | null;
};

function minorToTl(n: number): string {
  return (n / 100).toFixed(2);
}

function toLocal(dt: string | null): string {
  if (!dt) return "Planlanmadı";
  return new Date(dt).toLocaleString("tr-TR");
}

export default function TeacherKurslarPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [rows, setRows] = useState<CourseRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [router, pathname]);

  const load = useCallback(async (t: string) => {
    setError(null);
    const r = await apiFetch<{ courses: CourseRow[] }>("/v1/courses/mine", { token: t });
    setRows(r.courses);
  }, []);

  useEffect(() => {
    if (!token) return;
    load(token).catch((e) => {
      const msg = e instanceof Error ? e.message : "load_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
        return;
      }
      if (msg.includes("[403]")) {
        setError("Bu sayfa yalnızca öğretmen hesabı içindir.");
      }
    });
  }, [token, load, router, pathname]);

  async function setStatus(courseId: string, status: "draft" | "published" | "archived") {
    if (!token) return;
    setBusyId(courseId);
    setError(null);
    try {
      await apiFetch(`/v1/courses/${courseId}/status`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status }),
      });
      await load(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "status_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Bu kursun durumunu değiştirme izniniz yok.");
      }
    } finally {
      setBusyId(null);
    }
  }

  const stats = useMemo(() => {
    const published = rows.filter((course) => course.status === "published").length;
    const activeCohorts = rows.reduce((sum, course) => sum + Number(course.active_cohort_count ?? 0), 0);
    const enrollments = rows.reduce((sum, course) => sum + Number(course.enrollment_count ?? 0), 0);
    const scheduled = rows.filter((course) => course.next_session_id).length;
    return { published, activeCohorts, enrollments, scheduled };
  }, [rows]);

  const nextCourse = useMemo(
    () =>
      rows
        .filter((course) => course.next_session_id && course.next_scheduled_start)
        .sort(
          (a, b) =>
            new Date(a.next_scheduled_start ?? 0).getTime() -
            new Date(b.next_scheduled_start ?? 0).getTime(),
        )[0] ?? rows.find((course) => course.next_session_id) ?? null,
    [rows],
  );

  const nextAction =
    rows.length === 0
      ? {
          title: "İlk kursunuzu oluşturun",
          body: "Canlı dershane deneyimi için kurs, grup ve oturum planını tek akışta kurun.",
          href: "/teacher/kurslar/yeni",
          label: "Yeni kurs",
        }
      : nextCourse
        ? {
            title: `Sıradaki kurs oturumu: ${nextCourse.title}`,
            body: `${nextCourse.next_cohort_title ?? "Grup"} · ${toLocal(nextCourse.next_scheduled_start)}. Sınıf linki hazır olduğunda buradan açabilirsiniz.`,
            href: `/teacher/kurslar/${nextCourse.id}`,
            label: "Oturumu yönet",
          }
        : rows.some((course) => course.status !== "published")
          ? {
              title: "Yayınlanmamış kurslar var",
              body: "Hazır kursları yayınlayıp kayıt akışını başlatın; aktif gruplar görünürlüğü artırır.",
              href: "/teacher/kurslar/yeni",
              label: "Kursları düzenle",
            }
          : {
              title: "Yeni cohort ve oturum planlayın",
              body: "Yayınlanmış kurslar için grup açmak öğrenci kaydını ve canlı ders takvimini netleştirir.",
              href: "/teacher/kurslar/yeni",
              label: "Yeni kurs",
            };

  if (!token) return null;

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-paper-900">
              Kurslar (online dershane)
            </h1>
            <p className="mt-1 text-sm text-paper-800/75">
              Kurs oluşturun, yayınlayın; cohort açıp öğrencileri kaydedin.
            </p>
          </div>
          <Link
            href="/teacher/kurslar/yeni"
            className="rounded-xl bg-brand-800 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-900"
          >
            Yeni kurs
          </Link>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="mt-6 rounded-2xl border border-brand-200 bg-[linear-gradient(135deg,#ecfeff_0%,#ffffff_58%,#fff7ed_100%)] p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-900/70">Kurs operasyonu</div>
              <h2 className="mt-1 text-lg font-semibold text-paper-900">{nextAction.title}</h2>
              <p className="mt-1 max-w-2xl text-sm text-paper-800/70">{nextAction.body}</p>
            </div>
            <Link
              href={nextAction.href}
              className="w-fit rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-950 hover:bg-brand-100"
            >
              {nextAction.label}
            </Link>
          </div>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-paper-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-paper-800/55">Yayında kurs</div>
            <div className="mt-1 text-2xl font-semibold text-paper-900">{stats.published}</div>
          </div>
          <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-brand-900/65">Aktif grup</div>
            <div className="mt-1 text-2xl font-semibold text-brand-950">{stats.activeCohorts}</div>
          </div>
          <div className="rounded-xl border border-paper-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-paper-800/55">Kayıtlı öğrenci</div>
            <div className="mt-1 text-2xl font-semibold text-paper-900">{stats.enrollments}</div>
          </div>
          <div className="rounded-xl border border-warm-200 bg-warm-50/70 p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-warm-900/70">Planlı kurs</div>
            <div className="mt-1 text-2xl font-semibold text-warm-950">{stats.scheduled}</div>
          </div>
        </section>

        <div className="mt-8 space-y-3">
          {rows.length === 0 ? (
            <div className="rounded-xl border border-paper-200 bg-white p-6 text-sm text-paper-800/75 shadow-sm">
              Henüz kurs yok. “Yeni kurs” ile başlayın.
            </div>
          ) : (
            rows.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-paper-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-paper-900">{c.title}</div>
                    <div className="mt-1 text-xs text-paper-800/55">
                      {c.status} · {c.delivery_mode} · {c.branch_name ?? "—"} ·{" "}
                      {minorToTl(c.price_minor)} {c.currency}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-medium">
                      <span className="rounded-full bg-paper-100 px-2 py-0.5 text-paper-800">
                        {c.cohort_count} grup
                      </span>
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-900">
                        {c.enrollment_count} kayıt
                      </span>
                      {c.next_session_id ? (
                        <span className="rounded-full bg-warm-50 px-2 py-0.5 text-warm-900">
                          Sıradaki: {toLocal(c.next_scheduled_start)}
                        </span>
                      ) : null}
                    </div>
                    {c.next_session_id ? (
                      <div className="mt-2 text-xs text-paper-800/75">
                        {c.next_cohort_title ?? "Grup"} · Ders #{c.next_session_index}
                        {c.next_session_title ? ` · ${c.next_session_title}` : ""}
                      </div>
                    ) : null}
                    <div className="mt-1 text-[11px] font-mono text-paper-800/45">{c.id}</div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link
                      href={`/teacher/kurslar/${c.id}`}
                      className="rounded-xl bg-brand-800 px-3 py-2 text-sm font-medium text-white hover:bg-brand-900"
                    >
                      Yönet
                    </Link>
                    <Link
                      href={`/courses/${c.id}`}
                      className="rounded-xl border border-paper-300 bg-white px-3 py-2 text-sm font-medium text-paper-900 hover:bg-paper-50"
                    >
                      Public sayfa
                    </Link>
                    {c.next_session_id && (
                      <Link
                        href={`/classroom/course/${c.next_session_id}`}
                        className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-950 hover:bg-brand-100"
                      >
                        Sınıfı aç
                      </Link>
                    )}
                    {c.status !== "published" && (
                      <button
                        type="button"
                        disabled={busyId === c.id}
                        onClick={() => void setStatus(c.id, "published")}
                        className="rounded-xl bg-brand-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        Yayınla
                      </button>
                    )}
                    {c.status !== "draft" && (
                      <button
                        type="button"
                        disabled={busyId === c.id}
                        onClick={() => void setStatus(c.id, "draft")}
                        className="rounded-xl border border-paper-300 bg-white px-3 py-2 text-sm font-medium text-paper-800 disabled:opacity-50"
                      >
                        Taslak
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busyId === c.id}
                      onClick={() => void setStatus(c.id, "archived")}
                      className="rounded-xl border border-paper-300 bg-white px-3 py-2 text-sm font-medium text-paper-800 disabled:opacity-50"
                    >
                      Arşivle
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

