"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { RegisterNavLink } from "../../components/AuthNavLinks";
import { apiFetch } from "../../lib/api";
import { clearToken, getToken } from "../../lib/auth";
import { loginHrefWithReturn } from "../../lib/authRedirect";

type TeacherDetail = {
  id: string;
  display_name: string;
  bio_raw: string | null;
  video_url?: string | null;
  instagram_url?: string | null;
  platform_links_jsonb?: Array<{ title: string; url: string }> | null;
  exam_docs_jsonb?: Array<{ title: string; url: string; kind?: string }> | null;
  verification_status: string;
  city_id: number | null;
  city_name: string | null;
  district_name: string | null;
  rating_avg: number | null;
  rating_count: number | null;
  profile_quality_score: number | null;
  has_video: boolean;
  has_exam_docs: boolean;
  has_platform_links: boolean;
  branch_count: number;
  completed_sessions_count: number;
  created_at: string;
};

type BranchRow = {
  branch_id: number;
  branch_name: string;
  years_experience: number | null;
  is_primary: boolean;
  hourly_rate_min_minor: number | null;
  hourly_rate_max_minor: number | null;
};

type ReviewRow = {
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_label: string;
};

function minorToTl(n: number): string {
  return (n / 100).toFixed(2);
}

function parseTlToMinorGross(raw: string): number {
  const t = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") throw new Error("Anlaşma tutarını girin (TL).");
  const n = Number(t);
  if (!Number.isFinite(n) || n < 10) throw new Error("En az 10,00 TL (API minimum).");
  if (n > 1_000_000) throw new Error("Tutar çok yüksek.");
  const minor = Math.round(n * 100);
  if (minor < 1_000) throw new Error("En az 10,00 TL.");
  if (!Number.isSafeInteger(minor)) throw new Error("Tutar geçersiz.");
  return minor;
}

function secondsFromYouTubeTime(raw: string | null): number | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) return Number(t);
  // Format examples: 1h2m3s, 90s, 2m
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (!m) return null;
  const h = Number(m[1] ?? 0);
  const mm = Number(m[2] ?? 0);
  const s = Number(m[3] ?? 0);
  const total = h * 3600 + mm * 60 + s;
  return Number.isFinite(total) && total > 0 ? total : null;
}

function kindLabel(kind: string | null | undefined): string | null {
  const k = (kind ?? "").trim();
  if (!k) return null;
  if (k === "yazili_hazirlik") return "Yazılıya hazırlık";
  if (k === "dokuman") return "Doküman";
  if (k === "platform") return "Platform";
  return k;
}

function kindSortKey(kind: string | null | undefined): number {
  const k = (kind ?? "").trim();
  if (k === "yazili_hazirlik") return 0;
  if (k === "dokuman") return 1;
  if (k === "platform") return 2;
  return 9;
}

function hostLabel(rawUrl: string): string | null {
  const t = rawUrl.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function qualityLabel(score: number | null | undefined): string {
  const n = Number(score ?? 0);
  if (n >= 80) return "Çok güçlü profil";
  if (n >= 60) return "Güçlü profil";
  if (n >= 40) return "Gelişen profil";
  return "Yeni profil";
}

function instagramHandle(rawUrl: string): string | null {
  const t = rawUrl.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    const host = u.hostname.replace(/^www\./, "");
    if (host !== "instagram.com") return null;
    const seg = u.pathname.split("/").filter(Boolean)[0];
    if (!seg) return null;
    if (seg.startsWith("@")) return seg;
    return `@${seg}`;
  } catch {
    return null;
  }
}

function getVideoEmbed(
  url: string,
): { provider: "youtube" | "vimeo"; embedUrl: string } | null {
  const u = url.trim();
  if (!u) return null;
  try {
    const parsed = new URL(u);
    const host = parsed.hostname.replace(/^www\./, "");
    const ytStart =
      secondsFromYouTubeTime(parsed.searchParams.get("t")) ??
      (parsed.searchParams.get("start")
        ? Number(parsed.searchParams.get("start"))
        : null);
    const start = ytStart && Number.isFinite(ytStart) && ytStart > 0 ? ytStart : null;
    // YouTube
    if (host === "youtube.com" || host === "m.youtube.com") {
      // /watch?v=ID or /shorts/ID or already /embed/ID
      const path = parsed.pathname;
      const v = parsed.searchParams.get("v");
      let id = v ?? null;
      if (!id && path.startsWith("/shorts/")) {
        id = path.split("/").filter(Boolean)[1] ?? null;
      }
      if (!id && path.startsWith("/embed/")) {
        id = path.split("/").filter(Boolean)[1] ?? null;
      }
      if (!id) return null;
      const qs = start ? `?start=${start}` : "";
      return {
        provider: "youtube",
        embedUrl: `https://www.youtube.com/embed/${id}${qs}`,
      };
    }
    if (host === "youtu.be") {
      const id = parsed.pathname.replace("/", "").trim();
      if (!id) return null;
      const qs = start ? `?start=${start}` : "";
      return {
        provider: "youtube",
        embedUrl: `https://www.youtube.com/embed/${id}${qs}`,
      };
    }
    // Vimeo
    if (host === "vimeo.com") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      if (!id) return null;
      return { provider: "vimeo", embedUrl: `https://player.vimeo.com/video/${id}` };
    }
    return null;
  } catch {
    return null;
  }
}

export default function OgretmenDetayPage() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const teacherId =
    typeof params.teacherId === "string" ? params.teacherId : "";
  const pathWithQuery = useMemo(() => {
    const base = pathname || (teacherId ? `/ogretmenler/${teacherId}` : "/ogretmenler");
    const q = searchParams.toString();
    return q ? `${base}?${q}` : base;
  }, [pathname, teacherId, searchParams]);
  const loginReturnHref = loginHrefWithReturn(pathWithQuery);

  const [teacher, setTeacher] = useState<TeacherDetail | null>(null);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [directTl, setDirectTl] = useState("500,00");
  const [directBusy, setDirectBusy] = useState(false);
  const [directError, setDirectError] = useState<string | null>(null);
  const [directOk, setDirectOk] = useState<string | null>(null);
  const [pendingDirectId, setPendingDirectId] = useState<string | null>(null);
  const [directFundBusy, setDirectFundBusy] = useState(false);

  const primaryBranchId = useMemo(() => {
    const p = branches.find((b) => b.is_primary);
    return (p ?? branches[0])?.branch_id;
  }, [branches]);

  const talepPath = primaryBranchId
    ? `/student/requests?branchId=${primaryBranchId}`
    : "/student/requests";
  const talepEntryHref = authToken ? talepPath : loginHrefWithReturn(talepPath);
  const demoTalepPath = useMemo(() => {
    const q = new URLSearchParams();
    q.set("requestKind", "demo");
    if (primaryBranchId) q.set("branchId", String(primaryBranchId));
    if (teacherId) q.set("teacherId", teacherId);
    if (teacher?.display_name) q.set("teacherName", teacher.display_name);
    return `/student/requests?${q.toString()}`;
  }, [primaryBranchId, teacherId, teacher?.display_name]);
  const demoTalepEntryHref = authToken ? demoTalepPath : loginHrefWithReturn(demoTalepPath);

  useEffect(() => {
    setAuthToken(getToken());
  }, []);

  useEffect(() => {
    if (!teacherId) return;
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const r = await apiFetch<{
          teacher: TeacherDetail;
          branches: BranchRow[];
          reviews: ReviewRow[];
        }>(`/v1/teachers/${teacherId}`);
        if (cancelled) return;
        setTeacher(r.teacher);
        setBranches(r.branches);
        setReviews(r.reviews ?? []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "load_failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teacherId]);

  async function createDirectBooking() {
    if (!authToken || !teacherId) {
      setDirectError("Giriş yapın.");
      return;
    }
    setDirectBusy(true);
    setDirectError(null);
    setDirectOk(null);
    setPendingDirectId(null);
    try {
      const agreedAmountMinor = parseTlToMinorGross(directTl);
      const r = await apiFetch<{
        booking: { id: string };
        next: { fundFromWallet: string };
      }>("/v1/student-platform/direct-bookings", {
        method: "POST",
        token: authToken,
        body: JSON.stringify({ teacherId, agreedAmountMinor }),
      });
      setPendingDirectId(r.booking.id);
      setDirectOk(
        "Anlaşma kaydedildi. Cüzdanınızdan ödeme alın; ardından öğretmen dersi portalında tamamlar.",
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "create_failed";
      if (msg.includes("[401]")) {
        clearToken();
        setAuthToken(null);
        router.replace(loginReturnHref);
        return;
      }
      if (msg.includes("student_platform_subscription")) {
        setDirectError("Aktif platform aboneliği gerekir. Öğrenci panelinden abonelik alın.");
      } else if (msg.includes("forbidden") && msg.includes("403")) {
        setDirectError(
          "Bu işlem yalnızca öğrenci hesabı içindir. Farklı bir hesapla giriş yaptıysanız öğrenci hesabıyla tekrar deneyin.",
        );
      } else {
        setDirectError(msg);
      }
    } finally {
      setDirectBusy(false);
    }
  }

  async function fundPendingDirect() {
    if (!authToken || !pendingDirectId) return;
    setDirectFundBusy(true);
    setDirectError(null);
    try {
      await apiFetch(
        `/v1/student-platform/direct-bookings/${pendingDirectId}/fund-from-wallet`,
        { method: "POST", token: authToken },
      );
      setDirectOk("Ödeme cüzdanınızdan alındı.");
      setPendingDirectId(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "fund_failed";
      if (msg.includes("[401]")) {
        clearToken();
        setAuthToken(null);
        router.replace(loginReturnHref);
        return;
      }
      if (msg.includes("[403]")) {
        setDirectError("Bu ödemeyi yapmak için öğrenci hesabı gerekir.");
        return;
      }
      if (msg.includes("insufficient_balance") || (msg.includes("[409]") && msg.includes("insufficient"))) {
        setDirectError("Bakiye yetersiz. Öğrenci panelinden cüzdan yükleyin, sonra tekrar deneyin.");
        return;
      }
      setDirectError(msg);
    } finally {
      setDirectFundBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/ogretmenler"
          className="text-sm font-medium text-paper-800/75 underline decoration-paper-300 underline-offset-4 hover:text-paper-900"
        >
          ← Öğretmen listesi
        </Link>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!teacher && !error && (
        <div className="mt-8 text-sm text-paper-800/55">Yükleniyor…</div>
      )}

      {teacher && (
        <>
          <div className="mt-8 rounded-xl border border-paper-200 bg-white p-6">
            <h1 className="text-2xl font-semibold tracking-tight text-paper-900">
              {teacher.display_name}
            </h1>
            <div className="mt-2 text-sm text-paper-800/75">
              {teacher.city_name ?? "Şehir belirtilmemiş"}
              {teacher.district_name ? ` · ${teacher.district_name}` : ""}
              {" · "}
              {teacher.verification_status === "verified"
                ? "Doğrulanmış profil"
                : `Profil: ${teacher.verification_status}`}
            </div>
            <div className="mt-2 text-sm text-paper-800/75">
              {teacher.rating_count != null && Number(teacher.rating_count) > 0
                ? `★ ${Number(teacher.rating_avg ?? 0).toFixed(1)} (${teacher.rating_count} değerlendirme)`
                : "Henüz değerlendirme yok"}
            </div>
            <div className="mt-4 rounded-xl border border-paper-100 bg-paper-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-paper-900">Güven ve kalite</h2>
                  <p className="mt-1 text-xs text-paper-800/65">
                    Profil doluluğu, doğrulama, video, doküman ve ders geçmişine göre.
                  </p>
                </div>
                <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-paper-900 ring-1 ring-paper-200">
                  {qualityLabel(teacher.profile_quality_score)} · {teacher.profile_quality_score ?? 0}/100
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {teacher.verification_status === "verified" && (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-900">
                    Doğrulanmış profil
                  </span>
                )}
                {teacher.has_video && (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-900">
                    Video tanıtım
                  </span>
                )}
                {teacher.has_exam_docs && (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-900">
                    Doküman / sınav içeriği
                  </span>
                )}
                {teacher.has_platform_links && (
                  <span className="rounded-full bg-paper-100 px-2 py-0.5 text-[11px] font-medium text-paper-800">
                    Platform bağlantıları
                  </span>
                )}
                {teacher.branch_count > 0 && (
                  <span className="rounded-full bg-paper-100 px-2 py-0.5 text-[11px] font-medium text-paper-800">
                    {teacher.branch_count} branş
                  </span>
                )}
                {teacher.completed_sessions_count > 0 && (
                  <span className="rounded-full bg-paper-100 px-2 py-0.5 text-[11px] font-medium text-paper-800">
                    {teacher.completed_sessions_count} tamamlanan ders
                  </span>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={demoTalepEntryHref}
                className="inline-flex rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-900"
              >
                Demo ders talep et
              </Link>
              <Link
                href={talepEntryHref}
                className="inline-flex rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-900 hover:bg-brand-100"
              >
                Talep oluştur
              </Link>
              <RegisterNavLink className="inline-flex items-center rounded-xl border border-paper-300 bg-white px-4 py-2.5 text-sm font-medium text-paper-900 hover:bg-paper-50">
                Kayıt ol
              </RegisterNavLink>
            </div>

            {authToken ? (
              <div className="mt-6 rounded-xl border border-paper-200 bg-paper-50/80 p-4">
                <h2 className="text-sm font-semibold text-paper-900">Doğrudan ders anlaşması</h2>
                <p className="mt-1 text-xs text-paper-800/75">
                  Toplam tutar cüzdandan düşer; ders tamamlanınca öğretmene aktarılır.{" "}
                  <Link className="font-medium text-brand-800 underline-offset-4 hover:underline" href="/student/panel">
                    Cüzdan
                  </Link>
                  .
                </p>
                {directError && (
                  <div className="mt-2 text-sm text-red-700">{directError}</div>
                )}
                {directOk && (
                  <div className="mt-2 text-sm text-brand-900">{directOk}</div>
                )}
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <label className="text-sm text-paper-900">
                    Tutar (TL)
                    <input
                      type="text"
                      inputMode="decimal"
                      value={directTl}
                      onChange={(e) => setDirectTl(e.target.value)}
                      className="ml-0 mt-1 block w-32 rounded-lg border border-paper-200 bg-white px-2 py-1.5 font-mono text-sm outline-none focus:border-brand-400"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={directBusy}
                    onClick={() => void createDirectBooking()}
                    className="rounded-xl bg-brand-800 px-3 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-50"
                  >
                    {directBusy ? "…" : "Anlaşma oluştur"}
                  </button>
                  {pendingDirectId && (
                    <button
                      type="button"
                      disabled={directFundBusy}
                      onClick={() => void fundPendingDirect()}
                      className="rounded-xl border border-paper-300 bg-white px-3 py-2 text-sm font-medium text-paper-900 hover:bg-paper-50 disabled:opacity-50"
                    >
                      {directFundBusy ? "…" : "Cüzdanımdan öde"}
                    </button>
                  )}
                  <Link
                    className="rounded-xl border border-paper-300 bg-white px-3 py-2 text-sm font-medium text-paper-900 hover:bg-paper-50"
                    href="/student/dogrudan-dersler"
                  >
                    Anlaşmalarım
                  </Link>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-paper-800/55">
                Doğrudan anlaşma için{" "}
                <Link className="font-medium text-brand-800 underline-offset-4 hover:underline" href={loginReturnHref}>
                  giriş yapın
                </Link>{" "}
                (öğrenci; abonelik ve cüzdan gerekir).
              </p>
            )}

            {(teacher.video_url ||
              teacher.instagram_url ||
              (teacher.platform_links_jsonb?.length ?? 0) > 0 ||
              (teacher.exam_docs_jsonb?.length ?? 0) > 0) && (
              <div className="mt-8">
                <h2 className="text-sm font-semibold text-paper-900">
                  Bağlantılar
                </h2>
                <div className="mt-3 space-y-3 text-sm">
                  {teacher.video_url && (
                    <div>
                      <div className="text-xs font-medium text-paper-800/55">
                        Video
                      </div>
                      {(() => {
                        const emb = getVideoEmbed(teacher.video_url ?? "");
                        if (!emb) return null;
                        return (
                          <div className="mt-2 overflow-hidden rounded-xl border border-paper-200 bg-paper-50">
                            <div className="relative aspect-video">
                              <iframe
                                src={emb.embedUrl}
                                title="Video tanıtım"
                                className="absolute inset-0 h-full w-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            </div>
                          </div>
                        );
                      })()}
                      <a
                        href={teacher.video_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-brand-800 underline decoration-brand-200 underline-offset-4"
                      >
                        Video tanıtımı aç
                      </a>
                    </div>
                  )}

                  {teacher.instagram_url && (
                    <div>
                      <div className="text-xs font-medium text-paper-800/55">
                        Instagram
                      </div>
                      <a
                        href={teacher.instagram_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-brand-800 underline decoration-brand-200 underline-offset-4"
                      >
                        {instagramHandle(teacher.instagram_url) ??
                          "Instagram profili"}
                      </a>
                      {hostLabel(teacher.instagram_url) && (
                        <span className="ml-2 text-xs text-paper-800/50">
                          ({hostLabel(teacher.instagram_url)})
                        </span>
                      )}
                    </div>
                  )}

                  {(teacher.platform_links_jsonb?.length ?? 0) > 0 && (
                    <div>
                      <div className="text-xs font-medium text-paper-800/55">
                        Özel platformlar
                      </div>
                      <ul className="mt-1 space-y-1">
                        {(teacher.platform_links_jsonb ?? []).map((x, i) => (
                          <li key={`${x.url}-${i}`}>
                            <a
                              href={x.url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-medium text-brand-800 underline decoration-brand-200 underline-offset-4"
                            >
                              {x.title}
                            </a>
                            {hostLabel(x.url) && (
                              <span className="ml-2 text-xs text-paper-800/50">
                                ({hostLabel(x.url)})
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {(teacher.exam_docs_jsonb?.length ?? 0) > 0 && (
                    <div>
                      <div className="text-xs font-medium text-paper-800/55">
                        Dokümanlar
                      </div>
                      {(() => {
                        const docs = [...(teacher.exam_docs_jsonb ?? [])].sort(
                          (a, b) =>
                            kindSortKey(a.kind) - kindSortKey(b.kind) ||
                            a.title.localeCompare(b.title, "tr"),
                        );
                        const groups = new Map<string, typeof docs>();
                        for (const d of docs) {
                          const lbl = kindLabel(d.kind) ?? "Diğer";
                          const prev = groups.get(lbl);
                          if (prev) prev.push(d);
                          else groups.set(lbl, [d]);
                        }
                        const entries = Array.from(groups.entries());
                        return (
                          <div className="mt-2 space-y-3">
                            {entries.map(([lbl, items]) => (
                              <div key={lbl}>
                                <div className="text-xs font-semibold text-paper-800">
                                  {lbl}
                                </div>
                                <ul className="mt-1 space-y-1">
                                  {items.map((x, i) => (
                                    <li key={`${x.url}-${i}`}>
                                      <a
                                        href={x.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="font-medium text-brand-800 underline decoration-brand-200 underline-offset-4"
                                      >
                                        {x.title}
                                      </a>
                                      {hostLabel(x.url) && (
                                        <span className="ml-2 text-xs text-paper-800/50">
                                          ({hostLabel(x.url)})
                                        </span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            )}

            {teacher.bio_raw && (
              <div className="mt-8">
                <h2 className="text-sm font-semibold text-paper-900">Hakkında</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-paper-800/85">
                  {teacher.bio_raw}
                </p>
              </div>
            )}

            <div className="mt-8">
              <h2 className="text-sm font-semibold text-paper-900">Branşlar</h2>
              {branches.length === 0 ? (
                <p className="mt-2 text-sm text-paper-800/55">Branş kaydı yok.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {branches.map((b) => (
                    <li
                      key={b.branch_id}
                      className="rounded-xl border border-paper-100 px-3 py-2 text-sm text-paper-800"
                    >
                      <span className="font-medium">{b.branch_name}</span>
                      {b.is_primary && (
                        <span className="ml-2 text-xs text-brand-700">(birincil)</span>
                      )}
                      {b.years_experience != null && (
                        <span className="ml-2 text-xs text-paper-800/55">
                          {b.years_experience} yıl
                        </span>
                      )}
                      {b.hourly_rate_min_minor != null &&
                        b.hourly_rate_max_minor != null && (
                          <div className="mt-1 text-xs text-paper-800/55">
                            Saatlik (TL): {minorToTl(b.hourly_rate_min_minor)} –{" "}
                            {minorToTl(b.hourly_rate_max_minor)}
                          </div>
                        )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="mt-8 rounded-xl border border-paper-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-paper-900">Yorumlar</h2>
            <p className="mt-1 text-xs text-paper-800/55">
              Tamamlanan derslerden; yorumcu adı gizlilik için kısaltılır.
            </p>
            {reviews.length === 0 ? (
              <p className="mt-4 text-sm text-paper-800/75">Henüz yorum yok.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {reviews.map((rev, i) => (
                  <li
                    key={`${rev.created_at}-${i}`}
                    className="border-b border-paper-100 pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-paper-900">
                        {rev.reviewer_label}
                      </span>
                      <span className="text-sm text-brand-800">
                        {"★".repeat(Math.min(5, Math.max(1, rev.rating)))}
                      </span>
                    </div>
                    <div className="text-xs text-paper-800/55">
                      {new Date(rev.created_at).toLocaleDateString("tr-TR")}
                    </div>
                    {rev.comment && (
                      <p className="mt-2 text-sm text-paper-800/85">{rev.comment}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
      </div>
    </div>
  );
}
