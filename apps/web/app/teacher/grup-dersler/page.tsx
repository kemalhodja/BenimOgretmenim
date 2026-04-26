"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { clearToken, getToken } from "../../lib/auth";

type Row = {
  id: string;
  branch_id: number;
  branch_name: string | null;
  topic_text: string;
  teacher_id: string | null;
  total_price_minor: number;
  currency: string;
  planned_start: string;
  status: string;
  participants_count: number;
};

function tl(n: number): string {
  return (n / 100).toFixed(2);
}

function ceilDiv(a: number, b: number): number {
  return Math.floor((a + b - 1) / b);
}

function toLocal(dt: string): string {
  const d = new Date(dt);
  if (!Number.isFinite(d.getTime())) return dt;
  return d.toLocaleString("tr-TR");
}

export default function TeacherGroupLessonsPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
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
    const r = await apiFetch<{ requests: Row[] }>("/v1/group-lessons/teacher/open", { token: t });
    setRows(r.requests);
  }, []);

  useEffect(() => {
    if (!token) return;
    setError(null);
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

  async function accept(id: string) {
    if (!token) return;
    setBusyId(id);
    setError(null);
    setOk(null);
    try {
      await apiFetch(`/v1/group-lessons/${id}/teacher-accept`, { method: "POST", token });
      setOk("İlan kabul edildi.");
      await load(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "accept_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Bu ilanı kabul etme izniniz yok.");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function complete(id: string) {
    if (!token) return;
    if (!window.confirm("Ders bitti mi? Blokajlar serbest bırakılacak.")) return;
    setBusyId(id);
    setError(null);
    setOk(null);
    try {
      await apiFetch(`/v1/group-lessons/${id}/complete`, { method: "POST", token });
      setOk("Ders tamamlandı.");
      await load(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "complete_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Bu dersi tamamlama izniniz yok.");
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
              Grup ders ilanları
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Öğrencilerin açtığı ilanları kabul edin; ders bitince “tamamla” ile blokajları serbest
              bırakın.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/teacher/requests"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Açık talepler
            </Link>
            <Link
              href="/teacher"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Panel
            </Link>
          </div>
        </div>

        {(error || ok) && (
          <div
            className={`mt-6 rounded-2xl border p-4 text-sm ${
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-brand-200 bg-brand-50 text-brand-900"
            }`}
          >
            {error ?? ok}
          </div>
        )}

        <div className="mt-8 space-y-3">
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
              Şu an ilan yok.
            </div>
          ) : (
            rows.map((r) => {
              const count = Math.max(1, Number(r.participants_count ?? 1));
              const share = ceilDiv(Number(r.total_price_minor ?? 100000), count);
              return (
                <div
                  key={r.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">
                        {r.branch_name ?? `Branş #${r.branch_id}`} · {r.topic_text}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {toLocal(r.planned_start)} · {r.status}
                      </div>
                      <div className="mt-2 text-xs text-zinc-600">
                        Katılımcı: <span className="font-medium">{count}</span> · Kişi başı (şu an):{" "}
                        <span className="font-mono font-medium text-zinc-900">
                          {tl(share)} TL
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void accept(r.id)}
                        className="rounded-xl bg-brand-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {busyId === r.id ? "…" : "Kabul et"}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void complete(r.id)}
                        className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 disabled:opacity-50"
                      >
                        {busyId === r.id ? "…" : "Tamamla"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

