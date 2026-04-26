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

type EnrollmentRow = {
  id: string;
  enrolled_at: string;
  student_id: string;
  student_display_name: string;
};

function toLocal(dt: string | null): string {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("tr-TR");
}

function parseIsoLocalToUtcIso(input: string): string {
  const d = new Date(input);
  if (!Number.isFinite(d.getTime())) throw new Error("Tarih/saat geçersiz.");
  return d.toISOString();
}

export default function TeacherCohortSessionsPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const params = useParams<{ courseId: string; cohortId: string }>();
  const { courseId, cohortId } = params;

  const [token, setToken] = useState<string | null>(null);
  const [cohortTitle, setCohortTitle] = useState<string>("");
  const [courseTitle, setCourseTitle] = useState<string>("");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [whenBySession, setWhenBySession] = useState<Record<string, string>>({});
  const [durationBySession, setDurationBySession] = useState<Record<string, number>>({});

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [router, pathname]);

  const loadDetail = useCallback(
    async (t: string) => {
      const d = await apiFetch<{
        cohort: { title: string; course_title: string };
        enrollments: EnrollmentRow[];
      }>(`/v1/courses/${courseId}/cohorts/${cohortId}`, { token: t });
      setCohortTitle(d.cohort.title);
      setCourseTitle(d.cohort.course_title);
      setEnrollments(d.enrollments ?? []);
    },
    [courseId, cohortId],
  );

  const loadSessions = useCallback(
    async (t: string) => {
      const r = await apiFetch<{ sessions: SessionRow[] }>(
        `/v1/courses/${courseId}/cohorts/${cohortId}/sessions`,
        { token: t },
      );
      setSessions(r.sessions);
      const dur: Record<string, number> = {};
      for (const s of r.sessions) dur[s.id] = s.duration_minutes ?? 60;
      setDurationBySession((prev) => ({ ...dur, ...prev }));
    },
    [courseId, cohortId],
  );

  const loadAll = useCallback(
    async (t: string) => {
      setError(null);
      await loadDetail(t);
      await loadSessions(t);
    },
    [loadDetail, loadSessions],
  );

  useEffect(() => {
    if (!token || !courseId || !cohortId) return;
    loadAll(token).catch((e) => {
      const msg = e instanceof Error ? e.message : "load_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
        return;
      }
      if (msg.includes("[403]")) {
        setError("Bu gruba erişim izniniz yok.");
      }
    });
  }, [token, courseId, cohortId, loadAll, router, pathname]);

  async function addSession() {
    if (!token) return;
    setError(null);
    setOk(null);
    setBusy("new");
    try {
      await apiFetch(`/v1/courses/${courseId}/cohorts/${cohortId}/sessions`, {
        method: "POST",
        token,
        body: JSON.stringify({
          title: newTitle.trim() || null,
        }),
      });
      setNewTitle("");
      setOk("Oturum eklendi.");
      await loadSessions(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "add_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Bu gruba oturum ekleme izniniz yok.");
      }
    } finally {
      setBusy(null);
    }
  }

  async function scheduleSession(sessionId: string) {
    if (!token) return;
    const whenLocal = whenBySession[sessionId] ?? "";
    if (!whenLocal) {
      setError("Tarih/saat seçin.");
      return;
    }
    setError(null);
    setOk(null);
    const duration = durationBySession[sessionId] ?? 60;
    setBusy(sessionId);
    try {
      const scheduledStart = parseIsoLocalToUtcIso(whenLocal);
      await apiFetch(
        `/v1/courses/${courseId}/cohorts/${cohortId}/sessions/${sessionId}/schedule`,
        {
          method: "POST",
          token,
          body: JSON.stringify({ scheduledStart, durationMinutes: duration }),
        },
      );
      setOk("Plan güncellendi.");
      await loadSessions(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "schedule_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Bu oturumu planlama izniniz yok.");
      }
    } finally {
      setBusy(null);
    }
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="text-sm font-medium text-zinc-500">Öğretmen · Grup oturumları</div>
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
            href={`/teacher/kurslar/${courseId}`}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
          >
            Kursa dön
          </Link>
          <Link
            href="/teacher/kurslar"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
          >
            Tüm kurslar
          </Link>
          <Link
            href="/teacher/dersler"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
          >
            Ders oturumları
          </Link>
          <Link
            href="/teacher"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
          >
            Panel
          </Link>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
        {ok && (
          <div className="mt-6 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800">
            {ok}
          </div>
        )}

        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Kayıtlı öğrenciler</h2>
          {enrollments.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">Henüz kayıt yok.</p>
          ) : (
            <ul className="mt-3 space-y-1 text-sm text-zinc-800">
              {enrollments.map((e) => (
                <li key={e.id}>
                  {e.student_display_name}{" "}
                  <span className="text-xs text-zinc-500">
                    ({toLocal(e.enrolled_at)})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Yeni oturum</h2>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm">
              <span className="text-xs font-medium text-zinc-600">Başlık (isteğe bağlı)</span>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                placeholder="Örn. 1. ünite canlı ders"
              />
            </label>
            <button
              type="button"
              disabled={busy === "new"}
              onClick={() => void addSession()}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Oturum ekle
            </button>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-semibold text-zinc-900">Oturumlar</h2>
          <div className="mt-3 space-y-3">
            {sessions.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600 shadow-sm">
                Henüz oturum yok. Yukarıdan ekleyin.
              </div>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
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
                          Toplantı linki
                        </a>
                      ) : null}
                    </div>
                    <div className="flex w-full max-w-md flex-col gap-2">
                      <label className="text-xs font-medium text-zinc-600">
                        Başlangıç (yerel)
                        <input
                          type="datetime-local"
                          value={whenBySession[s.id] ?? ""}
                          onChange={(e) =>
                            setWhenBySession((prev) => ({ ...prev, [s.id]: e.target.value }))
                          }
                          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="text-xs font-medium text-zinc-600">
                        Süre (dk)
                        <input
                          type="number"
                          min={15}
                          max={240}
                          value={durationBySession[s.id] ?? 60}
                          onChange={(e) =>
                            setDurationBySession((prev) => ({
                              ...prev,
                              [s.id]: Number(e.target.value) || 60,
                            }))
                          }
                          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={busy === s.id}
                        onClick={() => void scheduleSession(s.id)}
                        className="rounded-xl bg-brand-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        Planla / güncelle
                      </button>
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
