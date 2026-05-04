"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../lib/api";
import { clearToken, getToken } from "../lib/auth";
import { loginHrefWithReturn } from "../lib/authRedirect";

type StudentRow = { student_id: string; student_display_name: string };

type ProgressRow = {
  snapshot_id: string;
  student_id: string;
  student_display_name: string;
  narrative_tr: string;
  created_at: string;
  teacher_display_name: string;
};

type NotifRow = {
  id: string;
  title: string;
  body: string;
  delivery_status: string;
  read_at: string | null;
  created_at: string;
  payload_jsonb?: unknown;
};

export default function GuardianPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [notifications, setNotifications] = useState<NotifRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [readBusy, setReadBusy] = useState<string | null>(null);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [router, pathname]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      setError(null);
      try {
        const [r, n] = await Promise.all([
          apiFetch<{ students: StudentRow[]; progress: ProgressRow[] }>(
            "/v1/guardians/overview",
            { token },
          ),
          apiFetch<{ notifications: NotifRow[] }>("/v1/notifications?limit=30", {
            token,
          }),
        ]);
        setStudents(r.students);
        setProgress(r.progress);
        setNotifications(n.notifications);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "load_failed";
        setError(msg);
        if (msg.includes("[401]")) {
          clearToken();
          router.replace(loginHrefWithReturn(pathname));
        }
        if (msg.includes("[403]")) {
          setError("Bu sayfa yalnızca veli hesabı içindir.");
        }
      }
    })();
  }, [token, router, pathname]);

  async function markRead(id: string) {
    if (!token) return;
    setReadBusy(id);
    try {
      await apiFetch(`/v1/notifications/${id}/read`, {
        method: "PATCH",
        token,
      });
      setNotifications((prev) =>
        prev.map((x) =>
          x.id === id
            ? { ...x, read_at: new Date().toISOString(), delivery_status: "read" }
            : x,
        ),
      );
    } catch {
      /* yoksay — tekrar dene */
    } finally {
      setReadBusy(null);
    }
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-zinc-500">Veli</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">Veli paneli</h1>
            <p className="mt-1 text-xs text-zinc-500">Öğrenci hesabı sizi veli olarak ekler.</p>
          </div>
          <Link
            href="/"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
          >
            Ana sayfa
          </Link>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="mt-8">
          <h2 className="text-base font-semibold text-zinc-900">Bağlı öğrenciler</h2>
          <div className="mt-3 space-y-2">
            {students.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
                Bağlı öğrenci yok. Öğrenci, veli hesabını bağlamalıdır.
              </div>
            ) : (
              students.map((s) => (
                <div
                  key={s.student_id}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-900 shadow-sm"
                >
                  {s.student_display_name}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-base font-semibold text-zinc-900">Bildirimler</h2>
          <p className="mt-1 text-xs text-zinc-500">Ders özeti ve ödev bildirimleri. Ödeme öğrenci hesabından.</p>
          <div className="mt-3 space-y-2">
            {notifications.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
                Bildirim yok.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`rounded-2xl border p-4 shadow-sm ${
                    n.read_at
                      ? "border-zinc-100 bg-zinc-50"
                      : "border-amber-200 bg-amber-50/40"
                  }`}
                >
                  <div className="text-sm font-semibold text-zinc-900">{n.title}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {new Date(n.created_at).toLocaleString("tr-TR")}
                    {n.read_at ? " · Okundu" : ""}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800">
                    {n.body}
                  </p>
                  {(() => {
                    const p = n.payload_jsonb;
                    if (!p || typeof p !== "object") return null;
                    const k = (p as { kind?: string }).kind;
                    if (
                      k === "homework_new_post_guardian" ||
                      k === "homework_claimed_guardian" ||
                      k === "homework_answered_guardian" ||
                      k === "homework_rewarded_guardian" ||
                      k === "homework_answer_rejected_guardian" ||
                      k === "homework_teacher_returned_guardian"
                    ) {
                      return (
                        <p className="mt-2 text-xs text-zinc-500">Detaylar öğrenci panelinde.</p>
                      );
                    }
                    return null;
                  })()}
                  {!n.read_at && (
                    <button
                      type="button"
                      disabled={readBusy === n.id}
                      onClick={() => void markRead(n.id)}
                      className="mt-3 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 disabled:opacity-50"
                    >
                      {readBusy === n.id ? "…" : "Okundu işaretle"}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-base font-semibold text-zinc-900">Ders özeti</h2>
          <p className="mt-1 text-xs text-zinc-500">Öğretmen ders sonu notu burada görünür.</p>
          <div className="mt-3 space-y-3">
            {progress.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
                Kayıt yok.
              </div>
            ) : (
              progress.map((p) => (
                <article
                  key={p.snapshot_id}
                  className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
                >
                  <div className="text-xs text-zinc-500">
                    {p.student_display_name} · {p.teacher_display_name} ·{" "}
                    {new Date(p.created_at).toLocaleString("tr-TR")}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800">
                    {p.narrative_tr}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
