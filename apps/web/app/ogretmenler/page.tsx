"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "../lib/api";
import { getToken } from "../lib/auth";
import { loginHrefWithReturn } from "../lib/authRedirect";
import { trackEvent } from "../lib/trackEvent";

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
  profile_quality_score: number | null;
  has_video: boolean;
  has_exam_docs: boolean;
  has_platform_links: boolean;
  branch_count: number;
  min_hourly_rate_minor: number | null;
  max_hourly_rate_minor: number | null;
  primary_branch_id: number | null;
  primary_branch_name: string | null;
  completed_sessions_count: number;
  created_at: string;
};

type SortKey = "recommended" | "rating" | "newest" | "price_asc" | "experience";

const searchPresets = [
  { label: "LGS Matematik", q: "LGS Matematik", verifiedOnly: true },
  { label: "TYT Paragraf", q: "TYT Paragraf", verifiedOnly: false },
  { label: "İngilizce konuşma", q: "İngilizce", verifiedOnly: true },
  { label: "Acil soru çözümü", q: "Matematik", verifiedOnly: false },
] as const;

const advisorGoals = [
  { id: "lgs", label: "LGS hazırlık", q: "LGS Matematik", minRating: "4", hasDocs: true },
  { id: "yks", label: "YKS / TYT", q: "TYT Matematik", minRating: "4", hasDocs: true },
  { id: "language", label: "Dil pratiği", q: "İngilizce konuşma", minRating: "", hasDocs: false },
  { id: "school", label: "Okula destek", q: "Matematik", minRating: "", hasDocs: false },
] as const;

const advisorModes = [
  { id: "trust", label: "En güvenli profil", sort: "recommended" as SortKey, verifiedOnly: true, hasVideo: false },
  { id: "experience", label: "Ders geçmişi yüksek", sort: "experience" as SortKey, verifiedOnly: true, hasVideo: false },
  { id: "video", label: "Videolu tanıtım", sort: "recommended" as SortKey, verifiedOnly: false, hasVideo: true },
  { id: "budget", label: "Bütçeye uygun", sort: "price_asc" as SortKey, verifiedOnly: false, hasVideo: false },
] as const;

const advisorBudgets = [
  { id: "open", label: "Bütçem esnek", maxHourlyTl: "" },
  { id: "mid", label: "Saatlik 750 TL altı", maxHourlyTl: "750" },
  { id: "value", label: "Saatlik 500 TL altı", maxHourlyTl: "500" },
] as const;

const FAVORITE_TEACHERS_KEY = "bo:favorite-teachers";
const FAVORITE_TEACHER_DETAILS_KEY = "bo:favorite-teacher-details";
const COMPARE_TEACHERS_KEY = "bo:compare-teachers";
const MAX_COMPARE_TEACHERS = 3;

type CompareTeacher = Pick<
  TeacherRow,
  | "id"
  | "display_name"
  | "rating_avg"
  | "rating_count"
  | "city_name"
  | "verification_status"
  | "profile_quality_score"
  | "has_video"
  | "has_exam_docs"
  | "has_platform_links"
  | "min_hourly_rate_minor"
  | "max_hourly_rate_minor"
  | "primary_branch_id"
  | "primary_branch_name"
  | "completed_sessions_count"
>;

type TrustSignalTeacher = Pick<
  TeacherRow,
  | "rating_avg"
  | "rating_count"
  | "verification_status"
  | "profile_quality_score"
  | "has_video"
  | "has_exam_docs"
  | "has_platform_links"
  | "completed_sessions_count"
>;

function qualityLabel(score: number | null | undefined): string {
  const n = Number(score ?? 0);
  if (n >= 80) return "Çok güçlü profil";
  if (n >= 60) return "Güçlü profil";
  if (n >= 40) return "Gelişen profil";
  return "Yeni profil";
}

function trustScore(teacher: TrustSignalTeacher): number {
  const profileScore = Number(teacher.profile_quality_score ?? 0);
  const proofScore =
    (teacher.verification_status === "verified" ? 16 : 0) +
    (teacher.has_video ? 10 : 0) +
    (teacher.has_exam_docs ? 10 : 0) +
    (teacher.has_platform_links ? 6 : 0);
  const reviewScore =
    teacher.rating_count != null && Number(teacher.rating_count) > 0
      ? Math.min(18, Number(teacher.rating_count) * 2 + Number(teacher.rating_avg ?? 0) * 2)
      : 0;
  const sessionScore = Math.min(18, teacher.completed_sessions_count);
  return Math.min(100, Math.round(profileScore * 0.55 + proofScore + reviewScore + sessionScore));
}

function recommendationReasons(teacher: TrustSignalTeacher): string[] {
  const reasons: string[] = [];
  if (teacher.verification_status === "verified") reasons.push("Kimlik ve profil doğrulaması tamam");
  if (Number(teacher.profile_quality_score ?? 0) >= 75) reasons.push("Profil kalitesi güçlü");
  if (teacher.completed_sessions_count >= 10) reasons.push("Ders geçmişi yüksek");
  if (teacher.rating_count != null && Number(teacher.rating_count) > 0) {
    reasons.push(`${Number(teacher.rating_avg ?? 0).toFixed(1)} puanlı değerlendirme`);
  }
  if (teacher.has_video) reasons.push("Tanıtım videosu var");
  if (teacher.has_exam_docs) reasons.push("Sınav/doküman kanıtı var");
  if (teacher.has_platform_links) reasons.push("Ek çalışma bağlantıları var");
  return reasons.slice(0, 3);
}

function trustActionLabel(teacher: TrustSignalTeacher): string {
  const score = trustScore(teacher);
  if (score >= 85) return "Demo talebi için uygun görünüyor";
  if (score >= 70) return "Kısa listeye eklenebilir";
  if (teacher.verification_status !== "verified") return "Doğrulama durumunu inceleyin";
  return "Profil detayını kontrol edin";
}

function parseListFilterParam(raw: string | null): number | "" {
  if (raw == null || raw === "") return "";
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) return "";
  return n;
}

function parseBooleanParam(raw: string | null): boolean {
  return raw === "1" || raw === "true";
}

function parseSortParam(raw: string | null): SortKey {
  if (raw === "rating" || raw === "newest" || raw === "price_asc" || raw === "experience") return raw;
  return "recommended";
}

function parseTlToMinor(raw: string): number | "" {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return "";
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return "";
  return Math.round(n * 100);
}

function priceLabel(minorMin: number | null, minorMax: number | null): string {
  if (minorMin == null && minorMax == null) return "Ücret belirtilmemiş";
  const min = minorMin != null ? `${Math.round(minorMin / 100)} TL` : "—";
  const max = minorMax != null ? `${Math.round(minorMax / 100)} TL` : "—";
  return `${min} - ${max} / saat`;
}

function toSavedTeacher(teacher: TeacherRow | CompareTeacher): CompareTeacher {
  return {
    id: teacher.id,
    display_name: teacher.display_name,
    rating_avg: teacher.rating_avg,
    rating_count: teacher.rating_count,
    city_name: teacher.city_name,
    verification_status: teacher.verification_status,
    profile_quality_score: teacher.profile_quality_score,
    has_video: teacher.has_video,
    has_exam_docs: teacher.has_exam_docs,
    has_platform_links: teacher.has_platform_links,
    min_hourly_rate_minor: teacher.min_hourly_rate_minor,
    max_hourly_rate_minor: teacher.max_hourly_rate_minor,
    primary_branch_id: teacher.primary_branch_id,
    primary_branch_name: teacher.primary_branch_name,
    completed_sessions_count: teacher.completed_sessions_count,
  };
}

function OgretmenlerPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const initialQ = searchParams.get("q")?.trim() ?? "";
  const initialBranch = parseListFilterParam(searchParams.get("branchId"));
  const initialCity = parseListFilterParam(searchParams.get("cityId"));
  const initialSort = parseSortParam(searchParams.get("sort"));
  const initialVerifiedOnly = parseBooleanParam(searchParams.get("verifiedOnly"));
  const initialHasVideo = parseBooleanParam(searchParams.get("hasVideo"));
  const initialHasDocs = parseBooleanParam(searchParams.get("hasDocs"));
  const initialMinRating = searchParams.get("minRating") ?? "";
  const initialMaxHourlyRateMinor = searchParams.get("maxHourlyRateMinor") ?? "";

  const [branches, setBranches] = useState<Branch[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [branchId, setBranchId] = useState<number | "">(initialBranch);
  const [cityId, setCityId] = useState<number | "">(initialCity);
  const [sort, setSort] = useState<SortKey>(initialSort);
  const [verifiedOnly, setVerifiedOnly] = useState(initialVerifiedOnly);
  const [hasVideo, setHasVideo] = useState(initialHasVideo);
  const [hasDocs, setHasDocs] = useState(initialHasDocs);
  const [minRating, setMinRating] = useState(initialMinRating);
  const [maxHourlyTl, setMaxHourlyTl] = useState(
    initialMaxHourlyRateMinor ? String(Math.round(Number(initialMaxHourlyRateMinor) / 100)) : "",
  );
  const [rows, setRows] = useState<TeacherRow[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaReady, setMetaReady] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(initialQ);
  const [searchApply, setSearchApply] = useState(initialQ);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [favoriteTeacherIds, setFavoriteTeacherIds] = useState<Set<string>>(() => new Set());
  const [favoriteTeacherDetails, setFavoriteTeacherDetails] = useState<CompareTeacher[]>([]);
  const [compareTeachers, setCompareTeachers] = useState<CompareTeacher[]>([]);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [advisorGoal, setAdvisorGoal] = useState<(typeof advisorGoals)[number]["id"]>("lgs");
  const [advisorMode, setAdvisorMode] = useState<(typeof advisorModes)[number]["id"]>("trust");
  const [advisorBudget, setAdvisorBudget] = useState<(typeof advisorBudgets)[number]["id"]>("open");

  useEffect(() => {
    setSessionToken(getToken());
    const onAuth = () => setSessionToken(getToken());
    window.addEventListener("bo:auth-changed", onAuth);
    window.addEventListener("storage", onAuth);
    return () => {
      window.removeEventListener("bo:auth-changed", onAuth);
      window.removeEventListener("storage", onAuth);
    };
  }, []);

  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;
    apiFetch<{ teachers: Array<{ id: string }> }>("/v1/teachers/shortlist", { token: sessionToken })
      .then((r) => {
        if (cancelled) return;
        const ids = r.teachers.map((teacher) => teacher.id);
        setFavoriteTeacherIds(new Set(ids));
        window.localStorage.setItem(FAVORITE_TEACHERS_KEY, JSON.stringify(ids));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FAVORITE_TEACHERS_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      if (Array.isArray(parsed)) {
        setFavoriteTeacherIds(new Set(parsed.filter((x): x is string => typeof x === "string")));
      }
      const detailRaw = window.localStorage.getItem(FAVORITE_TEACHER_DETAILS_KEY);
      const detailParsed = detailRaw ? (JSON.parse(detailRaw) as unknown) : [];
      if (Array.isArray(detailParsed)) {
        setFavoriteTeacherDetails(
          detailParsed.filter(
            (x): x is CompareTeacher =>
              Boolean(x) && typeof x === "object" && typeof (x as { id?: unknown }).id === "string",
          ),
        );
      }
    } catch {
      setFavoriteTeacherIds(new Set());
      setFavoriteTeacherDetails([]);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COMPARE_TEACHERS_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      if (Array.isArray(parsed)) {
        setCompareTeachers(
          parsed
            .filter((x): x is CompareTeacher => Boolean(x) && typeof x === "object" && typeof (x as { id?: unknown }).id === "string")
            .slice(0, MAX_COMPARE_TEACHERS),
        );
      }
    } catch {
      setCompareTeachers([]);
    }
  }, []);

  useEffect(() => {
    if (rows.length === 0 || favoriteTeacherIds.size === 0) return;
    setFavoriteTeacherDetails((prev) => {
      const byId = new Map(prev.map((teacher) => [teacher.id, teacher]));
      for (const teacher of rows) {
        if (favoriteTeacherIds.has(teacher.id)) byId.set(teacher.id, toSavedTeacher(teacher));
      }
      const next = [...byId.values()].filter((teacher) => favoriteTeacherIds.has(teacher.id));
      window.localStorage.setItem(FAVORITE_TEACHER_DETAILS_KEY, JSON.stringify(next));
      return next;
    });
  }, [rows, favoriteTeacherIds]);

  const favoriteIdsKey = useMemo(() => [...favoriteTeacherIds].sort().join(","), [favoriteTeacherIds]);

  useEffect(() => {
    if (!favoriteIdsKey) return;
    const ids = favoriteIdsKey.split(",").filter(Boolean);
    const knownIds = new Set(favoriteTeacherDetails.map((teacher) => teacher.id));
    const missingIds = ids.filter((id) => !knownIds.has(id));
    if (missingIds.length === 0) return;
    let cancelled = false;
    apiFetch<{ teachers: TeacherRow[] }>(`/v1/teachers/batch?ids=${encodeURIComponent(missingIds.join(","))}`)
      .then((r) => {
        if (cancelled) return;
        setFavoriteTeacherDetails((prev) => {
          const byId = new Map(prev.map((teacher) => [teacher.id, teacher]));
          for (const teacher of r.teachers) byId.set(teacher.id, toSavedTeacher(teacher));
          const next = ids.map((id) => byId.get(id)).filter((teacher): teacher is CompareTeacher => Boolean(teacher));
          window.localStorage.setItem(FAVORITE_TEACHER_DETAILS_KEY, JSON.stringify(next));
          return next;
        });
      })
      .catch(() => {
        /* Favori paneli, toplu hydrate olmazsa mevcut local özetle çalışmaya devam eder. */
      });
    return () => {
      cancelled = true;
    };
  }, [favoriteIdsKey, favoriteTeacherDetails]);

  function toggleFavoriteTeacher(teacher: TeacherRow) {
    setFavoriteTeacherIds((prev) => {
      const next = new Set(prev);
      const action = next.has(teacher.id) ? "remove" : "add";
      if (action === "remove") next.delete(teacher.id);
      else next.add(teacher.id);
      if (sessionToken) {
        void apiFetch("/v1/teachers/shortlist", {
          method: "PATCH",
          token: sessionToken,
          body: JSON.stringify({ teacherId: teacher.id, action }),
        }).catch(() => {});
      }
      trackEvent("teacher_shortlist", {
        entityType: "teacher",
        entityId: teacher.id,
        metadata: { action, teacherName: teacher.display_name },
      });
      window.localStorage.setItem(FAVORITE_TEACHERS_KEY, JSON.stringify([...next]));
      setFavoriteTeacherDetails((detailPrev) => {
        const detailNext = next.has(teacher.id)
          ? [...detailPrev.filter((x) => x.id !== teacher.id), toSavedTeacher(teacher)]
          : detailPrev.filter((x) => x.id !== teacher.id);
        window.localStorage.setItem(FAVORITE_TEACHER_DETAILS_KEY, JSON.stringify(detailNext));
        return detailNext;
      });
      return next;
    });
  }

  function toggleCompareTeacher(teacher: TeacherRow | CompareTeacher) {
    setCompareTeachers((prev) => {
      const exists = prev.some((x) => x.id === teacher.id);
      const next = exists
        ? prev.filter((x) => x.id !== teacher.id)
        : [
            ...prev,
            {
              ...toSavedTeacher(teacher),
            },
          ].slice(-MAX_COMPARE_TEACHERS);
      window.localStorage.setItem(COMPARE_TEACHERS_KEY, JSON.stringify(next));
      return next;
    });
  }

  function clearCompareTeachers() {
    setCompareTeachers([]);
    window.localStorage.removeItem(COMPARE_TEACHERS_KEY);
  }

  const requestsPath =
    branchId !== "" ? `/student/requests?branchId=${branchId}` : "/student/requests";
  const talepHref = sessionToken ? requestsPath : loginHrefWithReturn(requestsPath);

  function shortlistRequestHref(teachers: CompareTeacher[]): string {
    const ids = teachers.map((teacher) => teacher.id).filter(Boolean);
    const names = teachers.map((teacher) => teacher.display_name).filter(Boolean);
    const branchIds = teachers
      .map((teacher) => teacher.primary_branch_id)
      .filter((id): id is number => typeof id === "number");
    const commonBranchId =
      branchId !== ""
        ? branchId
        : branchIds.length > 0 && branchIds.every((id) => id === branchIds[0])
          ? branchIds[0]
          : "";
    const params = new URLSearchParams();
    if (ids.length) params.set("shortlistTeacherIds", ids.join(","));
    if (names.length) params.set("shortlistTeacherNames", names.join("|"));
    if (commonBranchId !== "") params.set("branchId", String(commonBranchId));
    const path = `/student/requests?${params.toString()}`;
    return sessionToken ? path : loginHrefWithReturn(path);
  }

  function replaceAllFilters(opts?: {
    q?: string;
    branchId?: number | "";
    cityId?: number | "";
    sort?: SortKey;
    verifiedOnly?: boolean;
    hasVideo?: boolean;
    hasDocs?: boolean;
    minRating?: string;
    maxHourlyTl?: string;
  }) {
    const q = (opts?.q !== undefined ? opts.q : searchApply).trim();
    const br = opts?.branchId !== undefined ? opts.branchId : branchId;
    const ci = opts?.cityId !== undefined ? opts.cityId : cityId;
    const so = opts?.sort !== undefined ? opts.sort : sort;
    const vo = opts?.verifiedOnly !== undefined ? opts.verifiedOnly : verifiedOnly;
    const hv = opts?.hasVideo !== undefined ? opts.hasVideo : hasVideo;
    const hd = opts?.hasDocs !== undefined ? opts.hasDocs : hasDocs;
    const mr = (opts?.minRating !== undefined ? opts.minRating : minRating).trim();
    const maxTl = (opts?.maxHourlyTl !== undefined ? opts.maxHourlyTl : maxHourlyTl).trim();
    const maxMinor = parseTlToMinor(maxTl);

    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (br !== "") p.set("branchId", String(br));
    if (ci !== "") p.set("cityId", String(ci));
    if (so !== "recommended") p.set("sort", so);
    if (vo) p.set("verifiedOnly", "1");
    if (hv) p.set("hasVideo", "1");
    if (hd) p.set("hasDocs", "1");
    if (mr) p.set("minRating", mr);
    if (maxMinor !== "") p.set("maxHourlyRateMinor", String(maxMinor));
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function commitTextSearch() {
    const t = searchInput.trim();
    setSearchApply(t);
    replaceAllFilters({ q: t });
  }

  function applyAdvisor() {
    const goal = advisorGoals.find((item) => item.id === advisorGoal) ?? advisorGoals[0];
    const mode = advisorModes.find((item) => item.id === advisorMode) ?? advisorModes[0];
    const budget = advisorBudgets.find((item) => item.id === advisorBudget) ?? advisorBudgets[0];
    setSearchInput(goal.q);
    setSearchApply(goal.q);
    setSort(mode.sort);
    setVerifiedOnly(mode.verifiedOnly);
    setHasVideo(mode.hasVideo);
    setHasDocs(goal.hasDocs);
    setMinRating(goal.minRating);
    setMaxHourlyTl(budget.maxHourlyTl);
    replaceAllFilters({
      q: goal.q,
      sort: mode.sort,
      verifiedOnly: mode.verifiedOnly,
      hasVideo: mode.hasVideo,
      hasDocs: goal.hasDocs,
      minRating: goal.minRating,
      maxHourlyTl: budget.maxHourlyTl,
    });
    trackEvent("teacher_search", {
      metadata: {
        source: "advisor",
        advisorGoal,
        advisorMode,
        advisorBudget,
      },
    });
  }

  useEffect(() => {
    const q = searchParams.get("q")?.trim() ?? "";
    setSearchInput(q);
    setSearchApply(q);
    setBranchId(parseListFilterParam(searchParams.get("branchId")));
    setCityId(parseListFilterParam(searchParams.get("cityId")));
    setSort(parseSortParam(searchParams.get("sort")));
    setVerifiedOnly(parseBooleanParam(searchParams.get("verifiedOnly")));
    setHasVideo(parseBooleanParam(searchParams.get("hasVideo")));
    setHasDocs(parseBooleanParam(searchParams.get("hasDocs")));
    setMinRating(searchParams.get("minRating") ?? "");
    const maxMinor = searchParams.get("maxHourlyRateMinor");
    setMaxHourlyTl(maxMinor ? String(Math.round(Number(maxMinor) / 100)) : "");
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
        trackEvent("teacher_search", {
          metadata: { branchId, cityId, q: searchApply, sort, verifiedOnly, hasVideo, hasDocs, minRating, maxHourlyTl },
        });
        const q = new URLSearchParams();
        if (branchId !== "") q.set("branchId", String(branchId));
        if (cityId !== "") q.set("cityId", String(cityId));
        if (searchApply !== "") q.set("q", searchApply);
        if (sort !== "recommended") q.set("sort", sort);
        if (verifiedOnly) q.set("verifiedOnly", "1");
        if (hasVideo) q.set("hasVideo", "1");
        if (hasDocs) q.set("hasDocs", "1");
        if (minRating.trim()) q.set("minRating", minRating.trim());
        const maxMinor = parseTlToMinor(maxHourlyTl);
        if (maxMinor !== "") q.set("maxHourlyRateMinor", String(maxMinor));
        const qs = q.toString();
        const path = `/v1/teachers${qs ? `?${qs}` : ""}`;
        const r = await apiFetch<{ teachers: TeacherRow[]; total?: number }>(path);
        if (cancelled) return;
        setRows(r.teachers);
        setTotal(r.total ?? r.teachers.length);
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
  }, [branchId, cityId, searchApply, sort, verifiedOnly, hasVideo, hasDocs, minRating, maxHourlyTl]);

  const marketplaceSignals = useMemo(() => {
    const verified = rows.filter((teacher) => teacher.verification_status === "verified").length;
    const strongQuality = rows.filter((teacher) => Number(teacher.profile_quality_score ?? 0) >= 70).length;
    const withProof = rows.filter((teacher) => teacher.has_video || teacher.has_exam_docs || teacher.has_platform_links).length;
    const highTrust = rows.filter((teacher) => trustScore(teacher) >= 80).length;
    return { verified, strongQuality, withProof, highTrust };
  }, [rows]);

  return (
    <div className="bo-edu-bg min-h-screen">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Öğretmen ara</h1>
            <p className="mt-1 max-w-xl text-sm text-paper-800/75">
              Branş ve şehir seçin; profilden talep açıp teklifleri toplayın veya doğrudan anlaşın.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              href={talepHref}
              className="rounded-xl bg-edu-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-edu-indigo-800"
            >
              Talep oluştur
            </Link>
          </div>
        </div>

        <section className="bo-edu-card mt-6 rounded-2xl border border-edu-indigo-200 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-edu-indigo-950">Doğru öğretmeni daha hızlı bulun</h2>
              <p className="mt-1 max-w-2xl text-sm text-edu-indigo-900/80">
                Önce doğrulanmış ve güçlü profilleri inceleyin; emin değilseniz tek talep açıp gelen teklifleri
                puan, ücret, yanıt hızı ve profil kalitesiyle karşılaştırın.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {searchPresets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setSearchInput(preset.q);
                      setSearchApply(preset.q);
                      setVerifiedOnly(preset.verifiedOnly);
                      setSort("recommended");
                      replaceAllFilters({
                        q: preset.q,
                        verifiedOnly: preset.verifiedOnly,
                        sort: "recommended",
                      });
                    }}
                    className="rounded-full border border-edu-blue-200 bg-white/86 px-3 py-1.5 text-xs font-medium text-edu-blue-900 hover:border-edu-indigo-300"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <Link
              href={talepHref}
              className="shrink-0 rounded-xl bg-edu-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-edu-indigo-800"
            >
              Tek taleple teklif topla
            </Link>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-edu-blue-100 bg-white/94 p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-edu-indigo-700/70">
                Öğretmen seçmeme yardım et
              </div>
              <h2 className="mt-1 text-lg font-semibold text-paper-950">Hedefinize göre filtreleri hazırlayalım</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-paper-800/65">
                Sınav hedefi, güven tercihi ve bütçe aralığına göre önerilen aramayı tek tıkla başlatın.
              </p>
            </div>
            <button
              type="button"
              onClick={applyAdvisor}
              className="shrink-0 rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-900"
            >
              Önerilen öğretmenleri göster
            </button>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <div>
              <div className="mb-2 text-xs font-semibold text-paper-800/60">Hedef</div>
              <div className="flex flex-wrap gap-2">
                {advisorGoals.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setAdvisorGoal(item.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      advisorGoal === item.id
                        ? "border-edu-indigo-300 bg-edu-indigo-50 text-edu-indigo-950"
                        : "border-edu-blue-100 bg-edu-blue-50/65 text-paper-800"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold text-paper-800/60">Öncelik</div>
              <div className="flex flex-wrap gap-2">
                {advisorModes.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setAdvisorMode(item.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      advisorMode === item.id
                        ? "border-edu-indigo-300 bg-edu-indigo-50 text-edu-indigo-950"
                        : "border-edu-blue-100 bg-edu-blue-50/65 text-paper-800"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold text-paper-800/60">Bütçe</div>
              <div className="flex flex-wrap gap-2">
                {advisorBudgets.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setAdvisorBudget(item.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      advisorBudget === item.id
                        ? "border-edu-indigo-300 bg-edu-indigo-50 text-edu-indigo-950"
                        : "border-edu-blue-100 bg-edu-blue-50/65 text-paper-800"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 rounded-xl border border-edu-blue-100 bg-white/94 p-4">
          <div className="mb-1 text-xs font-medium text-paper-800/65">Metin ara</div>
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
              placeholder="Örn. matematik…"
              className="min-w-0 flex-1 rounded-xl border border-edu-blue-100 px-3 py-2 text-sm outline-none focus:border-edu-indigo-400"
              maxLength={120}
            />
            <button
              type="button"
              onClick={() => commitTextSearch()}
              className="rounded-xl bg-edu-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-edu-indigo-800"
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
                className="rounded-xl border border-paper-300 bg-white px-4 py-2 text-sm font-medium text-paper-800 hover:bg-paper-50"
              >
                Temizle
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex gap-2 sm:hidden">
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="flex-1 rounded-xl border border-edu-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-edu-indigo-800"
          >
            Filtreleri aç
          </button>
          <Link href={shortlistRequestHref(favoriteTeacherDetails)} className="flex-1 rounded-xl bg-edu-indigo-600 px-4 py-2 text-center text-sm font-semibold text-white">
            Kısa listeden talep
          </Link>
        </div>

        <div className="sticky top-14 z-10 -mx-6 mt-6 border-y border-edu-blue-100 bg-white/92 px-6 py-3 backdrop-blur-sm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block flex-1">
              <div className="mb-1 text-xs font-medium text-paper-800/65">Branş</div>
              <select
                value={branchId}
                onChange={(e) => {
                  const v = e.target.value ? Number(e.target.value) : "";
                  setBranchId(v);
                  replaceAllFilters({ branchId: v });
                }}
                disabled={!metaReady || metaLoading}
                className="w-full rounded-xl border border-paper-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 disabled:bg-paper-50 disabled:text-paper-800/45"
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
              <div className="mb-1 text-xs font-medium text-paper-800/65">Şehir</div>
              <select
                value={cityId}
                onChange={(e) => {
                  const v = e.target.value ? Number(e.target.value) : "";
                  setCityId(v);
                  replaceAllFilters({ cityId: v });
                }}
                disabled={!metaReady || metaLoading}
                className="w-full rounded-xl border border-paper-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 disabled:bg-paper-50 disabled:text-paper-800/45"
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
            <label className="block">
              <div className="mb-1 text-xs font-medium text-paper-800/65">Sıralama</div>
              <select
                value={sort}
                onChange={(e) => {
                  const v = parseSortParam(e.target.value);
                  setSort(v);
                  replaceAllFilters({ sort: v });
                }}
                className="w-full rounded-xl border border-paper-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
              >
                <option value="recommended">Önerilen</option>
                <option value="rating">Puana göre</option>
                <option value="experience">Ders tecrübesi</option>
                <option value="price_asc">Ücrete göre artan</option>
                <option value="newest">En yeni</option>
              </select>
            </label>
            <label className="block">
              <div className="mb-1 text-xs font-medium text-paper-800/65">Saatlik üst bütçe</div>
              <input
                value={maxHourlyTl}
                onChange={(e) => setMaxHourlyTl(e.target.value)}
                onBlur={() => replaceAllFilters({ maxHourlyTl })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    replaceAllFilters({ maxHourlyTl });
                  }
                }}
                inputMode="numeric"
                placeholder="Örn. 750"
                className="w-full rounded-xl border border-paper-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {[
                ["verifiedOnly", "Doğrulanmış", verifiedOnly] as const,
                ["hasVideo", "Video var", hasVideo] as const,
                ["hasDocs", "Belge/doküman var", hasDocs] as const,
              ].map(([key, label, active]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (key === "verifiedOnly") {
                      setVerifiedOnly(!active);
                      replaceAllFilters({ verifiedOnly: !active });
                    }
                    if (key === "hasVideo") {
                      setHasVideo(!active);
                      replaceAllFilters({ hasVideo: !active });
                    }
                    if (key === "hasDocs") {
                      setHasDocs(!active);
                      replaceAllFilters({ hasDocs: !active });
                    }
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                    active
                      ? "border-brand-300 bg-brand-50 text-brand-900"
                      : "border-paper-200 bg-white text-paper-800"
                  }`}
                >
                  {label}
                </button>
              ))}
              <select
                value={minRating}
                onChange={(e) => {
                  setMinRating(e.target.value);
                  replaceAllFilters({ minRating: e.target.value });
                }}
                className="rounded-full border border-paper-200 bg-white px-3 py-1.5 text-xs font-medium text-paper-800"
              >
                <option value="">Tüm puanlar</option>
                <option value="4">4+ puan</option>
                <option value="4.5">4.5+ puan</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setBranchId("");
                  setCityId("");
                  setSearchApply("");
                  setSearchInput("");
                  setSort("recommended");
                  setVerifiedOnly(false);
                  setHasVideo(false);
                  setHasDocs(false);
                  setMinRating("");
                  setMaxHourlyTl("");
                  router.replace(pathname, { scroll: false });
                }}
                className="flex-1 rounded-xl border border-paper-300 bg-white px-4 py-2 text-sm font-medium text-paper-800 hover:bg-paper-50 sm:flex-none"
              >
                Sıfırla
              </button>
              <button
                type="button"
                onClick={() => loadMeta()}
                className="flex-1 rounded-xl border border-paper-300 bg-white px-4 py-2 text-sm font-medium text-paper-800 hover:bg-paper-50 sm:flex-none"
              >
                Listeyi yenile
              </button>
            </div>
          </div>
          {!metaReady && !metaLoading && (
            <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Filtreler yüklenemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.
            </div>
          )}
        </div>

        {mobileFiltersOpen ? (
          <div className="fixed inset-0 z-40 bg-paper-950/40 sm:hidden" role="dialog" aria-modal="true">
            <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-paper-950">Mobil filtreler</h2>
                  <p className="text-xs text-paper-800/60">Branş, şehir ve kalite bilgilerini tek ekranda ayarlayın.</p>
                </div>
                <button type="button" onClick={() => setMobileFiltersOpen(false)} className="rounded-full border border-paper-200 px-3 py-1 text-sm">
                  Kapat
                </button>
              </div>
              <div className="mt-4 grid gap-3">
                <label className="block">
                  <div className="mb-1 text-xs font-medium text-paper-800/65">Branş</div>
                  <select
                    value={branchId}
                    onChange={(e) => {
                      const v = e.target.value ? Number(e.target.value) : "";
                      setBranchId(v);
                      replaceAllFilters({ branchId: v });
                    }}
                    disabled={!metaReady || metaLoading}
                    className="w-full rounded-xl border border-paper-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Tümü</option>
                    {leafBranches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <div className="mb-1 text-xs font-medium text-paper-800/65">Şehir</div>
                  <select
                    value={cityId}
                    onChange={(e) => {
                      const v = e.target.value ? Number(e.target.value) : "";
                      setCityId(v);
                      replaceAllFilters({ cityId: v });
                    }}
                    disabled={!metaReady || metaLoading}
                    className="w-full rounded-xl border border-paper-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Tümü</option>
                    {cities.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    ["verifiedOnly", "Doğrulanmış", verifiedOnly] as const,
                    ["hasVideo", "Video", hasVideo] as const,
                    ["hasDocs", "Belge", hasDocs] as const,
                  ].map(([key, label, active]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        if (key === "verifiedOnly") {
                          setVerifiedOnly(!active);
                          replaceAllFilters({ verifiedOnly: !active });
                        }
                        if (key === "hasVideo") {
                          setHasVideo(!active);
                          replaceAllFilters({ hasVideo: !active });
                        }
                        if (key === "hasDocs") {
                          setHasDocs(!active);
                          replaceAllFilters({ hasDocs: !active });
                        }
                      }}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                        active ? "border-brand-300 bg-brand-50 text-brand-900" : "border-paper-200 bg-white text-paper-800"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(false)}
                  className="rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Sonuçları göster ({total})
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="mt-6 rounded-2xl border border-edu-indigo-200 bg-[linear-gradient(135deg,#eef2ff_0%,#ffffff_48%,#ecfdf5_76%,#fffbeb_100%)] p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-edu-indigo-700/70">
                Güvenle öğretmen seçin
              </div>
              <h2 className="mt-2 text-lg font-semibold text-paper-900">
                Kalite ve güven bilgileri
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-paper-800/70">
                Doğrulama, profil kalitesi, ders geçmişi ve güvenli ödeme bilgileri seçim yapmayı kolaylaştırır.
              </p>
            </div>
            <div className="grid min-w-full grid-cols-3 gap-2 text-center sm:min-w-[24rem]">
              <div className="rounded-xl border border-white bg-white/88 p-3 shadow-sm">
                <div className="text-xl font-semibold text-edu-indigo-800">{marketplaceSignals.verified}</div>
                <div className="mt-1 text-[11px] text-paper-800/55">doğrulanmış</div>
              </div>
              <div className="rounded-xl border border-white bg-white/88 p-3 shadow-sm">
                <div className="text-xl font-semibold text-edu-success-700">{marketplaceSignals.strongQuality}</div>
                <div className="mt-1 text-[11px] text-paper-800/55">70+ kalite</div>
              </div>
              <div className="rounded-xl border border-white bg-white/88 p-3 shadow-sm">
                <div className="text-xl font-semibold text-edu-sun-600">{marketplaceSignals.withProof}</div>
                <div className="mt-1 text-[11px] text-paper-800/55">kanıtlı profil</div>
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {[
              ["Güven puanı", `${marketplaceSignals.highTrust} uygun aday`, "Doğrulama, yorum, ders geçmişi ve profil kanıtı birlikte okunur."],
              ["Karar rehberi", "Önce demo", "Emin olmadığınızda tek talep açıp teklifleri aynı ölçekte karşılaştırın."],
              ["Ödeme güveni", "Güvenceli paket", "Kabul sonrası toplam tutar cüzdanda tutulur; ders süreci kayıtlı ilerler."],
            ].map(([title, value, body]) => (
              <div key={title} className="rounded-xl border border-white bg-white/84 p-3 text-sm shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-paper-800/55">{title}</div>
                <div className="mt-1 font-semibold text-paper-900">{value}</div>
                <p className="mt-1 text-xs leading-relaxed text-paper-800/60">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {favoriteTeacherDetails.length > 0 && (
          <section className="mt-6 rounded-2xl border border-edu-sun-300 bg-edu-sun-50/75 p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-paper-900">Favori öğretmenler</h2>
                <p className="mt-1 text-sm text-paper-800/65">
                  Kısa listenizdeki öğretmenleri tekrar açın, karşılaştırmaya ekleyin veya demo talep edin.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={shortlistRequestHref(favoriteTeacherDetails.slice(0, MAX_COMPARE_TEACHERS))}
                  className="w-fit rounded-xl bg-edu-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-edu-indigo-800"
                >
                  Favorilerle talep oluştur
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setFavoriteTeacherIds(new Set());
                    setFavoriteTeacherDetails([]);
                    window.localStorage.removeItem(FAVORITE_TEACHERS_KEY);
                    window.localStorage.removeItem(FAVORITE_TEACHER_DETAILS_KEY);
                  }}
                  className="w-fit rounded-xl border border-edu-sun-300 bg-white px-3 py-2 text-xs font-semibold text-paper-900 hover:bg-edu-sun-50"
                >
                  Favorileri temizle
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {favoriteTeacherDetails.map((teacher) => {
                const demoParams = new URLSearchParams();
                demoParams.set("requestKind", "demo");
                demoParams.set("teacherId", teacher.id);
                demoParams.set("teacherName", teacher.display_name);
                if (teacher.primary_branch_id != null) demoParams.set("branchId", String(teacher.primary_branch_id));
                const demoPath = `/student/requests?${demoParams.toString()}`;
                const demoHref = sessionToken ? demoPath : loginHrefWithReturn(demoPath);
                return (
                  <article key={teacher.id} className="rounded-xl border border-edu-sun-300 bg-white/92 p-4 text-sm">
                    <Link href={`/ogretmenler/${teacher.id}`} className="font-semibold text-paper-900 hover:text-brand-800">
                      {teacher.display_name}
                    </Link>
                    <div className="mt-1 text-xs text-paper-800/55">
                      {teacher.primary_branch_name ?? "Branş belirtilmemiş"} · {teacher.city_name ?? "Şehir yok"}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-paper-100 px-2 py-0.5 text-[11px] font-medium text-paper-800">
                        {teacher.profile_quality_score ?? 0}/100 kalite
                      </span>
                      {teacher.rating_count != null && Number(teacher.rating_count) > 0 ? (
                        <span className="rounded-full bg-paper-100 px-2 py-0.5 text-[11px] font-medium text-paper-800">
                          ★ {Number(teacher.rating_avg ?? 0).toFixed(1)}
                        </span>
                      ) : null}
                      {teacher.verification_status === "verified" ? (
                        <span className="rounded-full bg-edu-success-50 px-2 py-0.5 text-[11px] font-medium text-edu-success-900">
                          Doğrulanmış
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={demoHref}
                        className="rounded-xl bg-edu-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-edu-indigo-800"
                      >
                        Demo talep et
                      </Link>
                      <button
                        type="button"
                        onClick={() => toggleCompareTeacher(teacher)}
                        className="rounded-xl border border-paper-300 bg-white px-3 py-2 text-xs font-semibold text-paper-900 hover:bg-paper-50"
                      >
                        Karşılaştır
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFavoriteTeacherIds((prev) => {
                            const next = new Set(prev);
                            next.delete(teacher.id);
                            window.localStorage.setItem(FAVORITE_TEACHERS_KEY, JSON.stringify([...next]));
                            return next;
                          });
                          setFavoriteTeacherDetails((prev) => {
                            const next = prev.filter((x) => x.id !== teacher.id);
                            window.localStorage.setItem(FAVORITE_TEACHER_DETAILS_KEY, JSON.stringify(next));
                            return next;
                          });
                        }}
                        className="rounded-xl border border-edu-sun-300 bg-edu-sun-50 px-3 py-2 text-xs font-semibold text-edu-sun-900 hover:bg-white"
                      >
                        Favoriden çıkar
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {compareTeachers.length > 0 && (
          <section className="mt-6 rounded-2xl border border-edu-indigo-200 bg-white/94 p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-paper-900">Karşılaştırma tepsisi</h2>
                <p className="mt-1 text-sm text-paper-800/65">
                  En fazla {MAX_COMPARE_TEACHERS} öğretmeni kalite, ücret, puan ve güven bilgileriyle yan yana inceleyin.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={shortlistRequestHref(compareTeachers)}
                  className="w-fit rounded-xl bg-edu-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-edu-indigo-800"
                >
                  Bu listeyle talep oluştur
                </Link>
                <button
                  type="button"
                  onClick={() => clearCompareTeachers()}
                  className="w-fit rounded-xl border border-paper-300 bg-white px-3 py-2 text-xs font-semibold text-paper-900 hover:bg-paper-50"
                >
                  Tepsiyi temizle
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {compareTeachers.map((teacher) => {
                const ratingText =
                  teacher.rating_count != null && Number(teacher.rating_count) > 0
                    ? `${Number(teacher.rating_avg ?? 0).toFixed(1)} (${teacher.rating_count})`
                    : "Yorum yok";
                return (
                  <article key={teacher.id} className="rounded-xl border border-edu-blue-100 bg-edu-blue-50/60 p-4 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link href={`/ogretmenler/${teacher.id}`} className="font-semibold text-paper-900 hover:text-edu-indigo-700">
                          {teacher.display_name}
                        </Link>
                        <div className="mt-1 text-xs text-paper-800/55">
                          {teacher.primary_branch_name ?? "Branş belirtilmemiş"} · {teacher.city_name ?? "Şehir yok"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleCompareTeacher(teacher)}
                        className="rounded-full border border-paper-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-paper-800"
                      >
                        Çıkar
                      </button>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-white p-2">
                        <dt className="text-paper-800/55">Kalite</dt>
                        <dd className="mt-0.5 font-semibold text-paper-900">{teacher.profile_quality_score ?? 0}/100</dd>
                      </div>
                      <div className="rounded-lg bg-white p-2">
                        <dt className="text-paper-800/55">Puan</dt>
                        <dd className="mt-0.5 font-semibold text-paper-900">{ratingText}</dd>
                      </div>
                      <div className="rounded-lg bg-white p-2">
                        <dt className="text-paper-800/55">Ücret</dt>
                        <dd className="mt-0.5 font-semibold text-paper-900">
                          {priceLabel(teacher.min_hourly_rate_minor, teacher.max_hourly_rate_minor)}
                        </dd>
                      </div>
                      <div className="rounded-lg bg-white p-2">
                        <dt className="text-paper-800/55">Ders geçmişi</dt>
                        <dd className="mt-0.5 font-semibold text-paper-900">{teacher.completed_sessions_count} ders</dd>
                      </div>
                    </dl>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {teacher.verification_status === "verified" && (
                        <span className="rounded-full bg-edu-success-50 px-2 py-0.5 text-[11px] font-medium text-edu-success-900">
                          Doğrulanmış
                        </span>
                      )}
                      {teacher.has_video && (
                        <span className="rounded-full bg-edu-indigo-50 px-2 py-0.5 text-[11px] font-medium text-edu-indigo-800">
                          Video
                        </span>
                      )}
                      {teacher.has_exam_docs && (
                        <span className="rounded-full bg-edu-sun-50 px-2 py-0.5 text-[11px] font-medium text-edu-sun-900">
                          Doküman
                        </span>
                      )}
                      {teacher.has_platform_links && (
                        <span className="rounded-full bg-paper-100 px-2 py-0.5 text-[11px] font-medium text-paper-800">
                          Platform
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-paper-800/65">
            {listLoading ? "Öğretmenler yükleniyor…" : `${total} öğretmen bulundu`}
          </p>
          <p className="text-xs text-paper-800/45">
            Önerilen sıralama; puan, doğrulama, profil kalitesi ve güncelliği birlikte kullanır.
          </p>
        </div>

        <div className="mt-4 space-y-2">
          {listLoading && rows.length === 0 ? (
            <div className="text-sm text-paper-800/55">Liste yükleniyor…</div>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-paper-200 bg-white p-6 text-sm text-paper-800/75">
              Kriterlere uyan öğretmen yok.
            </div>
          ) : (
            rows.map((t) => {
              const demoParams = new URLSearchParams();
              demoParams.set("requestKind", "demo");
              demoParams.set("teacherId", t.id);
              demoParams.set("teacherName", t.display_name);
              if (branchId !== "") demoParams.set("branchId", String(branchId));
              else if (t.primary_branch_id != null) demoParams.set("branchId", String(t.primary_branch_id));
              const demoPath = `/student/requests?${demoParams.toString()}`;
              const demoHref = sessionToken ? demoPath : loginHrefWithReturn(demoPath);
              const favorite = favoriteTeacherIds.has(t.id);
              const compared = compareTeachers.some((x) => x.id === t.id);
              const reasons = recommendationReasons(t);
              const score = trustScore(t);
              return (
              <article
                key={t.id}
                className="bo-card-lift group relative overflow-hidden rounded-2xl border border-edu-blue-100 bg-white/94 p-4 shadow-sm hover:border-edu-indigo-200 hover:bg-white hover:shadow-[0_22px_70px_rgba(79,70,229,0.12)]"
              >
                <span className="bo-shimmer-line absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-edu-indigo-500 via-edu-success-300 to-edu-sun-300 opacity-80" aria-hidden />
                <span className="pointer-events-none absolute -right-12 -top-16 h-32 w-32 rounded-full bg-edu-indigo-200/0 blur-3xl transition group-hover:bg-edu-indigo-200/35" aria-hidden />
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Link href={`/ogretmenler/${t.id}`} className="text-sm font-semibold text-paper-900 hover:text-edu-indigo-700">
                      {t.display_name}
                    </Link>
                    <div className="text-xs text-paper-800/55">
                      {t.primary_branch_name ? `${t.primary_branch_name} · ` : ""}
                      {t.city_name ?? "Şehir belirtilmemiş"}
                      {" · "}
                      {priceLabel(t.min_hourly_rate_minor, t.max_hourly_rate_minor)}
                      {" · "}
                      {t.verification_status === "verified"
                        ? "Doğrulanmış"
                        : `Durum: ${t.verification_status}`}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-edu-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-edu-indigo-800 ring-1 ring-edu-indigo-100">
                        Güven {score}/100
                      </span>
                      <span className="rounded-full bg-edu-success-50 px-2 py-0.5 text-[11px] font-medium text-edu-success-900">
                        {qualityLabel(t.profile_quality_score)} · {t.profile_quality_score ?? 0}/100
                      </span>
                      {t.has_video && (
                        <span className="rounded-full bg-edu-blue-50 px-2 py-0.5 text-[11px] font-medium text-edu-blue-900">
                          Video tanıtım
                        </span>
                      )}
                      {t.has_exam_docs && (
                        <span className="rounded-full bg-edu-sun-50 px-2 py-0.5 text-[11px] font-medium text-edu-sun-900">
                          Dokümanlı
                        </span>
                      )}
                      {t.has_platform_links && (
                        <span className="rounded-full bg-edu-indigo-50 px-2 py-0.5 text-[11px] font-medium text-edu-indigo-800">
                          Ek çalışma bağlantıları
                        </span>
                      )}
                      {t.completed_sessions_count > 0 && (
                        <span className="rounded-full bg-edu-success-50 px-2 py-0.5 text-[11px] font-medium text-edu-success-900">
                          {t.completed_sessions_count} tamamlanan ders
                        </span>
                      )}
                      <span className="rounded-full bg-edu-sun-50 px-2 py-0.5 text-[11px] font-medium text-edu-sun-900">
                        Güvenli ödeme süreci
                      </span>
                    </div>
                    <div className="mt-3 rounded-xl border border-edu-blue-100 bg-edu-blue-50/60 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold text-paper-900">{trustActionLabel(t)}</div>
                        <div className="text-[11px] font-semibold text-edu-indigo-800">{score}%</div>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white ring-1 ring-edu-blue-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-edu-indigo-500 via-edu-success-500 to-edu-sun-300 transition-[width]"
                          style={{ width: `${score}%` }}
                        />
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {(reasons.length ? reasons : ["Yeni profil; demo ve mesajla beklentiyi netleştirin"]).map((reason) => (
                          <span key={reason} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-paper-800 ring-1 ring-paper-200">
                            {reason}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-paper-800/75">
                    {t.rating_count != null && Number(t.rating_count) > 0
                      ? `★ ${Number(t.rating_avg ?? 0).toFixed(1)} (${t.rating_count})`
                      : "Henüz değerlendirme yok"}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-edu-blue-100 pt-3">
                  <Link
                    href={demoHref}
                    onClick={() =>
                      trackEvent("demo_request_start", {
                        entityType: "teacher",
                        entityId: t.id,
                        metadata: { source: "teacher_search", teacherName: t.display_name },
                      })
                    }
                    className="rounded-xl bg-edu-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-[0_10px_28px_rgba(79,70,229,0.2)] hover:bg-edu-indigo-800"
                  >
                    Demo talep et
                  </Link>
                  <button
                    type="button"
                    onClick={() => toggleCompareTeacher(t)}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                      compared
                        ? "border-edu-indigo-300 bg-edu-indigo-50 text-edu-indigo-800"
                        : "border-paper-300 bg-white text-paper-900 hover:bg-paper-50"
                    }`}
                  >
                    {compared ? "Karşılaştırmada" : "Karşılaştır"}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFavoriteTeacher(t)}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                      favorite
                        ? "border-edu-sun-300 bg-edu-sun-50 text-edu-sun-900"
                        : "border-paper-300 bg-white text-paper-900 hover:bg-paper-50"
                    }`}
                  >
                    {favorite ? "Favoride" : "Favoriye al"}
                  </button>
                </div>
              </article>
              );
            })
          )}
        </div>
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-edu-blue-100 bg-white/96 px-4 py-3 shadow-[0_-8px_30px_rgba(79,70,229,0.1)] backdrop-blur sm:hidden">
          <div className="mx-auto flex max-w-md items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className="rounded-xl border border-paper-300 bg-white px-3 py-2 text-xs font-semibold text-paper-900"
            >
              Filtre
            </button>
            <Link href={shortlistRequestHref(favoriteTeacherDetails)} className="flex-1 rounded-xl bg-edu-indigo-600 px-3 py-2 text-center text-xs font-semibold text-white">
              {favoriteTeacherIds.size ? `${favoriteTeacherIds.size} öğretmenle talep` : "Kısa listeyle talep"}
            </Link>
            <Link href={talepHref} className="rounded-xl border border-edu-indigo-200 bg-edu-indigo-50 px-3 py-2 text-xs font-semibold text-edu-indigo-800">
              Tek talep
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OgretmenlerPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] bg-paper-50 px-6 py-16">
          <div className="mx-auto max-w-4xl animate-pulse space-y-4">
            <div className="h-8 w-56 rounded-lg bg-paper-200" />
            <div className="h-28 rounded-xl bg-paper-200" />
            <div className="h-40 rounded-xl bg-paper-200" />
          </div>
        </div>
      }
    >
      <OgretmenlerPageInner />
    </Suspense>
  );
}
