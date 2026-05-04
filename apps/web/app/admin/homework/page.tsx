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
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-sm font-medium text-zinc-500">Yönetim</p>
        <div className="mt-1 flex justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Ödev / soru gönderileri</h1>
          <Link href="/admin/merkez" className="text-sm font-medium text-brand-800 underline">
            Merkez
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {["", "open", "claimed", "answered", "closed", "cancelled"].map((s) => (
            <button
              key={s || "all"}
              type="button"
              onClick={() => {
                setStatus(s);
                setOffset(0);
              }}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                status === s ? "bg-zinc-900 text-white" : "border border-zinc-200 bg-white text-zinc-700"
              }`}
            >
              {s === "" ? "Tümü" : s}
            </button>
          ))}
        </div>
        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        ) : null}
        <p className="mt-3 text-xs text-zinc-500">Toplam {total}</p>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
          {loading ? (
            <p className="p-6 text-sm">Yükleniyor…</p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase text-zinc-600">
                <tr>
                  <th className="px-3 py-2">Öğrenci</th>
                  <th className="px-3 py-2">Konu</th>
                  <th className="px-3 py-2">Durum</th>
                  <th className="px-3 py-2">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-100">
                    <td className="px-3 py-2">
                      {r.student_name}
                      <div className="text-xs text-zinc-500">{r.student_email}</div>
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
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - limit))}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Önceki
          </button>
          <button
            type="button"
            disabled={offset + limit >= total}
            onClick={() => setOffset((o) => o + limit)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Sonraki
          </button>
        </div>
      </div>
    </div>
  );
}
