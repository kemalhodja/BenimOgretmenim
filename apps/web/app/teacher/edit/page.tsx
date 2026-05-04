"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { clearToken, getToken } from "../../lib/auth";

type Branch = { id: number; parent_id: number | null; name: string; slug: string };
type City = { id: number; name: string; slug: string };

type TeacherMe = {
  teacher: {
    displayName: string;
    phone: string | null;
    bioRaw: string | null;
    videoUrl: string | null;
    instagramUrl?: string | null;
    platformLinks?: Array<{ title: string; url: string }>;
    examDocs?: Array<{ title: string; url: string; kind?: string }>;
    cityId: number | null;
    districtId: number | null;
    availability: Record<string, unknown>;
    branches: Array<{ branchId: number; isPrimary: boolean }>;
  };
};

export default function TeacherEditPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [cities, setCities] = useState<City[]>([]);

  const [bioRaw, setBioRaw] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [platformLinks, setPlatformLinks] = useState<
    Array<{ title: string; url: string }>
  >([]);
  const [examDocs, setExamDocs] = useState<
    Array<{ title: string; url: string; kind?: string }>
  >([]);
  const [cityId, setCityId] = useState<number | "">("");
  const [availability, setAvailability] = useState<string>("{}");

  const [selectedBranchIds, setSelectedBranchIds] = useState<number[]>([]);
  const [primaryBranchId, setPrimaryBranchId] = useState<number | "">("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [router, pathname]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const [m, b, c] = await Promise.all([
        apiFetch<TeacherMe>("/v1/teacher/me", { token }),
        apiFetch<{ branches: Branch[] }>("/v1/meta/branches"),
        apiFetch<{ cities: City[] }>("/v1/meta/cities"),
      ]);
      setBranches(b.branches);
      setCities(c.cities);

      setBioRaw(m.teacher.bioRaw ?? "");
      setVideoUrl(m.teacher.videoUrl ?? "");
      setInstagramUrl(m.teacher.instagramUrl ?? "");
      setPlatformLinks(m.teacher.platformLinks ?? []);
      setExamDocs(m.teacher.examDocs ?? []);
      setCityId(m.teacher.cityId ?? "");
      setAvailability(JSON.stringify(m.teacher.availability ?? {}, null, 2));

      const ids = (m.teacher.branches ?? []).map((x) => x.branchId);
      setSelectedBranchIds(ids);
      const prim = (m.teacher.branches ?? []).find((x) => x.isPrimary)?.branchId;
      setPrimaryBranchId(prim ?? (ids[0] ?? ""));
    })().catch((e) => setError(e instanceof Error ? e.message : "load_failed"));
  }, [token]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const focus = params.get("focus") ?? "";
    if (!focus) return;
    // Wait a tick for the page to render populated inputs.
    const id = window.setTimeout(() => {
      const el = document.querySelector(`[data-focus="${focus}"]`);
      if (el && "scrollIntoView" in el) {
        (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 50);
    return () => window.clearTimeout(id);
  }, []);

  const leafBranches = useMemo(() => {
    const hasChild = new Set<number>();
    for (const b of branches) if (b.parent_id != null) hasChild.add(b.parent_id);
    return branches.filter((b) => !hasChild.has(b.id));
  }, [branches]);

  const docKinds = useMemo(
    () => [
      { id: "yazili_hazirlik", label: "Yazılıya hazırlık" },
      { id: "dokuman", label: "Doküman" },
      { id: "platform", label: "Platform" },
    ],
    [],
  );

  function isValidHttpUrl(raw: string): boolean {
    const t = raw.trim();
    if (!t) return true; // boş bırakılabilir
    try {
      const u = new URL(t);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }

  function normalizeInstagramInput(raw: string): string {
    const t = raw.trim();
    if (!t) return "";
    if (t.startsWith("http://") || t.startsWith("https://")) return t;
    const h = t.startsWith("@") ? t.slice(1) : t;
    // If user pasted something like instagram.com/handle
    if (h.includes("instagram.com")) {
      const s = h.replace(/^www\./, "");
      if (s.startsWith("instagram.com/")) return `https://${s}`;
      if (s === "instagram.com") return "https://instagram.com";
    }
    // Plain handle (or handle with leading slash)
    const handle = h.replace(/^\//, "").split("/")[0]?.trim() ?? "";
    if (!handle) return "";
    return `https://instagram.com/${handle}`;
  }

  const validation = useMemo(() => {
    const videoOk = isValidHttpUrl(videoUrl);
    const instagramOk = isValidHttpUrl(instagramUrl);
    const platformInvalidIdx = (platformLinks ?? [])
      .map((x, i) => ({ i, url: (x.url ?? "").trim(), title: (x.title ?? "").trim() }))
      .filter((x) => (x.title.length > 0 || x.url.length > 0) && !isValidHttpUrl(x.url))
      .map((x) => x.i);
    const examInvalidIdx = (examDocs ?? [])
      .map((x, i) => ({ i, url: (x.url ?? "").trim(), title: (x.title ?? "").trim() }))
      .filter((x) => (x.title.length > 0 || x.url.length > 0) && !isValidHttpUrl(x.url))
      .map((x) => x.i);
    return {
      videoOk,
      instagramOk,
      platformInvalidIdx,
      examInvalidIdx,
      hasAnyInvalid:
        !videoOk ||
        !instagramOk ||
        platformInvalidIdx.length > 0 ||
        examInvalidIdx.length > 0,
    };
  }, [videoUrl, instagramUrl, platformLinks, examDocs]);

  async function saveProfile() {
    if (!token) return;
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      if (!validation.videoOk) throw new Error("Video URL geçersiz.");
      if (!validation.instagramOk) throw new Error("Instagram URL geçersiz.");
      if (validation.platformInvalidIdx.length > 0) {
        throw new Error("Özel platform linklerinde geçersiz URL var.");
      }
      if (validation.examInvalidIdx.length > 0) {
        throw new Error("Doküman linklerinde geçersiz URL var.");
      }

      let availabilityJson: Record<string, unknown> = {};
      try {
        availabilityJson = JSON.parse(availability) as Record<string, unknown>;
      } catch {
        throw new Error("availability JSON geçersiz");
      }
      const cleanPlatformLinks = (platformLinks ?? [])
        .map((x) => ({ title: x.title?.trim?.() ?? "", url: x.url?.trim?.() ?? "" }))
        .filter((x) => x.title.length > 0 && x.url.length > 0);
      const cleanExamDocs = (examDocs ?? [])
        .map((x) => ({
          title: x.title?.trim?.() ?? "",
          url: x.url?.trim?.() ?? "",
          kind: x.kind?.trim?.() ? x.kind?.trim?.() : undefined,
        }))
        .filter((x) => x.title.length > 0 && x.url.length > 0);

      await apiFetch<{ ok: true }>("/v1/teacher/me", {
        method: "PATCH",
        token,
        body: JSON.stringify({
          bioRaw,
          videoUrl: videoUrl || null,
          instagramUrl: instagramUrl || null,
          platformLinks: cleanPlatformLinks,
          examDocs: cleanExamDocs,
          cityId: cityId === "" ? null : cityId,
          availability: availabilityJson,
        }),
      });
      setOk("Profil kaydedildi.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "save_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Profili güncellemek için öğretmen hesabı gerekir.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveBranches() {
    if (!token) return;
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const primary =
        primaryBranchId === "" ? selectedBranchIds[0] : primaryBranchId;
      await apiFetch<{ ok: true }>("/v1/teacher/me/branches", {
        method: "PUT",
        token,
        body: JSON.stringify({
          branches: selectedBranchIds.map((id) => ({
            branchId: id,
            isPrimary: id === primary,
          })),
        }),
      });
      setOk("Branşlar kaydedildi.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "save_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Branşları güncellemek için öğretmen hesabı gerekir.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-zinc-500">Öğretmen</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
              Profil düzenle
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/teacher/requests"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Açık talepler
            </Link>
            <Link
              href="/teacher/teklifler"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Tekliflerim
            </Link>
            <Link
              href="/teacher/dersler"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Ders oturumları
            </Link>
            <Link
              href="/teacher/kurslar"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Online kurslar
            </Link>
            <Link
              href="/teacher/cuzdan"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Cüzdan
            </Link>
            <Link
              href="/teacher/dogrudan-dersler"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Doğrudan dersler
            </Link>
            <Link
              href="/teacher"
              className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
            >
              Panel
            </Link>
          </div>
        </div>

        {(error || ok) && (
          <div
            className={`mt-6 rounded-2xl border p-4 text-sm ${
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-brand-200 bg-brand-50 text-brand-800"
            }`}
          >
            {error ?? ok}
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-900">Profil</h2>
            <div className="mt-4 space-y-4">
              <label className="block" data-focus="bio">
                <div className="mb-1 text-sm font-medium text-zinc-700">
                  Biyografi
                </div>
                <textarea
                  value={bioRaw}
                  onChange={(e) => setBioRaw(e.target.value)}
                  className="min-h-28 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                />
              </label>

              <label className="block" data-focus="video">
                <div className="mb-1 text-sm font-medium text-zinc-700">
                  Video URL
                </div>
                <input
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-zinc-400 ${
                    validation.videoOk ? "border-zinc-200" : "border-red-300"
                  }`}
                  placeholder="https://..."
                />
                {!validation.videoOk && (
                  <div className="mt-1 text-xs text-red-700">
                    Geçerli bir http/https URL girin.
                  </div>
                )}
              </label>

              <label className="block" data-focus="instagram">
                <div className="mb-1 text-sm font-medium text-zinc-700">
                  Instagram URL
                </div>
                <input
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  onBlur={() =>
                    setInstagramUrl((prev) => normalizeInstagramInput(prev))
                  }
                  className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-zinc-400 ${
                    validation.instagramOk ? "border-zinc-200" : "border-red-300"
                  }`}
                  placeholder="https://instagram.com/kullaniciadi"
                />
                {!validation.instagramOk && (
                  <div className="mt-1 text-xs text-red-700">
                    Geçerli bir http/https URL girin.
                  </div>
                )}
              </label>

              <label className="block" data-focus="platformLinks">
                <div className="mb-1 text-sm font-medium text-zinc-700">
                  Özel platform linkleri
                </div>
                <div className="space-y-2">
                  {(platformLinks ?? []).length === 0 && (
                    <div className="text-xs text-zinc-500">
                      Henüz link eklemediniz.
                    </div>
                  )}
                  {(platformLinks ?? []).map((x, idx) => (
                    <div
                      key={`${idx}-${x.url}`}
                      className="grid grid-cols-1 gap-2 sm:grid-cols-5"
                    >
                      <input
                        value={x.title}
                        onChange={(e) =>
                          setPlatformLinks((prev) =>
                            prev.map((p, i) =>
                              i === idx ? { ...p, title: e.target.value } : p,
                            ),
                          )
                        }
                        className="rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400 sm:col-span-2"
                        placeholder="Başlık (örn: Zoom)"
                      />
                      <input
                        value={x.url}
                        onChange={(e) =>
                          setPlatformLinks((prev) =>
                            prev.map((p, i) =>
                              i === idx ? { ...p, url: e.target.value } : p,
                            ),
                          )
                        }
                        className={`rounded-xl border px-3 py-2 text-sm outline-none focus:border-zinc-400 sm:col-span-3 ${
                          validation.platformInvalidIdx.includes(idx)
                            ? "border-red-300"
                            : "border-zinc-200"
                        }`}
                        placeholder="https://..."
                      />
                      {validation.platformInvalidIdx.includes(idx) && (
                        <div className="sm:col-span-5 text-xs text-red-700">
                          Geçerli bir http/https URL girin.
                        </div>
                      )}
                      <div className="sm:col-span-5">
                        <button
                          type="button"
                          onClick={() =>
                            setPlatformLinks((prev) =>
                              prev.filter((_, i) => i !== idx),
                            )
                          }
                          className="text-xs font-medium text-red-700 underline decoration-red-200 underline-offset-4"
                        >
                          Sil
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setPlatformLinks((prev) => [
                        ...prev,
                        { title: "", url: "" },
                      ])
                    }
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900"
                  >
                    Link ekle
                  </button>
                </div>
              </label>

              <label className="block" data-focus="examDocs">
                <div className="mb-1 text-sm font-medium text-zinc-700">
                  Yazılıya hazırlık dokümanları
                </div>
                <div className="space-y-2">
                  {(examDocs ?? []).length === 0 && (
                    <div className="text-xs text-zinc-500">
                      Henüz doküman eklemediniz.
                    </div>
                  )}
                  {(examDocs ?? []).map((x, idx) => (
                    <div
                      key={`${idx}-${x.url}`}
                      className="grid grid-cols-1 gap-2 sm:grid-cols-6"
                    >
                      <input
                        value={x.title}
                        onChange={(e) =>
                          setExamDocs((prev) =>
                            prev.map((p, i) =>
                              i === idx ? { ...p, title: e.target.value } : p,
                            ),
                          )
                        }
                        className="rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400 sm:col-span-2"
                        placeholder="Başlık"
                      />
                      <input
                        value={x.url}
                        onChange={(e) =>
                          setExamDocs((prev) =>
                            prev.map((p, i) =>
                              i === idx ? { ...p, url: e.target.value } : p,
                            ),
                          )
                        }
                        className={`rounded-xl border px-3 py-2 text-sm outline-none focus:border-zinc-400 sm:col-span-3 ${
                          validation.examInvalidIdx.includes(idx)
                            ? "border-red-300"
                            : "border-zinc-200"
                        }`}
                        placeholder="https://..."
                      />
                      {validation.examInvalidIdx.includes(idx) && (
                        <div className="sm:col-span-6 text-xs text-red-700">
                          Geçerli bir http/https URL girin.
                        </div>
                      )}
                      <select
                        value={x.kind ?? "yazili_hazirlik"}
                        onChange={(e) =>
                          setExamDocs((prev) =>
                            prev.map((p, i) =>
                              i === idx
                                ? {
                                    ...p,
                                    kind: e.target.value || "yazili_hazirlik",
                                  }
                                : p,
                            ),
                          )
                        }
                        className="rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400 sm:col-span-1"
                      >
                        {docKinds.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.label}
                          </option>
                        ))}
                      </select>
                      <div className="sm:col-span-6">
                        <button
                          type="button"
                          onClick={() =>
                            setExamDocs((prev) =>
                              prev.filter((_, i) => i !== idx),
                            )
                          }
                          className="text-xs font-medium text-red-700 underline decoration-red-200 underline-offset-4"
                        >
                          Sil
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setExamDocs((prev) => [
                        ...prev,
                        { title: "", url: "", kind: "yazili_hazirlik" },
                      ])
                    }
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900"
                  >
                    Doküman ekle
                  </button>
                </div>
              </label>

              <label className="block" data-focus="city">
                <div className="mb-1 text-sm font-medium text-zinc-700">
                  Şehir
                </div>
                <select
                  value={cityId}
                  onChange={(e) =>
                    setCityId(e.target.value ? Number(e.target.value) : "")
                  }
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                >
                  <option value="">Seçiniz</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block" data-focus="availability">
                <div className="mb-1 text-sm font-medium text-zinc-700">
                  Müsaitlik (JSON)
                </div>
                <textarea
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                  className="min-h-40 w-full rounded-xl border border-zinc-200 px-3 py-2 font-mono text-xs outline-none focus:border-zinc-400"
                />
              </label>

              <button
                onClick={saveProfile}
                disabled={saving}
                className="w-full rounded-xl bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? "Kaydediliyor..." : "Profil kaydet"}
              </button>
              {validation.hasAnyInvalid && (
                <div className="text-xs text-red-700">
                  Bazı linkler geçersiz görünüyor. Kaydetmeden önce düzeltin.
                </div>
              )}
            </div>
          </div>

          <div
            className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
            data-focus="branches"
          >
            <h2 className="text-base font-semibold text-zinc-900">Branşlar</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Şimdilik sadece “leaf” (alt dalı olmayan) branşlar listelenir.
            </p>

            <div className="mt-4 space-y-4">
              <label className="block">
                <div className="mb-1 text-sm font-medium text-zinc-700">
                  Branş seçimi
                </div>
                <select
                  multiple
                  value={selectedBranchIds.map(String)}
                  onChange={(e) => {
                    const ids = Array.from(e.target.selectedOptions).map((o) =>
                      Number(o.value),
                    );
                    setSelectedBranchIds(ids);
                    if (
                      ids.length &&
                      (primaryBranchId === "" ||
                        !ids.includes(primaryBranchId as number))
                    ) {
                      setPrimaryBranchId(ids[0]);
                    }
                  }}
                  className="h-56 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                >
                  {leafBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <div className="mb-1 text-sm font-medium text-zinc-700">
                  Ana branş
                </div>
                <select
                  value={primaryBranchId}
                  onChange={(e) =>
                    setPrimaryBranchId(
                      e.target.value ? Number(e.target.value) : "",
                    )
                  }
                  disabled={selectedBranchIds.length === 0}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400 disabled:opacity-50"
                >
                  {selectedBranchIds.map((id) => {
                    const b = branches.find((x) => x.id === id);
                    return (
                      <option key={id} value={id}>
                        {b?.name ?? id}
                      </option>
                    );
                  })}
                </select>
              </label>

              <button
                onClick={saveBranches}
                disabled={saving}
                className="w-full rounded-xl bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? "Kaydediliyor..." : "Branşları kaydet"}
              </button>

              <div className="text-xs text-zinc-500">
                Seçili: {selectedBranchIds.length} branş
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4 text-xs text-zinc-600">
          <div className="font-medium text-zinc-900">Not</div>
          <div className="mt-1">
            İleride burayı rakipteki gibi adım adım onboarding sihirbazına
            çevireceğiz (AI mülakat → profil → branş → ücret → takvim).
          </div>
        </div>
      </div>
    </div>
  );
}

