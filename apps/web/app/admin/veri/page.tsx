"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
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
  "guardian-invites": {
    title: "Veli davet kodları",
    path: "/api/admin/guardian-invites",
    arrayKey: "invites",
  },
  classroom: {
    title: "Sınıf notları ve tahta kayıtları",
    path: "/api/admin/classroom-notes",
    arrayKey: "notes",
  },
  recordings: {
    title: "Sınıf kayıtları ve tekrar izleme",
    path: "/api/admin/classroom-recordings",
    arrayKey: "recordings",
  },
  messages: {
    title: "Sınıf sohbet ve soru mesajları",
    path: "/api/admin/classroom-messages",
    arrayKey: "messages",
  },
  learning: {
    title: "Çalışma planı ve deneme kayıtları",
    path: "/api/admin/learning",
    arrayKey: "rows",
  },
  homework: {
    title: "Soru kalite kuyruğu",
    path: "/api/admin/homework-quality",
    arrayKey: "posts",
  },
};

export default function AdminVeriPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center bg-paper-50 text-sm text-paper-800/55">
          Yükleniyor…
        </div>
      }
    >
      <AdminVeriInner />
    </Suspense>
  );
}

function AdminVeriInner() {
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
  const [actionBusy, setActionBusy] = useState<string | null>(null);
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

  async function markHomeworkQuality(id: string, qualityStatus: "accepted" | "revision_requested" | "flagged") {
    if (!token) return;
    setActionBusy(`${id}:${qualityStatus}`);
    setError(null);
    try {
      await apiFetch(`/api/admin/homework-quality/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          qualityStatus,
          qualityScore: qualityStatus === "accepted" ? 5 : null,
          note:
            qualityStatus === "accepted"
              ? "Admin kalite kontrolünden geçti."
              : qualityStatus === "revision_requested"
                ? "Admin revizyon istedi."
                : "Admin inceleme için işaretledi.",
        }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "aksiyon başarısız");
    } finally {
      setActionBusy(null);
    }
  }

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-paper-900">{cfg.title}</h1>
          <p className="flex flex-wrap gap-x-4 text-sm">
            <Link
              href="/admin/merkez"
              className="font-medium text-brand-800 underline decoration-brand-400 underline-offset-4"
            >
              Merkez
            </Link>
            <Link
              href="/admin"
              className="text-paper-800/75 underline decoration-paper-300 underline-offset-4 hover:text-paper-900"
            >
              Özet
            </Link>
          </p>
        </div>

        {key === "ledger" ? (
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <label className="text-sm">
              <span className="font-medium text-paper-800">userId (UUID)</span>
              <input
                className="mt-1 block rounded-xl border border-paper-200 px-3 py-2 font-mono text-xs"
                value={userIdFilter}
                onChange={(e) => setUserIdFilter(e.target.value)}
                placeholder="Filtre…"
              />
            </label>
            <button
              type="button"
              className="rounded-xl bg-brand-800 px-3 py-2 text-sm font-semibold text-white"
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
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        ) : null}

        <p className="mt-3 text-xs text-paper-800/55">
          Toplam {total} · gösterilen {rows.length} · offset {offset}
        </p>

        <div className="mt-4 overflow-x-auto rounded-xl border border-paper-200 bg-white shadow-sm">
          {loading ? (
            <p className="p-6 text-sm text-paper-800/55">Yükleniyor…</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-paper-800/55">Kayıt yok.</p>
          ) : (
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-paper-200 bg-paper-50 font-semibold text-paper-800/75">
                <tr>
                  {Object.keys(rows[0] ?? {}).map((col) => (
                    <th key={col} className="whitespace-nowrap px-2 py-2 font-mono">
                      {col}
                    </th>
                  ))}
                  {key === "homework" ? <th className="whitespace-nowrap px-2 py-2">Aksiyon</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-paper-100 last:border-0">
                    {Object.keys(rows[0] ?? {}).map((col) => (
                      <td key={col} className="max-w-[14rem] truncate px-2 py-1.5 font-mono text-paper-800">
                        {formatCell(row[col])}
                      </td>
                    ))}
                    {key === "homework" ? (
                      <td className="whitespace-nowrap px-2 py-1.5">
                        <div className="flex flex-wrap gap-1">
                          {(["accepted", "revision_requested", "flagged"] as const).map((status) => {
                            const id = typeof row.id === "string" ? row.id : "";
                            return (
                              <button
                                key={status}
                                type="button"
                                disabled={!id || actionBusy === `${id}:${status}`}
                                onClick={() => void markHomeworkQuality(id, status)}
                                className="rounded border border-paper-200 bg-white px-2 py-1 text-[11px] font-medium text-paper-900 disabled:opacity-40"
                              >
                                {actionBusy === `${id}:${status}` ? "…" : status}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    ) : null}
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

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v).slice(0, 80);
  return String(v);
}
