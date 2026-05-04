"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useRequireAdmin } from "../useRequireAdmin";

type Cfg = {
  title: string;
  path: string;
  arrayKey: string;
};

const DATASETS: Record<string, Cfg> = {
  ledger: { title: "Cüzdan defteri", path: "/api/admin/wallet-ledger", arrayKey: "entries" },
  packages: { title: "Ders paketleri", path: "/api/admin/lesson-packages", arrayKey: "packages" },
  "teacher-subs": {
    title: "Öğretmen abonelikleri",
    path: "/api/admin/teacher-subscriptions",
    arrayKey: "subscriptions",
  },
  "wallet-topups": { title: "Cüzdan yüklemeleri", path: "/api/admin/wallet-topups", arrayKey: "topups" },
  "student-sub-payments": {
    title: "Öğrenci platform ödemeleri",
    path: "/api/admin/student-sub-payments",
    arrayKey: "payments",
  },
  enrollments: {
    title: "Kurs kayıtları",
    path: "/api/admin/course-enrollments",
    arrayKey: "enrollments",
  },
  notifications: {
    title: "Veli bildirimleri",
    path: "/api/admin/parent-notifications",
    arrayKey: "notifications",
  },
};

export default function AdminVeriPage() {
  const token = useRequireAdmin();
  const sp = useSearchParams();
  const key = sp.get("k") ?? "ledger";
  const cfg = DATASETS[key] ?? DATASETS.ledger;

  const [userIdFilter, setUserIdFilter] = useState("");
  const [appliedUserId, setAppliedUserId] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 40;

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", String(limit));
    p.set("offset", String(offset));
    if (key === "ledger" && appliedUserId.trim()) p.set("userId", appliedUserId.trim());
    return p.toString();
  }, [key, offset, appliedUserId]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const r = (await apiFetch(`${cfg.path}?${qs}`, { token })) as Record<string, unknown>;
      const arr = r[cfg.arrayKey];
      setRows(Array.isArray(arr) ? (arr as Record<string, unknown>[]) : []);
      setTotal(typeof r.total === "number" ? r.total : 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [token, cfg, qs]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setOffset(0);
  }, [key]);

  if (!token) return null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-sm font-medium text-zinc-500">Yönetim · veri</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{cfg.title}</h1>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href="/admin/merkez" className="font-medium text-brand-800 underline">
              Merkez
            </Link>
            <Link href="/admin" className="text-zinc-600 underline">
              Özet
            </Link>
          </div>
        </div>

        {key === "ledger" ? (
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <label className="text-sm">
              <span className="font-medium text-zinc-700">userId (UUID)</span>
              <input
                className="mt-1 block rounded-xl border border-zinc-200 px-3 py-2 font-mono text-xs"
                value={userIdFilter}
                onChange={(e) => setUserIdFilter(e.target.value)}
                placeholder="Filtre…"
              />
            </label>
            <button
              type="button"
              className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-semibold text-white"
              onClick={() => {
                setAppliedUserId(userIdFilter.trim());
                setOffset(0);
              }}
            >
              Uygula
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        ) : null}

        <p className="mt-3 text-xs text-zinc-500">
          Toplam {total} · gösterilen {rows.length} · offset {offset}
        </p>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
          {loading ? (
            <p className="p-6 text-sm text-zinc-500">Yükleniyor…</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-zinc-500">Kayıt yok.</p>
          ) : (
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-zinc-200 bg-zinc-50 font-semibold text-zinc-600">
                <tr>
                  {Object.keys(rows[0] ?? {}).map((col) => (
                    <th key={col} className="whitespace-nowrap px-2 py-2 font-mono">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-zinc-100 last:border-0">
                    {Object.keys(rows[0] ?? {}).map((col) => (
                      <td key={col} className="max-w-[14rem] truncate px-2 py-1.5 font-mono text-zinc-800">
                        {formatCell(row[col])}
                      </td>
                    ))}
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

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v).slice(0, 80);
  return String(v);
}
