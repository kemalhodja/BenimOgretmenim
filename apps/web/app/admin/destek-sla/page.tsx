"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useRequireAdmin } from "../useRequireAdmin";

type Dashboard = {
  dashboard: {
    settings: { firstResponseHours: number; disputeFirstResponseHours: number };
    supportThreads: {
      openCount: number;
      breachCount: number;
      breaches: Array<{ id: string; visitor_email: string | null; context_path: string | null; hoursOpen: number; created_at: string }>;
    };
    disputes: {
      openCount: number;
      breachCount: number;
      breaches: Array<{ id: string; reason: string; status: string; priority: string; hoursOpen: number; created_at: string }>;
    };
  };
};

export default function AdminDestekSlaPage() {
  const token = useRequireAdmin();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch<Dashboard>("/api/admin/support-sla-dashboard", { token })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "yüklenemedi"));
  }, [token]);

  if (!token) return null;

  const d = data?.dashboard;

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link href="/admin/merkez" className="text-sm text-brand-800 underline">
          ← Merkez
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-paper-900">Destek SLA paneli</h1>
        <p className="mt-2 text-sm text-paper-800/75">
          Hedef: destek ve itirazlara {d?.settings.firstResponseHours ?? 24} saat içinde ilk yanıt. Tahta şikayetlerinde
          en sık geçen konu: yanıtsız destek.
        </p>

        {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}

        {d ? (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-paper-200 bg-white p-4">
                <div className="text-2xl font-semibold text-paper-900">{d.supportThreads.openCount}</div>
                <div className="text-xs text-paper-800/60">Açık destek</div>
              </div>
              <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                <div className="text-2xl font-semibold text-red-900">{d.supportThreads.breachCount}</div>
                <div className="text-xs text-red-900/70">Destek SLA ihlali</div>
              </div>
              <div className="rounded-xl border border-paper-200 bg-white p-4">
                <div className="text-2xl font-semibold text-paper-900">{d.disputes.openCount}</div>
                <div className="text-xs text-paper-800/60">Açık itiraz</div>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                <div className="text-2xl font-semibold text-amber-950">{d.disputes.breachCount}</div>
                <div className="text-xs text-amber-900/70">İtiraz SLA ihlali</div>
              </div>
            </div>

            <section className="mt-8 rounded-2xl border border-paper-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-paper-900">Geciken destek konuları</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {d.supportThreads.breaches.length === 0 ? (
                  <li className="text-paper-800/55">İhlal yok.</li>
                ) : (
                  d.supportThreads.breaches.map((b) => (
                    <li key={b.id} className="rounded-lg border border-paper-100 bg-paper-50 p-3">
                      <div className="font-medium text-paper-900">{b.visitor_email ?? "Kayıtlı kullanıcı"} · {b.hoursOpen}s</div>
                      <div className="text-xs text-paper-800/55">{b.context_path ?? "—"}</div>
                      <Link href="/admin/support" className="mt-1 inline-block text-xs font-semibold text-brand-800 underline">
                        Destek paneli
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section className="mt-6 rounded-2xl border border-paper-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-paper-900">Yanıtsız itirazlar</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {d.disputes.breaches.length === 0 ? (
                  <li className="text-paper-800/55">İhlal yok.</li>
                ) : (
                  d.disputes.breaches.map((b) => (
                    <li key={b.id} className="rounded-lg border border-paper-100 bg-paper-50 p-3">
                      <div className="font-medium text-paper-900">{b.reason}</div>
                      <div className="text-xs text-paper-800/55">
                        {b.status} · {b.priority} · {b.hoursOpen}s açık
                      </div>
                      <Link href="/admin/veri?k=disputes" className="mt-1 inline-block text-xs font-semibold text-brand-800 underline">
                        İtiraz merkezi
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
