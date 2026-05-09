"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useRequireAdmin } from "../useRequireAdmin";

type PayRow = {
  id: string;
  plan_code: string;
  method: string;
  state: string;
  amount_minor: number;
  currency: string;
  bank_ref: string | null;
  created_at: string;
  teacher_display_name: string;
  teacher_email: string;
};

export default function AdminSubscriptionPaymentsPage() {
  const token = useRequireAdmin();
  const [state, setState] = useState("");
  const [method, setMethod] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 40;
  const [rows, setRows] = useState<PayRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      if (state) sp.set("state", state);
      if (method) sp.set("method", method);
      sp.set("limit", String(limit));
      sp.set("offset", String(offset));
      const r = await apiFetch<{ payments: PayRow[]; total: number }>(
        `/api/admin/subscription-payments?${sp.toString()}`,
        { token },
      );
      setRows(r.payments);
      setTotal(r.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [token, state, method, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!token) return null;

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Öğretmen abonelik ödemeleri</h1>
          <Link
            href="/admin"
            className="text-sm font-medium text-brand-800 underline decoration-brand-400 underline-offset-4"
          >
            Özet
          </Link>
        </div>
        <p className="mt-2 text-sm text-paper-800/75">PayTR ve havale kayıtları; onay bekleyenler için Havale menüsünü kullanın.</p>

        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-paper-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
          <label className="block text-sm">
            <span className="font-medium text-paper-800">Durum</span>
            <select
              className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2 text-sm sm:min-w-[10rem]"
              value={state}
              onChange={(e) => {
                setState(e.target.value);
                setOffset(0);
              }}
            >
              <option value="">Tümü</option>
              <option value="pending">pending</option>
              <option value="paid">paid</option>
              <option value="failed">failed</option>
              <option value="cancelled">cancelled</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-paper-800">Yöntem</span>
            <select
              className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2 text-sm sm:min-w-[10rem]"
              value={method}
              onChange={(e) => {
                setMethod(e.target.value);
                setOffset(0);
              }}
            >
              <option value="">Tümü</option>
              <option value="bank_transfer">bank_transfer</option>
              <option value="paytr_iframe">paytr_iframe</option>
            </select>
          </label>
        </div>

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
                <th className="px-3 py-2">Öğretmen</th>
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">Yöntem</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">Tutar</th>
                <th className="px-3 py-2">Bank ref</th>
                <th className="px-3 py-2">Tarih</th>
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
                rows.map((p) => (
                  <tr key={p.id} className="border-b border-paper-100 last:border-0">
                    <td className="px-3 py-2">
                      <div className="font-medium text-paper-900">{p.teacher_display_name}</div>
                      <div className="text-xs text-paper-800/75">{p.teacher_email}</div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-paper-800">{p.plan_code}</td>
                    <td className="px-3 py-2 text-paper-800">{p.method}</td>
                    <td className="px-3 py-2 capitalize text-paper-800">{p.state}</td>
                    <td className="px-3 py-2 tabular-nums text-paper-800">
                      {(p.amount_minor / 100).toFixed(2)} {p.currency}
                    </td>
                    <td className="max-w-[8rem] truncate px-3 py-2 font-mono text-xs text-paper-800/75">
                      {p.bank_ref ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-paper-800/75">{new Date(p.created_at).toLocaleString("tr-TR")}</td>
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
