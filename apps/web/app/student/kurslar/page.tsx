"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { clearToken, getToken } from "../../lib/auth";

type EnrollmentRow = {
  enrollment_id: string;
  enrolled_at: string;
  course_id: string;
  course_title: string;
  course_status: string;
  cohort_id: string;
  cohort_title: string;
  cohort_status: string;
  teacher_display_name: string;
  next_session_id: string | null;
  next_session_index: number | null;
  next_session_title: string | null;
  next_scheduled_start: string | null;
  next_meeting_url: string | null;
};

function toLocal(dt: string | null): string {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("tr-TR");
}

export default function StudentKurslarPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [rows, setRows] = useState<EnrollmentRow[]>([]);
  const [error, setError] = useState<string | null>(null);

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
    const r = await apiFetch<{ enrollments: EnrollmentRow[] }>("/v1/courses/student/mine", {
      token: t,
    });
    setRows(r.enrollments);
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

  if (!token) return null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-zinc-500">Öğrenci</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
              Kurslarım
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Kayıtlı olduğunuz gruplar ve canlı ders oturumları.
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
              href="/courses"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Kurs keşfet
            </Link>
            <Link
              href="/student/requests"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Ders talepleri
            </Link>
            <Link
              href="/student/dogrudan-dersler"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Doğrudan ders
            </Link>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-8 space-y-3">
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
              Henüz kurs kaydınız yok.{" "}
              <Link href="/courses" className="font-medium text-brand-800 underline">
                Kurslar
              </Link>{" "}
              sayfasından kayıt olabilirsiniz.
            </div>
          ) : (
            rows.map((e) => (
              <div
                key={e.enrollment_id}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">{e.course_title}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      Grup: {e.cohort_title} · {e.cohort_status} · Öğretmen: {e.teacher_display_name}
                    </div>
                    <div className="mt-2 text-xs text-zinc-600">
                      Sıradaki oturum:{" "}
                      {e.next_session_id ? (
                        <>
                          #{e.next_session_index}
                          {e.next_session_title ? ` · ${e.next_session_title}` : ""} ·{" "}
                          {toLocal(e.next_scheduled_start)}
                        </>
                      ) : (
                        "Henüz planlanmamış veya tamamlandı."
                      )}
                    </div>
                    {e.next_meeting_url ? (
                      <a
                        href={e.next_meeting_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-sm font-medium text-blue-700 underline"
                      >
                        Toplantı linki (sıradaki)
                      </a>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                    <Link
                      href={`/student/kurslar/${e.course_id}/cohort/${e.cohort_id}`}
                      className="rounded-xl bg-zinc-900 px-3 py-2 text-center text-sm font-medium text-white"
                    >
                      Tüm oturumlar
                    </Link>
                    <Link
                      href={`/courses/${e.course_id}`}
                      className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-center text-sm font-medium text-zinc-800"
                    >
                      Kurs sayfası
                    </Link>
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
