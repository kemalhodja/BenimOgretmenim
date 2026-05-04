"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useRequireAdmin } from "../useRequireAdmin";

type Row = {
  id: string;
  status: string;
  topic_text: string;
  planned_start: string;
  total_price_minor: number;
  currency: string;
  created_at: string;
  creator_display_name: string;
  creator_email: string;
};

const STATUSES = ["open", "teacher_assigned", "scheduled", "completed", "cancelled"] as const;

export default function AdminGroupLessonsPage() {
  const token = useRequireAdmin();
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 40;
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      sp.set("limit", String(limit));
      sp.set("offset", String(offset));
      const r = await apiFetch<{ requests: Row[]; total: number }>(
        `/api/admin/group-lesson-requests?${sp.toString()}`,
        { token },
      );
      setRows(r.requests);
      setTotal(r.total);
      const d: Record<string, string> = {};
      for (const x of r.requests) d[x.id] = x.status;
      setDraft(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [token, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchStatus(id: string, status: string) {
    if (!token) return;
    if (!window.confirm(`Talep ${id.slice(0, 8)}… durumu "${status}" olarak güncellensin mi?`)) return;
    setBusy(id);
    setError(null);
    try {
      await apiFetch(`/api/admin/group-lesson-requests/${id}/status`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status }),
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
        <div className="mt-1 flex flex-wrap justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Grup ders talepleri</h1>
          <Link href="/admin/merkez" className="text-sm font-medium text-brand-800 underline">
            Merkez
          </Link>
        </div>
        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        ) : null}
        <p className="mt-3 text-xs text-zinc-500">Toplam {total}</p>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
          {loading ? (
            <p className="p-6 text-sm text-zinc-500">Yükleniyor…</p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase text-zinc-600">
                <tr>
                  <th className="px-3 py-2">Konu</th>
                  <th className="px-3 py-2">Oluşturan</th>
                  <th className="px-3 py-2">Plan</th>
                  <th className="px-3 py-2">Durum</th>
                  <th className="px-3 py-2">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-100">
                    <td className="px-3 py-2 font-medium text-zinc-900">{r.topic_text}</td>
                    <td className="px-3 py-2 text-zinc-700">
                      {r.creator_display_name}
                      <div className="text-xs text-zinc-500">{r.creator_email}</div>
                    </td>
                    <td className="px-3 py-2 text-zinc-600">{new Date(r.planned_start).toLocaleString("tr-TR")}</td>
                    <td className="px-3 py-2 capitalize text-zinc-700">{r.status}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1">
                        <select
                          className="rounded border border-zinc-200 px-1 py-1 text-xs capitalize"
                          value={draft[r.id] ?? r.status}
                          onChange={(e) => setDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={busy === r.id || (draft[r.id] ?? r.status) === r.status}
                          onClick={() => void patchStatus(r.id, draft[r.id] ?? r.status)}
                          className="rounded bg-zinc-900 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40"
                        >
                          {busy === r.id ? "…" : "Kaydet"}
                        </button>
                        <button
                          type="button"
                          disabled={busy === r.id || r.status === "cancelled"}
                          onClick={() => void patchStatus(r.id, "cancelled")}
                          className="rounded border border-red-200 px-2 py-1 text-xs text-red-800 disabled:opacity-40"
                        >
                          İptal
                        </button>
                      </div>
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
