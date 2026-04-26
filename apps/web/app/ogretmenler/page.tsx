"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../lib/api";

type Branch = { id: number; parent_id: number | null; name: string; slug: string };
type City = { id: number; name: string; slug: string; plate_code: number | null };

type TeacherRow = {
  id: string;
  display_name: string;
  rating_avg: number | null;
  rating_count: number | null;
  city_id: number | null;
  city_name: string | null;
  verification_status: string;
  created_at: string;
};

export default function OgretmenlerPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [branchId, setBranchId] = useState<number | "">("");
  const [cityId, setCityId] = useState<number | "">("");
  const [rows, setRows] = useState<TeacherRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [metaReady, setMetaReady] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchApply, setSearchApply] = useState("");

  const leafBranches = useMemo(() => {
    const hasChild = new Set<number>();
    for (const b of branches) if (b.parent_id != null) hasChild.add(b.parent_id);
    return branches.filter((b) => !hasChild.has(b.id));
  }, [branches]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const [b, c] = await Promise.all([
          apiFetch<{ branches: Branch[] }>("/v1/meta/branches"),
          apiFetch<{ cities: City[] }>("/v1/meta/cities"),
        ]);
        if (cancelled) return;
        setBranches(b.branches);
        setCities(c.cities);
        setMetaReady(true);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "load_failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      setListLoading(true);
      try {
        const q = new URLSearchParams();
        if (branchId !== "") q.set("branchId", String(branchId));
        if (cityId !== "") q.set("cityId", String(cityId));
        if (searchApply !== "") q.set("q", searchApply);
        const qs = q.toString();
        const path = `/v1/teachers${qs ? `?${qs}` : ""}`;
        const r = await apiFetch<{ teachers: TeacherRow[] }>(path);
        if (cancelled) return;
        setRows(r.teachers);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "list_failed");
        }
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [branchId, cityId, searchApply]);

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-medium text-zinc-500">Öğretmen arama</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
              Öğretmenler
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Branş ve şehre göre filtreleyin. Profilden ders talebi veya giriş yaptıktan sonra
              doğrudan ders anlaşması (tutar + cüzdan) oluşturabilirsiniz.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <Link
              href="/student/dogrudan-dersler"
              className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50"
            >
              Doğrudan ders anlaşmalarım
            </Link>
            <Link
              href="/student/requests"
              className="inline-flex items-center justify-center rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-800"
            >
              Talep oluştur
            </Link>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="mb-1 text-xs font-medium text-zinc-600">İsim veya biyografide ara</div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  setSearchApply(searchInput.trim());
                }
              }}
              placeholder="Örn: matematik, deneyimli…"
              className="min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
              maxLength={120}
            />
            <button
              type="button"
              onClick={() => setSearchApply(searchInput.trim())}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
            >
              Ara
            </button>
            {searchApply !== "" && (
              <button
                type="button"
                onClick={() => {
                  setSearchApply("");
                  setSearchInput("");
                }}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700"
              >
                Temizle
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <label className="block flex-1">
            <div className="mb-1 text-xs font-medium text-zinc-600">Branş</div>
            <select
              value={branchId}
              onChange={(e) =>
                setBranchId(e.target.value ? Number(e.target.value) : "")
              }
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
            >
              <option value="">Tümü</option>
              {leafBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block flex-1">
            <div className="mb-1 text-xs font-medium text-zinc-600">Şehir</div>
            <select
              value={cityId}
              onChange={(e) =>
                setCityId(e.target.value ? Number(e.target.value) : "")
              }
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
            >
              <option value="">Tümü</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-8 space-y-2">
          {!metaReady ? (
            <div className="text-sm text-zinc-500">Filtreler yükleniyor…</div>
          ) : listLoading && rows.length === 0 ? (
            <div className="text-sm text-zinc-500">Liste yükleniyor…</div>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
              Kriterlere uyan öğretmen yok.
            </div>
          ) : (
            rows.map((t) => (
              <Link
                key={t.id}
                href={`/ogretmenler/${t.id}`}
                className="block rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">
                      {t.display_name}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {t.city_name ?? "Şehir belirtilmemiş"}
                      {" · "}
                      {t.verification_status === "verified"
                        ? "Doğrulanmış"
                        : `Durum: ${t.verification_status}`}
                    </div>
                  </div>
                  <div className="text-sm text-zinc-600">
                    {t.rating_count != null && Number(t.rating_count) > 0
                      ? `★ ${Number(t.rating_avg ?? 0).toFixed(1)} (${t.rating_count})`
                      : "Henüz değerlendirme yok"}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
