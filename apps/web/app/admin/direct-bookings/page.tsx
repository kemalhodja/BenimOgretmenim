"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useRequireAdmin } from "../useRequireAdmin";

type Row = {
  id: string;
  status: string;
  agreed_amount_minor: number;
  currency: string;
  created_at: string;
  student_name: string;
  student_email: string;
  teacher_name: string;
  teacher_email: string;
  dispute_reason: string | null;
  quality_status: string | null;
};

function statusClass(status: string): string {
  if (status === "disputed") return "bg-red-50 text-red-800";
  if (status === "funded") return "bg-amber-50 text-amber-900";
  if (status === "completed") return "bg-brand-50 text-brand-900";
  if (status === "cancelled") return "bg-paper-100 text-paper-700";
  return "bg-paper-100 text-paper-800";
}

function bookingStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending_funding: "Ödeme bekliyor",
    funded: "Ödeme alındı",
    completed: "Tamamlandı",
    disputed: "Uyuşmazlık var",
    cancelled: "İptal edildi",
  };
  return labels[status] ?? status;
}

function qualityStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    not_reviewed: "İnceleme bekliyor",
    accepted: "Kabul edildi",
    revision_requested: "Revizyon istendi",
    flagged: "İşaretlendi",
  };
  return labels[status] ?? status;
}

export default function AdminDirectBookingsPage() {
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
      const r = await apiFetch<{ bookings: Row[]; total: number }>(
        `/api/admin/direct-bookings?${sp.toString()}`,
        { token },
      );
      setRows(r.bookings);
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
    if (!window.confirm("Bu anlaşmayı iptal edildi olarak işaretlemek istiyor musunuz?")) return;
    setBusy(id);
    setError(null);
    try {
      await apiFetch(`/api/admin/direct-bookings/${id}/status`, {
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
          <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Doğrudan ders anlaşmaları</h1>
          <Link
            href="/admin/merkez"
            className="text-sm font-medium text-brand-800 underline decoration-brand-400 underline-offset-4"
          >
            Merkez
          </Link>
        </div>
        <label className="mt-4 block max-w-md text-sm">
          <span className="font-medium text-paper-800">Durum</span>
          <select
            className="mt-1 w-full rounded-xl border border-paper-200 bg-white px-3 py-2 text-sm"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">Tümü</option>
            <option value="pending_funding">Ödeme bekliyor</option>
            <option value="funded">Ödeme alındı</option>
            <option value="completed">Tamamlandı</option>
            <option value="disputed">Uyuşmazlık var</option>
            <option value="cancelled">İptal edildi</option>
          </select>
        </label>
        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        ) : null}
        <p className="mt-3 text-xs text-paper-800/55">Toplam {total}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-paper-200 bg-white p-3 text-sm shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-paper-800/55">Uyuşmazlık</div>
            <div className="mt-1 text-xl font-semibold text-red-800">
              {rows.filter((r) => r.status === "disputed").length}
            </div>
          </div>
          <div className="rounded-xl border border-paper-200 bg-white p-3 text-sm shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-paper-800/55">Fonlandı</div>
            <div className="mt-1 text-xl font-semibold text-amber-900">
              {rows.filter((r) => r.status === "funded").length}
            </div>
          </div>
          <div className="rounded-xl border border-paper-200 bg-white p-3 text-sm shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-paper-800/55">Sayfa tutarı</div>
            <div className="mt-1 text-xl font-semibold text-paper-900">
              {(rows.reduce((sum, r) => sum + Number(r.agreed_amount_minor || 0), 0) / 100).toFixed(2)} TL
            </div>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-paper-200 bg-white shadow-sm">
          {loading ? (
            <p className="p-6 text-sm">Yükleniyor…</p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-paper-200 bg-paper-50 text-xs font-semibold uppercase text-paper-800/75">
                <tr>
                  <th className="px-3 py-2">Öğrenci</th>
                  <th className="px-3 py-2">Öğretmen</th>
                  <th className="px-3 py-2">Tutar</th>
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
                    <td className="px-3 py-2">
                      {r.teacher_name}
                      <div className="text-xs text-paper-800/55">{r.teacher_email}</div>
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {(r.agreed_amount_minor / 100).toFixed(2)} {r.currency}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(r.status)}`}>
                        {bookingStatusLabel(r.status)}
                      </span>
                      {r.quality_status ? (
                        <div className="mt-1 text-xs text-paper-800/55">
                          Kalite: {qualityStatusLabel(r.quality_status)}
                        </div>
                      ) : null}
                      {r.dispute_reason ? (
                        <div className="mt-1 max-w-[14rem] text-xs text-red-800">
                          {r.dispute_reason}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        disabled={
                          busy === r.id || r.status === "cancelled" || r.status === "completed"
                        }
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
