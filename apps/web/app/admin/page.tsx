"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminTrackingBoard } from "../components/admin/AdminTrackingBoard";
import { apiFetch } from "../lib/api";
import type { AdminOverviewCounts, AdminOverviewRevenue7d } from "../lib/adminRegistry";
import { ADMIN_MERKEZ, formatRevenueMinor } from "../lib/adminRegistry";
import { getAdminScopeFromSession } from "../lib/auth";
import { useRequireAdmin } from "./useRequireAdmin";

type Overview = {
  usersByRole: Record<string, number>;
  counts: AdminOverviewCounts;
  revenue7d?: AdminOverviewRevenue7d;
  generatedAt: string;
};

export default function AdminDashboardPage() {
  const token = useRequireAdmin();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const r = await apiFetch<Overview>("/api/admin/overview", { token });
        if (!cancelled) setData(r);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "yüklenemedi");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Operasyon özeti</h1>
          <p className="mt-1 max-w-2xl text-sm text-paper-800/75">
            Para, ders, destek, kalite ve sistem — takip edilmesi gereken tüm alanlar burada. Detaylı rehber için{" "}
            <Link href={ADMIN_MERKEZ} className="font-medium text-brand-800 underline underline-offset-4">
              kontrol merkezi
            </Link>
            .
          </p>
        </div>
        <Link
          href={ADMIN_MERKEZ}
          className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-900 hover:bg-brand-100"
        >
          Kontrol merkezi
        </Link>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      ) : null}

      {!data && !error ? <p className="mt-6 text-sm text-paper-800/55">Özet yükleniyor…</p> : null}

      {data ? (
        <>
          {data.revenue7d ? (
            <section className="mt-6 rounded-xl border border-brand-200 bg-brand-50/50 p-4">
              <h2 className="text-sm font-semibold text-paper-900">Son 7 gün gelir özeti</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-white/80 bg-white/90 px-3 py-2">
                  <div className="text-xs text-paper-800/55">Toplam</div>
                  <div className="text-lg font-semibold tabular-nums">{formatRevenueMinor(data.revenue7d.totalMinor)}</div>
                </div>
                <div className="rounded-lg border border-white/80 bg-white/90 px-3 py-2">
                  <div className="text-xs text-paper-800/55">Öğretmen abonelik</div>
                  <div className="text-lg font-semibold tabular-nums">{formatRevenueMinor(data.revenue7d.teacherSubscriptionsMinor)}</div>
                </div>
                <div className="rounded-lg border border-white/80 bg-white/90 px-3 py-2">
                  <div className="text-xs text-paper-800/55">Öğrenci abonelik</div>
                  <div className="text-lg font-semibold tabular-nums">{formatRevenueMinor(data.revenue7d.studentSubscriptionsMinor)}</div>
                </div>
                <div className="rounded-lg border border-white/80 bg-white/90 px-3 py-2">
                  <div className="text-xs text-paper-800/55">Cüzdan yükleme</div>
                  <div className="text-lg font-semibold tabular-nums">{formatRevenueMinor(data.revenue7d.walletTopupsMinor)}</div>
                </div>
              </div>
            </section>
          ) : null}
          <AdminTrackingBoard
            counts={data.counts}
            roles={data.usersByRole}
            generatedAt={data.generatedAt}
            adminScope={getAdminScopeFromSession()}
          />
        </>
      ) : null}
    </div>
  );
}
