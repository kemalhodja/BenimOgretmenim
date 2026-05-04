"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

function parseListFilterParam(raw: string | null): number | "" {
  if (raw == null || raw === "") return "";
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) return "";
  return n;
}

function OgretmenlerPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const initialQ = searchParams.get("q")?.trim() ?? "";
  const initialBranch = parseListFilterParam(searchParams.get("branchId"));
  const initialCity = parseListFilterParam(searchParams.get("cityId"));

  const [branches, setBranches] = useState<Branch[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [branchId, setBranchId] = useState<number | "">(initialBranch);
  const [cityId, setCityId] = useState<number | "">(initialCity);
  const [rows, setRows] = useState<TeacherRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaReady, setMetaReady] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(initialQ);
  const [searchApply, setSearchApply] = useState(initialQ);

  function replaceAllFilters(opts?: {
    q?: string;
    branchId?: number | "";
    cityId?: number | "";
  }) {
    const q = (opts?.q !== undefined ? opts.q : searchApply).trim();
    const br = opts?.branchId !== undefined ? opts.branchId : branchId;
    const ci = opts?.cityId !== undefined ? opts.cityId : cityId;

    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (br !== "") p.set("branchId", String(br));
    if (ci !== "") p.set("cityId", String(ci));
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function commitTextSearch() {
    const t = searchInput.trim();
    setSearchApply(t);
    replaceAllFilters({ q: t });
  }

  useEffect(() => {
    const q = searchParams.get("q")?.trim() ?? "";
    setSearchInput(q);
    setSearchApply(q);
    setBranchId(parseListFilterParam(searchParams.get("branchId")));
    setCityId(parseListFilterParam(searchParams.get("cityId")));
  }, [searchParams]);

  const leafBranches = useMemo(() => {
    const hasChild = new Set<number>();
    for (const b of branches) if (b.parent_id != null) hasChild.add(b.parent_id);
    return branches.filter((b) => !hasChild.has(b.id));
  }, [branches]);

  async function loadMeta(signal?: AbortSignal) {
    setError(null);
    setMetaLoading(true);
    try {
      const [b, c] = await Promise.all([
        apiFetch<{ branches: Branch[] }>("/v1/meta/branches", { signal }),
        apiFetch<{ cities: City[] }>("/v1/meta/cities", { signal }),
      ]);
      setBranches(b.branches);
      setCities(c.cities);
      setMetaReady(true);
    } catch (e) {
      if (signal?.aborted) return;
      setMetaReady(false);
      setError(e instanceof Error ? e.message : "meta_load_failed");
    } finally {
      if (!signal?.aborted) setMetaLoading(false);
    }
  }

  useEffect(() => {
    const ac = new AbortController();
    loadMeta(ac.signal);
    return () => ac.abort();
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
            <p className="text-sm font-medium text-zinc-500">Site</p>
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
              href="/panel"
              className="inline-flex items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-950 shadow-sm hover:bg-amber-100"
            >
              Panele git
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
                  commitTextSearch();
                }
              }}
              placeholder="Örn: matematik, deneyimli…"
              className="min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
              maxLength={120}
            />
            <button
              type="button"
              onClick={() => commitTextSearch()}
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
                  replaceAllFilters({ q: "" });
                }}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700"
              >
                Temizle
              </button>
            )}
          </div>
        </div>

        <div className="sticky top-16 z-10 -mx-6 mt-6 border-y border-zinc-200 bg-zinc-50/95 px-6 py-3 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block flex-1">
              <div className="mb-1 text-xs font-medium text-zinc-600">Branş</div>
              <select
                value={branchId}
                onChange={(e) => {
                  const v = e.target.value ? Number(e.target.value) : "";
                  setBranchId(v);
                  replaceAllFilters({ branchId: v });
                }}
                disabled={!metaReady || metaLoading}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 disabled:bg-zinc-50 disabled:text-zinc-400"
              >
                <option value="">
                  {metaLoading ? "Yükleniyor…" : metaReady ? "Tümü" : "Filtreler yok"}
                </option>
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
                onChange={(e) => {
                  const v = e.target.value ? Number(e.target.value) : "";
                  setCityId(v);
                  replaceAllFilters({ cityId: v });
                }}
                disabled={!metaReady || metaLoading}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 disabled:bg-zinc-50 disabled:text-zinc-400"
              >
                <option value="">
                  {metaLoading ? "Yükleniyor…" : metaReady ? "Tümü" : "Filtreler yok"}
                </option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setBranchId("");
                  setCityId("");
                  setSearchApply("");
                  setSearchInput("");
                  router.replace(pathname, { scroll: false });
                }}
                className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 sm:flex-none"
              >
                Sıfırla
              </button>
              <button
                type="button"
                onClick={() => loadMeta()}
                className="flex-1 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white sm:flex-none"
              >
                Yenile
              </button>
            </div>
          </div>
          {!metaReady && !metaLoading && (
            <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Filtreler yüklenemedi. Bu genelde API/CORS veya veritabanı kurulumundan kaynaklanır.
              <span className="font-mono"> /v1/meta/branches</span> ve{" "}
              <span className="font-mono">/v1/meta/cities</span> uçlarını kontrol edin.
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-8 space-y-2">
          {listLoading && rows.length === 0 ? (
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

export default function OgretmenlerPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] bg-zinc-50 px-6 py-16">
          <div className="mx-auto max-w-4xl animate-pulse space-y-4">
            <div className="h-8 w-56 rounded-lg bg-zinc-200" />
            <div className="h-28 rounded-2xl bg-zinc-200" />
            <div className="h-40 rounded-2xl bg-zinc-200" />
          </div>
        </div>
      }
    >
      <OgretmenlerPageInner />
    </Suspense>
  );
}
