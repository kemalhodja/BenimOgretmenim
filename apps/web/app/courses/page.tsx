"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../lib/api";

type CourseRow = {
  id: string;
  title: string;
  delivery_mode: string;
  language_code: string;
  price_minor: number;
  currency: string;
  branch_name: string | null;
  teacher_display_name: string;
  created_at: string;
};

function minorToTl(n: number): string {
  return (n / 100).toFixed(2);
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
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-zinc-500">Online dershane</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
              Kurslar
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Yayınlanmış kurslar; cohort seçip kayıt olabilirsiniz.
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Link
              href="/student/panel"
              className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 shadow-sm"
            >
              Öğrenci paneli
            </Link>
            <Link
              href="/student/kurslar"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Kurslarım
            </Link>
            <Link
              href="/student/requests"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Ders talebi
            </Link>
            <Link
              href="/teacher"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Öğretmen paneli
            </Link>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
        {loading && !error && <div className="mt-6 text-sm text-zinc-600">Yükleniyor…</div>}

        <div className="mt-8 space-y-3">
          {rows.length === 0 && !loading ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
              Şu an yayınlı kurs yok.
            </div>
          ) : (
            rows.map((c) => (
              <Link
                key={c.id}
                href={`/courses/${c.id}`}
                className="block rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:bg-zinc-50"
              >
                <div className="text-sm font-semibold text-zinc-900">{c.title}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  {c.teacher_display_name} · {c.branch_name ?? "—"} · {c.delivery_mode} ·{" "}
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

