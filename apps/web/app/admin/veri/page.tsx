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
type ReconciliationSummary = {
  byStatus: { status: string; count: number; latest_at: string | null }[];
  issues30d: number;
  amountMismatches30d: number;
  unknownMerchantOids30d: number;
  failed30d: number;
  latestIssueAt: string | null;
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
  reconciliation: {
    title: "Ödeme mutabakatı",
    path: "/api/admin/payment-reconciliation",
    arrayKey: "events",
  },
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
  const [reconciliationStatus, setReconciliationStatus] = useState("");
  const [reconciliationSummary, setReconciliationSummary] = useState<ReconciliationSummary | null>(null);
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
    if (key === "reconciliation" && reconciliationStatus.trim()) p.set("status", reconciliationStatus.trim());
    return p.toString();
  }, [key, offset, appliedUserId, reconciliationStatus]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const r = (await apiFetch(`${cfg.path}?${qs}`, { token })) as Record<string, unknown>;
      const arr = r[cfg.arrayKey];
      setRows(Array.isArray(arr) ? (arr as Record<string, unknown>[]) : []);
      setTotal(typeof r.total === "number" ? r.total : 0);
      setReconciliationSummary(key === "reconciliation" ? parseReconciliationSummary(r.summary) : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [token, cfg, qs, key]);

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

        {key === "reconciliation" ? (
          <div className="mt-4 space-y-3">
            {reconciliationSummary ? (
              <div className="rounded-2xl border border-paper-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-paper-900">Mutabakat risk özeti</h2>
                    <p className="mt-1 text-xs text-paper-800/60">
                      Son 30 günde para güvenini etkileyen PayTR callback olayları.
                    </p>
                  </div>
                  <div className="text-xs text-paper-800/55">
                    Son risk:{" "}
                    {reconciliationSummary.latestIssueAt
                      ? new Date(reconciliationSummary.latestIssueAt).toLocaleString("tr-TR")
                      : "yok"}
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  {[
                    ["Toplam risk", reconciliationSummary.issues30d, "", "Tüm kritik olaylar"],
                    ["Tutar uyuşmazlığı", reconciliationSummary.amountMismatches30d, "amount_mismatch", "Bakiye/ödeme durdurulur"],
                    ["Bilinmeyen sipariş", reconciliationSummary.unknownMerchantOids30d, "unknown_merchant_oid", "PayTR kaydı eşleşmedi"],
                    ["Başarısız callback", reconciliationSummary.failed30d, "failed", "Ödeme başarısız döndü"],
                  ].map(([label, value, status, hint]) => (
                    <button
                      key={String(label)}
                      type="button"
                      onClick={() => {
                        setReconciliationStatus(String(status));
                        setOffset(0);
                      }}
                      className={`rounded-xl border p-3 text-left transition hover:border-brand-200 ${
                        Number(value) > 0 ? "border-amber-200 bg-amber-50 text-amber-950" : "border-emerald-200 bg-emerald-50 text-emerald-900"
                      }`}
                    >
                      <div className="text-xs font-semibold uppercase tracking-wide">{label}</div>
                      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
                      <div className="mt-1 text-xs opacity-80">{hint}</div>
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {reconciliationSummary.byStatus.map((item) => (
                    <button
                      key={item.status}
                      type="button"
                      onClick={() => {
                        setReconciliationStatus(item.status);
                        setOffset(0);
                      }}
                      className="rounded-full border border-paper-200 bg-paper-50 px-3 py-1 text-xs font-medium text-paper-800 hover:border-brand-200 hover:bg-brand-50"
                    >
                      {item.status}: {item.count}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-end gap-2 rounded-xl border border-paper-200 bg-white p-4 shadow-sm">
              <label className="text-sm">
                <span className="font-medium text-paper-800">Mutabakat durumu</span>
                <select
                  className="mt-1 block rounded-xl border border-paper-200 px-3 py-2 text-sm"
                  value={reconciliationStatus}
                  onChange={(e) => {
                    setReconciliationStatus(e.target.value);
                    setOffset(0);
                  }}
                >
                  <option value="">Tümü</option>
                  <option value="amount_mismatch">amount_mismatch</option>
                  <option value="unknown_merchant_oid">unknown_merchant_oid</option>
                  <option value="failed">failed</option>
                  <option value="matched">matched</option>
                </select>
              </label>
              <div className="max-w-xl text-xs leading-relaxed text-paper-800/60">
                PayTR callback olayları beklenen tutar, gelen tutar ve ödeme kaydıyla birlikte burada izlenir.
                Uyumsuz kayıtlar para güveni için öncelikli incelenmelidir.
              </div>
            </div>
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

function parseReconciliationSummary(v: unknown): ReconciliationSummary | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const byStatus = Array.isArray(r.byStatus)
    ? r.byStatus
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const row = item as Record<string, unknown>;
          return {
            status: typeof row.status === "string" ? row.status : "unknown",
            count: typeof row.count === "number" ? row.count : Number(row.count ?? 0),
            latest_at: typeof row.latest_at === "string" ? row.latest_at : null,
          };
        })
        .filter((item): item is ReconciliationSummary["byStatus"][number] => item !== null)
    : [];
  return {
    byStatus,
    issues30d: typeof r.issues30d === "number" ? r.issues30d : Number(r.issues30d ?? 0),
    amountMismatches30d:
      typeof r.amountMismatches30d === "number" ? r.amountMismatches30d : Number(r.amountMismatches30d ?? 0),
    unknownMerchantOids30d:
      typeof r.unknownMerchantOids30d === "number" ? r.unknownMerchantOids30d : Number(r.unknownMerchantOids30d ?? 0),
    failed30d: typeof r.failed30d === "number" ? r.failed30d : Number(r.failed30d ?? 0),
    latestIssueAt: typeof r.latestIssueAt === "string" ? r.latestIssueAt : null,
  };
}
