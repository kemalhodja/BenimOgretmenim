"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useRequireAdmin } from "../useRequireAdmin";

type ReqRow = {
  id: string;
  status: string;
  delivery_mode: string;
  created_at: string;
  expires_at: string | null;
  branch_name: string;
  student_display_name: string;
  student_email: string;
};

export default function AdminLessonRequestsPage() {
  const token = useRequireAdmin();
  const [status, setStatus] = useState("open");
  const [rows, setRows] = useState<ReqRow[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      if (status !== "") sp.set("status", status);
      sp.set("limit", "60");
      const r = await apiFetch<{ requests: ReqRow[]; summary: Record<string, number> }>(
        `/api/admin/lesson-requests?${sp.toString()}`,
        { token },
      );
      setRows(r.requests);
      setSummary(r.summary ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [token, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function cancelRequest(id: string) {
    if (!token) return;
    if (!window.confirm("Bu ders talebini iptal (cancelled) olarak işaretlemek istiyor musunuz?")) return;
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/api/admin/lesson-requests/${id}/status`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status: "cancelled" }),
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
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-sm font-medium text-zinc-500">Yönetim</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Ders talepleri</h1>
          <Link href="/admin" className="text-sm font-medium text-brand-800 underline">
            Özet
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(["", "open", "matched", "cancelled", "expired"] as const).map((st) => (
            <button
              key={st || "all"}
              type="button"
              onClick={() => setStatus(st)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                status === st ? "bg-zinc-900 text-white" : "border border-zinc-200 bg-white text-zinc-700"
              }`}
            >
              {st === "" ? "Tümü" : st}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-600">
          {Object.entries(summary).map(([k, v]) => (
            <span key={k} className="rounded-lg bg-zinc-100 px-2 py-1 capitalize">
              {k}: <strong className="tabular-nums text-zinc-900">{v}</strong>
            </span>
          ))}
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        ) : null}

        <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              <tr>
                <th className="px-3 py-2">Öğrenci</th>
                <th className="px-3 py-2">Branş</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">Teslim</th>
                <th className="px-3 py-2">Oluşturulma</th>
                <th className="px-3 py-2 font-mono text-[11px]">id</th>
                <th className="px-3 py-2">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-zinc-500">
                    Yükleniyor…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-zinc-500">
                    Kayıt yok.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-3 py-2">
                      <div className="font-medium text-zinc-900">{r.student_display_name}</div>
                      <div className="text-xs text-zinc-600">{r.student_email}</div>
                    </td>
                    <td className="px-3 py-2 text-zinc-700">{r.branch_name}</td>
                    <td className="px-3 py-2 capitalize text-zinc-700">{r.status}</td>
                    <td className="px-3 py-2 text-zinc-600">{r.delivery_mode}</td>
                    <td className="px-3 py-2 text-zinc-600">{new Date(r.created_at).toLocaleString("tr-TR")}</td>
                    <td className="max-w-[7rem] truncate px-3 py-2 font-mono text-[11px] text-zinc-500">{r.id}</td>
                    <td className="px-3 py-2">
                      {(r.status === "open" || r.status === "matched") && (
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => void cancelRequest(r.id)}
                          className="rounded border border-red-200 px-2 py-1 text-xs text-red-800 disabled:opacity-40"
                        >
                          {busyId === r.id ? "…" : "İptal"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
