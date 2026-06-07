"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthEntryLink } from "../components/AuthEntryLink";
import { apiFetch } from "../lib/api";

type CourseRow = {
  id: string;
  title: string;
  delivery_mode: string;
  language_code: string;
  price_minor: number;
  currency: string;
  origin: string;
  application_status: string;
  branch_name: string | null;
  teacher_display_name: string;
  created_at: string;
};

function minorToTl(n: number): string {
  return (n / 100).toFixed(2);
}

function deliveryModeLabel(mode: string): string {
  const labels: Record<string, string> = {
    online: "Online",
    in_person: "Yüz yüze",
    hybrid: "Online veya yüz yüze",
  };
  return labels[mode] ?? mode;
}

export default function CoursesPage() {
  const [rows, setRows] = useState<CourseRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const r = await apiFetch<{ courses: CourseRow[] }>("/v1/courses?limit=30");
        if (!cancelled) setRows(r.courses);
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
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Kurslar</h1>
            <p className="mt-1 text-sm text-paper-800/75">Yayındaki kursları inceleyin; detaydan size uygun grubu seçin.</p>
          </div>
          <AuthEntryLink
            path="/panel"
            className="rounded-xl border border-paper-300 bg-white px-3 py-2 text-sm font-medium text-paper-900 hover:bg-paper-50"
          >
            Panele git
          </AuthEntryLink>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
        {loading && !error && <div className="mt-6 text-sm text-paper-800/65">Yükleniyor…</div>}

        <div className="mt-8 space-y-3">
          {rows.length === 0 && !loading ? (
            <div className="rounded-xl border border-paper-200 bg-white p-6 text-sm text-paper-800/75">
              Şu an yayınlı kurs yok.
            </div>
          ) : (
            rows.map((c) => (
              <Link
                key={c.id}
                href={`/courses/${c.id}`}
                className="block rounded-xl border border-paper-200 bg-white p-5 hover:border-brand-200 hover:bg-brand-50/30"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold text-paper-900">{c.title}</div>
                  {c.origin === "admin_campaign" ? (
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-900">
                      Ön kayıtlı kampanya
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-xs text-paper-800/55">
                  {c.teacher_display_name} · {c.branch_name ?? "Branş bilgisi"} · {deliveryModeLabel(c.delivery_mode)} ·{" "}
                  {minorToTl(c.price_minor)} {c.currency}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

