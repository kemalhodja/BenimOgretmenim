"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { clearToken, getToken } from "../../lib/auth";

type Branch = { id: number; parent_id: number | null; name: string; slug: string };
type City = { id: number; name: string; slug: string };
type District = { id: number; city_id: number; name: string; slug: string };

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
  checklist: Record<string, boolean>;
  completionScore: number;
};

const checklistLabels: Record<string, string> = {
  branchesSelected: "En az bir branş seç",
  citySet: "Şehir bilgisini ekle",
  districtSet: "İlçe bilgisini ekle",
  availabilitySet: "Müsaitlik saatlerini doldur",
  bioFilled: "En az 40 karakterlik biyografi yaz",
  videoLinked: "Tanıtım videosu ekle",
  instagramLinked: "Instagram/profil linki ekle",
  platformLinksAdded: "Ders platformu linki ekle",
  examDocsAdded: "Örnek doküman veya başarı belgesi ekle",
  onboardingInterviewDone: "Tanışma adımını tamamla",
  curriculumStarted: "Müfredat planı başlat",
};

const availabilityPresets = [
  {
    label: "Hafta içi akşam",
    value: {
      monday: ["19:00-22:00"],
      tuesday: ["19:00-22:00"],
      wednesday: ["19:00-22:00"],
      thursday: ["19:00-22:00"],
      friday: ["19:00-22:00"],
    },
  },
  {
    label: "Hafta sonu yoğun",
    value: {
      saturday: ["10:00-13:00", "15:00-18:00"],
      sunday: ["10:00-13:00", "15:00-18:00"],
    },
  },
  {
    label: "Sınav dönemi",
    value: {
      monday: ["18:00-21:00"],
      wednesday: ["18:00-21:00"],
      friday: ["18:00-21:00"],
      saturday: ["09:00-12:00", "14:00-17:00"],
      sunday: ["09:00-12:00"],
    },
  },
] as const;

export default function TeacherEditPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);

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
  const [districtId, setDistrictId] = useState<number | "">("");
  const [availability, setAvailability] = useState<string>("{}");

  const [selectedBranchIds, setSelectedBranchIds] = useState<number[]>([]);
  const [primaryBranchId, setPrimaryBranchId] = useState<number | "">("");
  const [completionScore, setCompletionScore] = useState(0);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

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
      setDistrictId(m.teacher.districtId ?? "");
      setAvailability(JSON.stringify(m.teacher.availability ?? {}, null, 2));
      setCompletionScore(m.completionScore ?? 0);
      setChecklist(m.checklist ?? {});

      const ids = (m.teacher.branches ?? []).map((x) => x.branchId);
      setSelectedBranchIds(ids);
      const prim = (m.teacher.branches ?? []).find((x) => x.isPrimary)?.branchId;
      setPrimaryBranchId(prim ?? (ids[0] ?? ""));
    })().catch((e) => setError(e instanceof Error ? e.message : "load_failed"));
  }, [token]);

  useEffect(() => {
    if (cityId === "") {
      setDistricts([]);
      setDistrictId("");
      return;
    }
    apiFetch<{ districts: District[] }>(`/v1/meta/districts?cityId=${cityId}`)
      .then((r) => {
        setDistricts(r.districts);
        setDistrictId((prev) =>
          prev !== "" && r.districts.some((d) => d.id === prev) ? prev : "",
        );
      })
      .catch(() => setDistricts([]));
  }, [cityId]);

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
          districtId: districtId === "" ? null : districtId,
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

  const missingChecklist = Object.entries(checklistLabels).filter(([key]) => !checklist[key]);
  const websiteEssentials = [
    { key: "bioFilled", focus: "bio", title: "Güçlü açılış metni", body: "Profil hero alanı biyografinizin ilk cümlelerinden beslenir." },
    { key: "branchesSelected", focus: "branches", title: "Uzmanlık vitrini", body: "Birincil branş ve fiyat aralığı profilinizde net görünür." },
    { key: "videoLinked", focus: "video", title: "Video tanıtım", body: "Kendi web siteniz gibi ilk güven temasını hızlandırır." },
    { key: "examDocsAdded", focus: "examDocs", title: "Kanıt ve içerik", body: "Belgeler, yazılı hazırlık içerikleri ve örnek dokümanlar karar güvenini artırır." },
    { key: "availabilitySet", focus: "availability", title: "Müsaitlik", body: "Veli/öğrenci derse başlama ihtimalini saat bilgisiyle daha hızlı değerlendirir." },
  ];
  const websiteReadyCount = websiteEssentials.filter((item) => checklist[item.key]).length;

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Profil düzenle</h1>
          <p className="mt-1 text-sm text-paper-800/65">Kayıttan sonra diğer sayfalar üst menüden.</p>
        </div>

        {(error || ok) && (
          <div
            className={`mt-6 rounded-xl border p-4 text-sm ${
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-brand-200 bg-brand-50 text-brand-800"
            }`}
          >
            {error ?? ok}
          </div>
        )}

        <div className="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-brand-950">Profil kalite puanı</h2>
              <p className="mt-1 text-sm text-brand-900">
                Bu puan öğretmen kartlarında güven bilgisi olarak kullanılır; eksikleri tamamladıkça görünürlük artar.
              </p>
            </div>
            <div className="text-3xl font-semibold text-brand-900">{completionScore}/100</div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-brand-700"
              style={{ width: `${Math.min(100, Math.max(0, completionScore))}%` }}
            />
          </div>
          {missingChecklist.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {missingChecklist.slice(0, 6).map(([key, label]) => (
                <span key={key} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-brand-900">
                  {label}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm font-medium text-brand-900">
              Profil kalite adımları tamam. Admin doğrulama ve öğrenci yorumları puanı daha da güçlendirir.
            </p>
          )}
        </div>

        <section className="mt-6 rounded-2xl border border-paper-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-800/70">
                Profil web sitesi hazırlığı
              </div>
              <h2 className="mt-1 text-base font-semibold text-paper-950">
                Öğretmen profiliniz artık kişisel web siteniz gibi çalışır
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-paper-800/65">
                Hero alanı, güven vitrini, ders yöntemi, kanıtlar ve CTA’lar aşağıdaki bilgilerden beslenir.
              </p>
            </div>
            <div className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-900">
              {websiteReadyCount}/{websiteEssentials.length} hazır
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            {websiteEssentials.map((item) => (
              <a
                key={item.key}
                href={`/teacher/edit?focus=${item.focus}`}
                className={`rounded-xl border p-3 ${
                  checklist[item.key]
                    ? "border-brand-200 bg-brand-50/60"
                    : "border-paper-200 bg-paper-50 hover:border-brand-200 hover:bg-brand-50/40"
                }`}
              >
                <div className="text-xs font-semibold text-paper-950">{item.title}</div>
                <p className="mt-1 text-xs leading-relaxed text-paper-800/60">{item.body}</p>
                <div className="mt-2 text-[11px] font-semibold text-brand-900">
                  {checklist[item.key] ? "Hazır" : "Tamamla"}
                </div>
              </a>
            ))}
          </div>
        </section>

        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-paper-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-paper-900">Profil</h2>
            <div className="mt-4 space-y-4">
              <label className="block" data-focus="bio">
                <div className="mb-1 text-sm font-medium text-paper-800">
                  Biyografi
                </div>
                <textarea
                  value={bioRaw}
                  onChange={(e) => setBioRaw(e.target.value)}
                  className="min-h-28 w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                />
              </label>

              <label className="block" data-focus="video">
                <div className="mb-1 text-sm font-medium text-paper-800">
                  Video URL
                </div>
                <input
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-brand-400 ${
                    validation.videoOk ? "border-paper-200" : "border-red-300"
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
                <div className="mb-1 text-sm font-medium text-paper-800">
                  Instagram URL
                </div>
                <input
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  onBlur={() =>
                    setInstagramUrl((prev) => normalizeInstagramInput(prev))
                  }
                  className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-brand-400 ${
                    validation.instagramOk ? "border-paper-200" : "border-red-300"
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
                <div className="mb-1 text-sm font-medium text-paper-800">
                  Özel platform linkleri
                </div>
                <div className="space-y-2">
                  {(platformLinks ?? []).length === 0 && (
                    <div className="text-xs text-paper-800/55">
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
                        className="rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400 sm:col-span-2"
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
                        className={`rounded-xl border px-3 py-2 text-sm outline-none focus:border-brand-400 sm:col-span-3 ${
                          validation.platformInvalidIdx.includes(idx)
                            ? "border-red-300"
                            : "border-paper-200"
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
                    className="rounded-xl border border-paper-200 bg-white px-3 py-2 text-sm font-medium text-paper-900"
                  >
                    Link ekle
                  </button>
                </div>
              </label>

              <label className="block" data-focus="examDocs">
                <div className="mb-1 text-sm font-medium text-paper-800">
                  Yazılıya hazırlık dokümanları
                </div>
                <div className="space-y-2">
                  {(examDocs ?? []).length === 0 && (
                    <div className="text-xs text-paper-800/55">
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
                        className="rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400 sm:col-span-2"
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
                        className={`rounded-xl border px-3 py-2 text-sm outline-none focus:border-brand-400 sm:col-span-3 ${
                          validation.examInvalidIdx.includes(idx)
                            ? "border-red-300"
                            : "border-paper-200"
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
                        className="rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400 sm:col-span-1"
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
                    className="rounded-xl border border-paper-200 bg-white px-3 py-2 text-sm font-medium text-paper-900"
                  >
                    Doküman ekle
                  </button>
                </div>
              </label>

              <label className="block" data-focus="city">
                <div className="mb-1 text-sm font-medium text-paper-800">
                  Şehir
                </div>
                <select
                  value={cityId}
                  onChange={(e) =>
                    setCityId(e.target.value ? Number(e.target.value) : "")
                  }
                  className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                >
                  <option value="">Seçiniz</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block" data-focus="district">
                <div className="mb-1 text-sm font-medium text-paper-800">
                  İlçe
                </div>
                <select
                  value={districtId}
                  onChange={(e) =>
                    setDistrictId(e.target.value ? Number(e.target.value) : "")
                  }
                  disabled={cityId === "" || districts.length === 0}
                  className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400 disabled:opacity-50"
                >
                  <option value="">Seçiniz</option>
                  {districts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block" data-focus="availability">
                <div className="mb-1 text-sm font-medium text-paper-800">
                  Müsaitlik (JSON)
                </div>
                <div className="mb-2 flex flex-wrap gap-2">
                  {availabilityPresets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setAvailability(JSON.stringify(preset.value, null, 2))}
                      className="rounded-full border border-paper-200 bg-white px-3 py-1 text-xs font-medium text-paper-900 hover:border-brand-200 hover:bg-brand-50"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                  className="min-h-40 w-full rounded-xl border border-paper-200 px-3 py-2 font-mono text-xs outline-none focus:border-brand-400"
                />
              </label>

              <button
                onClick={saveProfile}
                disabled={saving}
                className="w-full rounded-xl bg-brand-800 px-3 py-2.5 text-sm font-medium text-white disabled:opacity-50"
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
            className="rounded-xl border border-paper-200 bg-white p-5 shadow-sm"
            data-focus="branches"
          >
            <h2 className="text-base font-semibold text-paper-900">Branşlar</h2>
            <p className="mt-1 text-sm text-paper-800/75">
              Sadece en alt seviyedeki branşlar listelenir. Örneğin “Matematik” yerine ilgili alt alanı seçebilirsiniz.
            </p>

            <div className="mt-4 space-y-4">
              <label className="block">
                <div className="mb-1 text-sm font-medium text-paper-800">
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
                  className="h-56 w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                >
                  {leafBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <div className="mb-1 text-sm font-medium text-paper-800">
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
                  className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400 disabled:opacity-50"
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
                className="w-full rounded-xl bg-brand-800 px-3 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? "Kaydediliyor..." : "Branşları kaydet"}
              </button>

              <div className="text-xs text-paper-800/55">
                Seçili: {selectedBranchIds.length} branş
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

