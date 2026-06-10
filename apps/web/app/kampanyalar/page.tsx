"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthEntryLink } from "../components/AuthEntryLink";
import { apiFetch } from "../lib/api";

type CampaignRow = {
  id: string;
  title: string;
  description: string;
  delivery_mode: string;
  lesson_count: number | null;
  price_minor: number;
  currency: string;
  capacity: number | null;
  starts_at: string | null;
  branch_name: string | null;
  city_name: string | null;
  teacher_display_name: string;
  rating_avg: string | number | null;
  rating_count: number | null;
  created_at: string;
};

function minorToTl(n: number): string {
  return (n / 100).toFixed(2);
}

function deliveryLabel(mode: string): string {
  if (mode === "online") return "Online";
  if (mode === "in_person") return "Yüz yüze";
  return "Hibrit";
}

export default function CampaignsPage() {
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const r = await apiFetch<{ campaigns: CampaignRow[] }>("/v1/teacher-campaigns?limit=30");
        if (!cancelled) setRows(r.campaigns);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "load_failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Öğretmen kampanyaları</h1>
            <p className="mt-1 max-w-2xl text-sm text-paper-800/75">
              Öğretmenlerin hazırladığı kamp, yoğun tekrar ve sınav hazırlık ilanlarını inceleyin. Başvuru sonrası
              program netleşir; ödeme adımları platformda açıkça gösterilir.
            </p>
          </div>
          <AuthEntryLink
            path="/panel"
            className="rounded-xl border border-paper-300 bg-white px-3 py-2 text-sm font-medium text-paper-900 hover:bg-paper-50"
          >
            Panele git
          </AuthEntryLink>
        </div>

        <section className="mt-6 rounded-2xl border border-brand-200 bg-[linear-gradient(135deg,#ecfeff_0%,#ffffff_60%,#fff7ed_100%)] p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-brand-900/70">Yeni ilan modeli</div>
          <h2 className="mt-1 text-lg font-semibold text-paper-900">TYT kampı, LGS tekrar programı veya özel ders paketi</h2>
          <p className="mt-1 text-sm text-paper-800/70">
            Bu ilanlarda öğretmen programını sunar. Başvuru sonrası koşullar, ders planı ve ödeme bilgisi netleşir.
          </p>
        </section>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : null}
        {loading && !error ? <div className="mt-6 text-sm text-paper-800/65">Yükleniyor…</div> : null}

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {rows.length === 0 && !loading ? (
            <div className="rounded-xl border border-paper-200 bg-white p-6 text-sm text-paper-800/75">
              Şu an yayında öğretmen kampanyası yok.
            </div>
          ) : (
            rows.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/kampanyalar/${campaign.id}`}
                className="block rounded-xl border border-paper-200 bg-white p-5 shadow-sm hover:border-brand-200 hover:bg-brand-50/30"
              >
                <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
                  <span className="rounded-full bg-brand-50 px-2 py-1 text-brand-900">
                    {deliveryLabel(campaign.delivery_mode)}
                  </span>
                  <span className="rounded-full bg-paper-100 px-2 py-1 text-paper-800">
                    {campaign.branch_name ?? "Genel"}
                  </span>
                </div>
                <h2 className="mt-3 text-lg font-semibold text-paper-900">{campaign.title}</h2>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-paper-800/70">{campaign.description}</p>
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-paper-800/60">
                  <span>{campaign.teacher_display_name}</span>
                  <span>{campaign.lesson_count ?? "Esnek"} ders</span>
                  <span>
                    {minorToTl(campaign.price_minor)} {campaign.currency}
                  </span>
                  <span>{campaign.city_name ?? "Tüm Türkiye"}</span>
                </div>
                {campaign.starts_at ? (
                  <div className="mt-2 text-xs text-paper-800/55">
                    Başlangıç: {new Date(campaign.starts_at).toLocaleString("tr-TR")}
                  </div>
                ) : null}
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
