"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { clearToken, getToken } from "../../lib/auth";

type ReviewableSession = {
  lesson_session_id: string;
  session_index: number;
  scheduled_start: string | null;
  actual_end: string | null;
  status: string;
  package_id: string;
  teacher_id: string;
  teacher_display_name: string;
};

type PastReview = {
  review_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  lesson_session_id: string;
  session_index: number;
  teacher_id: string;
  teacher_display_name: string;
};

export default function StudentDerslerPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ReviewableSession[]>([]);
  const [pastReviews, setPastReviews] = useState<PastReview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});

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
    setOk(null);
    const [r, past] = await Promise.all([
      apiFetch<{ sessions: ReviewableSession[] }>("/v1/lesson-sessions/reviewable", {
        token: t,
      }),
      apiFetch<{ reviews: PastReview[] }>("/v1/lesson-sessions/my-reviews", {
        token: t,
      }),
    ]);
    setSessions(r.sessions);
    setPastReviews(past.reviews);
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
        setError("Bu sayfa yalnızca öğrenci hesabı içindir.");
      }
    });
  }, [token, load, router, pathname]);

  async function submitReview(sessionId: string) {
    if (!token) return;
    const rating = ratings[sessionId];
    if (rating == null || rating < 1 || rating > 5) {
      setError("Lütfen 1–5 arası bir puan seçin.");
      return;
    }
    setBusyId(sessionId);
    setError(null);
    setOk(null);
    try {
      await apiFetch(`/v1/lesson-sessions/${sessionId}/review`, {
        method: "POST",
        token,
        body: JSON.stringify({
          rating,
          comment: comments[sessionId]?.trim() || null,
        }),
      });
      setOk("Yorumunuz kaydedildi; öğretmen profilinde görünür.");
      await load(token);
      setRatings((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
      setComments((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "submit_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Bu ders oturumuna yorum bırakma izniniz yok.");
      }
    } finally {
      setBusyId(null);
    }
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-zinc-500">Öğrenci</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
              Tamamlanan dersler · yorum
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Tamamlanan oturumlara yıldız ve kısa yorum bırakın; öğretmen profilinde
              adınız gizlenerek gösterilir.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
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
              Taleplerim
            </Link>
            <Link
              href="/student/dogrudan-dersler"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Doğrudan ders
            </Link>
            <Link
              href="/student/kurslar"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Kurslarım
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
            {ok}
          </div>
        )}

        <div className="mt-8 space-y-4">
          <h2 className="text-base font-semibold text-zinc-900">Yorum bekleyen dersler</h2>
          {sessions.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
              Yorum yazılabilecek tamamlanmış ders yok. Paketinizdeki dersler tamamlandıkça
              burada listelenir.
            </div>
          ) : (
            sessions.map((s) => {
              const when =
                s.actual_end ?? s.scheduled_start ?? null;
              const whenLabel = when
                ? new Date(when).toLocaleString("tr-TR")
                : "—";
              return (
                <div
                  key={s.lesson_session_id}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">
                        {s.teacher_display_name}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        Ders #{s.session_index} · {whenLabel}
                      </div>
                      <Link
                        href={`/ogretmenler/${s.teacher_id}`}
                        className="mt-2 inline-block text-xs font-medium text-brand-800 underline"
                      >
                        Öğretmen profili
                      </Link>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="text-xs font-medium text-zinc-600">Puan:</span>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        disabled={busyId === s.lesson_session_id}
                        onClick={() =>
                          setRatings((prev) => ({
                            ...prev,
                            [s.lesson_session_id]: n,
                          }))
                        }
                        className={`rounded-lg px-2.5 py-1 text-sm font-medium ${
                          ratings[s.lesson_session_id] === n
                            ? "bg-brand-700 text-white"
                            : "border border-zinc-200 bg-zinc-50 text-zinc-800 hover:bg-zinc-100"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <label className="mt-3 block">
                    <span className="text-xs font-medium text-zinc-600">
                      Yorum (isteğe bağlı)
                    </span>
                    <textarea
                      value={comments[s.lesson_session_id] ?? ""}
                      disabled={busyId === s.lesson_session_id}
                      onChange={(e) =>
                        setComments((prev) => ({
                          ...prev,
                          [s.lesson_session_id]: e.target.value,
                        }))
                      }
                      rows={3}
                      className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                      placeholder="Kısa geri bildiriminiz…"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busyId === s.lesson_session_id}
                    onClick={() => void submitReview(s.lesson_session_id)}
                    className="mt-3 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {busyId === s.lesson_session_id ? "Gönderiliyor…" : "Yorumu gönder"}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {pastReviews.length > 0 && (
          <div className="mt-10">
            <h2 className="text-base font-semibold text-zinc-900">Gönderdiğim yorumlar</h2>
            <ul className="mt-3 space-y-3">
              {pastReviews.map((pr) => (
                <li
                  key={String(pr.review_id)}
                  className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-zinc-900">
                      {pr.teacher_display_name} · ders #{pr.session_index}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {new Date(pr.created_at).toLocaleString("tr-TR")}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-amber-800">★ {pr.rating} / 5</div>
                  {pr.comment && (
                    <p className="mt-2 whitespace-pre-wrap text-zinc-700">{pr.comment}</p>
                  )}
                  <Link
                    href={`/ogretmenler/${pr.teacher_id}`}
                    className="mt-2 inline-block text-xs font-medium text-brand-800 underline"
                  >
                    Öğretmen profili
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
