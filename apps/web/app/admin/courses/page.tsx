"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useRequireAdmin } from "../useRequireAdmin";

type CourseRow = {
  id: string;
  title: string;
  status: string;
  price_minor: number;
  currency: string;
  created_at: string;
  delivery_mode: string;
  teacher_display_name: string;
  teacher_email: string;
  teacher_id: string;
};

export default function AdminCoursesPage() {
  const token = useRequireAdmin();
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 40;
  const [rows, setRows] = useState<CourseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      if (status) sp.set("status", status);
      sp.set("limit", String(limit));
      sp.set("offset", String(offset));
      const r = await apiFetch<{ courses: CourseRow[]; total: number }>(
        `/api/admin/courses?${sp.toString()}`,
        { token },
      );
      setRows(r.courses);
      setTotal(r.total);
      const d: Record<string, string> = {};
      for (const x of r.courses) d[x.id] = x.status;
      setDraft(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [token, status, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveStatus(courseId: string, next: string) {
    if (!token) return;
    if (!window.confirm(`Kurs durumu "${next}" olarak güncellensin mi?`)) return;
    setBusyId(courseId);
    setError(null);
    try {
      await apiFetch(`/api/admin/courses/${courseId}/status`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status: next }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "hata");
    } finally {
      setBusyId(null);
    }
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Kurslar</h1>
          <Link
            href="/admin/merkez"
            className="text-sm font-medium text-brand-800 underline decoration-brand-400 underline-offset-4"
          >
            Merkez
          </Link>
        </div>
        <p className="mt-2 text-sm text-paper-800/75">
          Tüm öğretmen kursları; durum filtresi. Halka açık liste:{" "}
          <Link href="/courses" className="text-brand-800 underline">
            /courses
          </Link>
        </p>

        <label className="mt-4 block max-w-sm text-sm">
          <span className="font-medium text-paper-800">Durum</span>
          <select
            className="mt-1 w-full rounded-xl border border-paper-200 bg-white px-3 py-2 text-sm capitalize"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">Tümü</option>
            <option value="published">published</option>
            <option value="draft">draft</option>
            <option value="archived">archived</option>
          </select>
        </label>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        ) : null}

        <p className="mt-3 text-xs text-paper-800/55">
          Toplam {total} · sayfa {Math.floor(offset / limit) + 1}
        </p>

        <div className="mt-4 overflow-x-auto rounded-xl border border-paper-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-paper-200 bg-paper-50 text-xs font-semibold uppercase tracking-wide text-paper-800/75">
              <tr>
                <th className="px-3 py-2">Başlık</th>
                <th className="px-3 py-2">Öğretmen</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">Fiyat</th>
                <th className="px-3 py-2">Tarih</th>
                <th className="px-3 py-2">Detay</th>
                <th className="px-3 py-2">Yönet</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-paper-800/55">
                    Yükleniyor…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-paper-800/55">
                    Kayıt yok.
                  </td>
                </tr>
              ) : (
                rows.map((c) => (
                  <tr key={c.id} className="border-b border-paper-100 last:border-0">
                    <td className="max-w-[14rem] px-3 py-2 font-medium text-paper-900">{c.title}</td>
                    <td className="px-3 py-2">
                      <div className="text-paper-900">{c.teacher_display_name}</div>
                      <div className="text-xs text-paper-800/75">{c.teacher_email}</div>
                    </td>
                    <td className="px-3 py-2 capitalize text-paper-800">{c.status}</td>
                    <td className="px-3 py-2 tabular-nums text-paper-800">
                      {(c.price_minor / 100).toFixed(2)} {c.currency}
                    </td>
                    <td className="px-3 py-2 text-paper-800/75">{new Date(c.created_at).toLocaleString("tr-TR")}</td>
                    <td className="px-3 py-2">
                      <Link href={`/courses/${c.id}`} className="text-brand-800 underline" target="_blank" rel="noreferrer">
                        Aç
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1">
                        <select
                          className="rounded border border-paper-200 px-1 py-1 text-xs capitalize"
                          value={draft[c.id] ?? c.status}
                          onChange={(e) => setDraft((d) => ({ ...d, [c.id]: e.target.value }))}
                        >
                          <option value="draft">draft</option>
                          <option value="published">published</option>
                          <option value="archived">archived</option>
                        </select>
                        <button
                          type="button"
                          disabled={busyId === c.id || (draft[c.id] ?? c.status) === c.status}
                          onClick={() => void saveStatus(c.id, draft[c.id] ?? c.status)}
                          className="rounded bg-brand-800 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40"
                        >
                          {busyId === c.id ? "…" : "Kaydet"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <nav className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm" aria-label="Sayfalama">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - limit))}
            className="font-medium text-brand-800 underline decoration-brand-400 underline-offset-4 disabled:cursor-not-allowed disabled:opacity-30 disabled:no-underline"
          >
            ← Önceki
          </button>
          <button
            type="button"
            disabled={offset + limit >= total}
            onClick={() => setOffset((o) => o + limit)}
            className="text-paper-800/75 underline decoration-paper-300 underline-offset-4 disabled:cursor-not-allowed disabled:opacity-30 disabled:no-underline"
          >
            Sonraki →
          </button>
        </nav>
      </div>
    </div>
  );
}
