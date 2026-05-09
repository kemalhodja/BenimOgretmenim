"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useRequireAdmin } from "../useRequireAdmin";

type Row = {
  id: string;
  status: string;
  topic: string;
  created_at: string;
  student_name: string;
  student_email: string;
};

export default function AdminHomeworkPage() {
  const token = useRequireAdmin();
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 40;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      if (status) sp.set("status", status);
      sp.set("limit", String(limit));
      sp.set("offset", String(offset));
      const r = await apiFetch<{ posts: Row[]; total: number }>(`/api/admin/homework-posts?${sp.toString()}`, {
        token,
      });
      setRows(r.posts);
      setTotal(r.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [token, status, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  async function cancel(id: string) {
    if (!token) return;
    if (!window.confirm("Bu gönderiyi iptal (cancelled) olarak işaretlemek istiyor musunuz?")) return;
    setBusy(id);
    setError(null);
    try {
      await apiFetch(`/api/admin/homework-posts/${id}/status`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status: "cancelled" }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "hata");
    } finally {
      setBusy(null);
    }
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mt-1 flex justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Ödev / soru gönderileri</h1>
          <Link
            href="/admin/merkez"
            className="text-sm font-medium text-brand-800 underline decoration-brand-400 underline-offset-4"
          >
            Merkez
          </Link>
        </div>
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
            <option value="open">open</option>
            <option value="claimed">claimed</option>
            <option value="answered">answered</option>
            <option value="closed">closed</option>
            <option value="cancelled">cancelled</option>
          </select>
        </label>
        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        ) : null}
        <p className="mt-3 text-xs text-paper-800/55">Toplam {total}</p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-paper-200 bg-white shadow-sm">
          {loading ? (
            <p className="p-6 text-sm">Yükleniyor…</p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-paper-200 bg-paper-50 text-xs font-semibold uppercase text-paper-800/75">
                <tr>
                  <th className="px-3 py-2">Öğrenci</th>
                  <th className="px-3 py-2">Konu</th>
                  <th className="px-3 py-2">Durum</th>
                  <th className="px-3 py-2">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-paper-100">
                    <td className="px-3 py-2">
                      {r.student_name}
                      <div className="text-xs text-paper-800/55">{r.student_email}</div>
                    </td>
                    <td className="max-w-[12rem] truncate px-3 py-2">{r.topic}</td>
                    <td className="px-3 py-2 capitalize">{r.status}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        disabled={busy === r.id || r.status === "cancelled" || r.status === "closed"}
                        onClick={() => void cancel(r.id)}
                        className="rounded border border-red-200 px-2 py-1 text-xs text-red-800 disabled:opacity-40"
                      >
                        {busy === r.id ? "…" : "İptal"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
