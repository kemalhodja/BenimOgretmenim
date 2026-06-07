"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

function sessionStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    scheduled: "Planlandı",
    completed: "Tamamlandı",
    cancelled: "İptal edildi",
    missed: "Kaçırıldı",
  };
  return labels[status] ?? "Durum güncellendi";
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

  const stats = useMemo(() => {
    const planned = sessions.filter((session) => session.scheduled_start).length;
    const ready = sessions.filter((session) => session.meeting_url).length;
    return { planned, ready, waiting: Math.max(0, sessions.length - planned) };
  }, [sessions]);

  const nextSession = useMemo(
    () =>
      sessions
        .filter((session) => session.scheduled_start)
        .sort(
          (a, b) =>
            new Date(a.scheduled_start ?? 0).getTime() -
            new Date(b.scheduled_start ?? 0).getTime(),
        )[0] ?? sessions[0] ?? null,
    [sessions],
  );

  const nextAction =
    sessions.length === 0
      ? {
          title: "Öğretmen oturum planını hazırlıyor",
          body: "Dersler eklendiğinde takvim ve sınıf linkleri burada görünecek.",
          href: "/student/kurslar",
          label: "Kurslarıma dön",
        }
      : nextSession?.meeting_url
        ? {
            title: `Sıradaki canlı ders: #${nextSession.session_index}`,
            body: `${toLocal(nextSession.scheduled_start)} için sınıf linkiniz hazır.`,
            href: `/classroom/course/${nextSession.id}`,
            label: "Sınıfa gir",
          }
        : nextSession?.scheduled_start
          ? {
              title: `Sıradaki ders: #${nextSession.session_index}`,
              body: `${toLocal(nextSession.scheduled_start)} için planlandı. Sınıf linki öğretmen tarafından paylaşılacak.`,
              href: "/student/kurslar",
              label: "Kurslarıma dön",
            }
          : {
              title: "Oturum tarihi bekleniyor",
              body: "Öğretmen takvimi netleştirdiğinde bildirim alacaksınız.",
              href: "/student/kurslar",
              label: "Kurslarıma dön",
            };

  if (!token) return null;

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <Link
          href="/student/kurslar"
          className="text-sm font-medium text-brand-800 underline decoration-brand-400 underline-offset-4"
        >
          ← Kurslarım
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-paper-900">
          {cohortTitle || "Grup"}
        </h1>
        {courseTitle ? (
          <p className="mt-1 text-sm text-paper-800/75">
            Kurs: <span className="font-medium text-paper-800">{courseTitle}</span>
          </p>
        ) : null}
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link
            href={`/courses/${courseId}`}
            className="text-paper-800/75 underline decoration-paper-300 underline-offset-4 hover:text-paper-900"
          >
            Kurs vitrin sayfası
          </Link>
          <Link
            href="/student/panel"
            className="text-paper-800/75 underline decoration-paper-300 underline-offset-4 hover:text-paper-900"
          >
            Abonelik ve cüzdan
          </Link>
          <Link
            href="/student/requests"
            className="text-paper-800/75 underline decoration-paper-300 underline-offset-4 hover:text-paper-900"
          >
            Ders talepleri
          </Link>
        </p>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="mt-6 rounded-2xl border border-brand-200 bg-[linear-gradient(135deg,#ecfeff_0%,#ffffff_58%,#fff7ed_100%)] p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-900/70">Kurs ders asistanı</div>
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

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-paper-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-paper-800/55">Planlı oturum</div>
            <div className="mt-1 text-2xl font-semibold text-paper-900">{stats.planned}</div>
          </div>
          <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-brand-900/65">Sınıf linki hazır</div>
            <div className="mt-1 text-2xl font-semibold text-brand-950">{stats.ready}</div>
          </div>
          <div className="rounded-xl border border-warm-200 bg-warm-50/70 p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-warm-900/70">Tarih bekleyen</div>
            <div className="mt-1 text-2xl font-semibold text-warm-950">{stats.waiting}</div>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-semibold text-paper-900">Ders oturumları</h2>
          <p className="mt-1 text-xs text-paper-800/55">
            Tarih ve toplantı linki öğretmeniniz tarafından ayarlanır.
          </p>
          <div className="mt-3 space-y-3">
            {sessions.length === 0 ? (
              <div className="rounded-xl border border-paper-200 bg-white p-5 text-sm text-paper-800/75 shadow-sm">
                Henüz oturum eklenmemiş.
              </div>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  className="rounded-xl border border-paper-200 bg-white p-5 shadow-sm"
                >
                  <div className="text-sm font-semibold text-paper-900">
                    {s.session_index}. oturum
                    {s.title ? ` · ${s.title}` : ""}
                  </div>
                  <div className="mt-1 text-xs text-paper-800/55">
                    {sessionStatusLabel(s.status)} · {toLocal(s.scheduled_start)}
                    {s.duration_minutes ? ` · ${s.duration_minutes} dk` : ""}
                  </div>
                  {s.meeting_url ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Link
                        href={`/classroom/course/${s.id}`}
                        className="inline-block rounded-lg bg-brand-800 px-2.5 py-1.5 text-xs font-medium text-white"
                      >
                        Sınıfa gir
                      </Link>
                      <a
                        href={s.meeting_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block text-sm font-medium text-blue-700 underline"
                      >
                        Harici link
                      </a>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-paper-800/55">Toplantı linki henüz yok.</p>
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
