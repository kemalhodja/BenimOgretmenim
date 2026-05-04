"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../../../../lib/api";
import { loginHrefWithReturn } from "../../../../../lib/authRedirect";
import { clearToken, getToken } from "../../../../../lib/auth";

type SessionRow = {
  id: string;
  session_index: number;
  title: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  duration_minutes: number | null;
  delivery_mode: string;
  meeting_url: string | null;
  status: string;
};

function toLocal(dt: string | null): string {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("tr-TR");
}

export default function StudentCohortSessionsPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const params = useParams<{ courseId: string; cohortId: string }>();
  const { courseId, cohortId } = params;

  const [token, setToken] = useState<string | null>(null);
  const [cohortTitle, setCohortTitle] = useState("");
  const [courseTitle, setCourseTitle] = useState("");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [error, setError] = useState<string | null>(null);

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
      const [d, s] = await Promise.all([
        apiFetch<{ cohort: { title: string; course_title: string } }>(
          `/v1/courses/${courseId}/cohorts/${cohortId}`,
          { token: t },
        ),
        apiFetch<{ sessions: SessionRow[] }>(
          `/v1/courses/${courseId}/cohorts/${cohortId}/sessions`,
          { token: t },
        ),
      ]);
      setCohortTitle(d.cohort.title);
      setCourseTitle(d.cohort.course_title);
      setSessions(s.sessions);
    },
    [courseId, cohortId],
  );

  useEffect(() => {
    if (!token || !courseId || !cohortId) return;
    load(token).catch((e) => {
      const msg = e instanceof Error ? e.message : "load_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
        return;
      }
      if (msg.includes("[403]")) {
        setError(
          "Bu gruba erişim izniniz yok (kayıtlı değilseniz önce kursa kayıt olun).",
        );
      }
    });
  }, [token, courseId, cohortId, load, router, pathname]);

  if (!token) return null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <p className="text-sm font-medium text-zinc-500">Öğrenci · grup oturumları</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
          {cohortTitle || "Grup"}
        </h1>
        {courseTitle ? (
          <p className="mt-1 text-sm text-zinc-600">
            Kurs: <span className="font-medium text-zinc-800">{courseTitle}</span>
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/student/kurslar"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
          >
            Kurslarıma dön
          </Link>
          <Link
            href={`/courses/${courseId}`}
            className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
          >
            Kurs sayfası
          </Link>
          <Link
            href="/student/panel"
            className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 shadow-sm"
          >
            Abonelik & cüzdan
          </Link>
          <Link
            href="/student/requests"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
          >
            Ders talepleri
          </Link>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="mt-8">
          <h2 className="text-sm font-semibold text-zinc-900">Ders oturumları</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Tarih ve toplantı linki öğretmeniniz tarafından ayarlanır.
          </p>
          <div className="mt-3 space-y-3">
            {sessions.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600 shadow-sm">
                Henüz oturum eklenmemiş.
              </div>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
                >
                  <div className="text-sm font-semibold text-zinc-900">
                    #{s.session_index}
                    {s.title ? ` · ${s.title}` : ""}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {s.status} · {toLocal(s.scheduled_start)}
                    {s.duration_minutes ? ` · ${s.duration_minutes} dk` : ""}
                  </div>
                  {s.meeting_url ? (
                    <a
                      href={s.meeting_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-sm font-medium text-blue-700 underline"
                    >
                      Toplantıya katıl
                    </a>
                  ) : (
                    <p className="mt-2 text-xs text-zinc-500">Toplantı linki henüz yok.</p>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
