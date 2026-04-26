"use client";

import { useCallback, useEffect, useState } from "react";
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
};

function minorToTl(n: number): string {
  return (n / 100).toFixed(2);
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

  if (!token) return null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-zinc-500">Öğretmen</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
              Kurslar (online dershane)
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Kurs oluşturun, yayınlayın; cohort açıp öğrencileri kaydedin.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/teacher/kurslar/yeni"
              className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
            >
              Yeni kurs
            </Link>
            <Link
              href="/teacher/dersler"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Ders oturumları
            </Link>
            <Link
              href="/teacher/cuzdan"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Cüzdan
            </Link>
            <Link
              href="/teacher/dogrudan-dersler"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Doğrudan dersler
            </Link>
            <Link
              href="/teacher"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Panele dön
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
              Henüz kurs yok. “Yeni kurs” ile başlayın.
            </div>
          ) : (
            rows.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">{c.title}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {c.status} · {c.delivery_mode} · {c.branch_name ?? "—"} ·{" "}
                      {minorToTl(c.price_minor)} {c.currency}
                    </div>
                    <div className="mt-1 text-[11px] font-mono text-zinc-400">{c.id}</div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link
                      href={`/teacher/kurslar/${c.id}`}
                      className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                    >
                      Yönet
                    </Link>
                    <Link
                      href={`/courses/${c.id}`}
                      className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                    >
                      Public sayfa
                    </Link>
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
                        className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 disabled:opacity-50"
                      >
                        Taslak
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busyId === c.id}
                      onClick={() => void setStatus(c.id, "archived")}
                      className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 disabled:opacity-50"
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

