"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { TeacherPanelHeader } from "../../components/TeacherPanelHeader";
import { apiFetch } from "../../lib/api";
import { getToken } from "../../lib/auth";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { embedVideoUrl, gradeLevelLabel, GRADE_LEVEL_OPTIONS } from "../../lib/gradeLevels";
import { isAllowedVideoHost, videoKindLabel, type VideoKind } from "../../lib/lessonVideos";

type TeacherBranch = { branchId: number; name: string; slug: string };

type LessonVideo = {
  id: string;
  gradeLevel: number;
  branchId: number;
  branchName: string;
  topicTitle: string;
  outcomeCode: string;
  outcomeTitle: string;
  title: string;
  description: string | null;
  videoUrl: string;
  videoKind: VideoKind;
  durationMinutes: number | null;
  status: string;
  moderationStatus?: string;
  moderationNote?: string | null;
  viewCount: number;
  uniqueViewerCount: number;
};

type OutcomeSuggestion = {
  outcomeTitle: string;
  branchSlug: string | null;
  gradeLevel: number | null;
};

type CurriculumOutcome = {
  outcomeCode: string;
  outcomeTitle: string;
  unitTitle: string;
  branchSlug: string;
  branchName: string;
  gradeLevel: number;
};

const emptyForm = {
  gradeLevel: "8",
  branchId: "",
  topicTitle: "",
  outcomeCode: "",
  outcomeTitle: "",
  title: "",
  description: "",
  videoUrl: "",
  videoKind: "lesson" as VideoKind,
  durationMinutes: "",
};

function moderationLabel(status: string): string {
  if (status === "approved") return "Yayında";
  if (status === "pending_review") return "İnceleniyor";
  if (status === "rejected") return "Reddedildi";
  if (status === "flagged") return "İşaretlendi";
  return status;
}

function moderationClass(status: string): string {
  if (status === "approved") return "bg-green-50 text-green-800";
  if (status === "pending_review") return "bg-amber-50 text-amber-900";
  if (status === "rejected") return "bg-red-50 text-red-800";
  return "bg-paper-100 text-paper-800";
}

export default function TeacherDersVideolariPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [branches, setBranches] = useState<TeacherBranch[]>([]);
  const [videos, setVideos] = useState<LessonVideo[]>([]);
  const [suggestions, setSuggestions] = useState<OutcomeSuggestion[]>([]);
  const [curriculumOutcomes, setCurriculumOutcomes] = useState<CurriculumOutcome[]>([]);
  const [outcomeSearch, setOutcomeSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const selectedBranch = useMemo(
    () => branches.find((b) => String(b.branchId) === form.branchId) ?? null,
    [branches, form.branchId],
  );

  const videoPreview = useMemo(() => {
    const url = form.videoUrl.trim();
    if (!url) return { ok: false, message: null as string | null, embed: null as string | null };
    if (!url.startsWith("https://")) return { ok: false, message: "Bağlantı https:// ile başlamalı.", embed: null };
    if (!isAllowedVideoHost(url)) {
      return { ok: false, message: "Yalnızca YouTube veya Vimeo bağlantıları desteklenir.", embed: null };
    }
    return { ok: true, message: null, embed: embedVideoUrl(url) };
  }, [form.videoUrl]);

  const totalViews = useMemo(() => videos.reduce((sum, v) => sum + v.viewCount, 0), [videos]);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [pathname, router]);

  const loadSuggestions = useCallback(async (gradeLevel: string, branchSlug: string | null) => {
    if (!branchSlug) {
      setSuggestions([]);
      return;
    }
    try {
      const q = new URLSearchParams({ gradeLevel, branchSlug });
      const r = await apiFetch<{ suggestions: OutcomeSuggestion[] }>(
        `/v1/lesson-videos/outcome-suggestions?${q.toString()}`,
      );
      setSuggestions(r.suggestions);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const loadCurriculum = useCallback(async (gradeLevel: string, branchSlug: string | null, topic: string) => {
    if (!branchSlug) {
      setCurriculumOutcomes([]);
      return;
    }
    try {
      const q = new URLSearchParams({ gradeLevel, branchSlug });
      if (topic.trim()) q.set("topic", topic.trim());
      const r = await apiFetch<{ outcomes: CurriculumOutcome[] }>(
        `/v1/lesson-videos/curriculum-outcomes?${q.toString()}`,
      );
      setCurriculumOutcomes(r.outcomes);
    } catch {
      setCurriculumOutcomes([]);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [teacherRes, videoRes] = await Promise.all([
        apiFetch<{ teacher: { branches: TeacherBranch[] } }>("/v1/teacher/me"),
        apiFetch<{ videos: LessonVideo[] }>("/v1/lesson-videos/mine"),
      ]);
      const teacherBranches = (teacherRes.teacher.branches ?? []) as TeacherBranch[];
      setBranches(teacherBranches);
      setVideos(videoRes.videos);
      setForm((f) => {
        const branchId = f.branchId || String(teacherBranches[0]?.branchId ?? "");
        return { ...f, branchId };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Veriler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    void load();
  }, [token, load]);

  useEffect(() => {
    if (!form.branchId || !form.gradeLevel) return;
    const slug = branches.find((b) => String(b.branchId) === form.branchId)?.slug ?? null;
    void loadSuggestions(form.gradeLevel, slug);
    void loadCurriculum(form.gradeLevel, slug, outcomeSearch);
  }, [form.branchId, form.gradeLevel, branches, loadSuggestions, loadCurriculum, outcomeSearch]);

  function applySuggestion(s: OutcomeSuggestion) {
    setForm((f) => ({
      ...f,
      outcomeTitle: s.outcomeTitle,
      topicTitle: f.topicTitle || s.outcomeTitle,
      outcomeCode: f.outcomeCode || `K.${f.gradeLevel}.1`,
    }));
  }

  function applyCurriculumOutcome(o: CurriculumOutcome) {
    setForm((f) => ({
      ...f,
      outcomeCode: o.outcomeCode,
      outcomeTitle: o.outcomeTitle,
      topicTitle: o.unitTitle,
      title: f.title || `${o.unitTitle} — ${o.outcomeTitle}`.slice(0, 160),
    }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!videoPreview.ok) {
      setError(videoPreview.message ?? "Geçerli bir video bağlantısı girin.");
      return;
    }
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      await apiFetch("/v1/lesson-videos", {
        method: "POST",
        body: JSON.stringify({
          gradeLevel: Number(form.gradeLevel),
          branchId: Number(form.branchId),
          topicTitle: form.topicTitle.trim(),
          outcomeCode: form.outcomeCode.trim(),
          outcomeTitle: form.outcomeTitle.trim(),
          title: form.title.trim(),
          description: form.description.trim() || null,
          videoUrl: form.videoUrl.trim(),
          videoKind: form.videoKind,
          durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : null,
        }),
      });
      setOk("Video gönderildi. Admin onayından sonra öğrenciler görebilir (genelde kısa sürer).");
      setForm((f) => ({
        ...emptyForm,
        branchId: f.branchId,
        gradeLevel: f.gradeLevel,
        videoKind: f.videoKind,
      }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Video eklenemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveVideo(id: string) {
    if (!confirm("Bu videoyu kaldırmak istediğinize emin misiniz?")) return;
    try {
      await apiFetch(`/v1/lesson-videos/${id}`, { method: "DELETE" });
      setOk("Video kaldırıldı.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Silinemedi.");
    }
  }

  if (!loading && branches.length === 0) {
    return (
      <div className="min-h-screen bg-paper-50 pb-24">
        <TeacherPanelHeader />
        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <h1 className="text-lg font-semibold text-amber-950">Önce branş seçin</h1>
            <p className="mt-2 text-sm text-amber-900/80">
              Video ekleyebilmek için profilinizde en az bir branş tanımlı olmalı.
            </p>
            <Link href="/teacher/edit" className="mt-4 inline-flex text-sm font-semibold text-brand-800">
              Profile git →
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper-50 pb-24">
      <TeacherPanelHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-800/70">İçerik</p>
            <h1 className="mt-1 text-2xl font-semibold text-paper-950" data-testid="teacher-lesson-videos-title">
            Ders videoları
          </h1>
            <p className="mt-2 text-sm text-paper-800/70">
              Sınıf, branş, konu ve kazanım etiketleriyle ders veya sınav hazırlık videosu paylaşın.
            </p>
          </div>
          {videos.length > 0 && (
            <div className="text-xs font-semibold text-paper-800/70">
              {videos.length} video · {totalViews} toplam izlenme
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => void onSubmit(e)}
          className="space-y-4 rounded-2xl border border-paper-200 bg-white p-5"
          data-testid="teacher-lesson-video-form"
        >
          <h2 className="text-sm font-semibold text-paper-950">Yeni video ekle</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Sınıf</span>
              <select
                value={form.gradeLevel}
                onChange={(e) => setForm((f) => ({ ...f, gradeLevel: e.target.value }))}
                className="w-full rounded-xl border border-paper-200 px-3 py-2"
                required
              >
                {GRADE_LEVEL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Branş (profilinizden)</span>
              <select
                value={form.branchId}
                onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}
                className="w-full rounded-xl border border-paper-200 px-3 py-2"
                required
              >
                <option value="">Seçin</option>
                {branches.map((b) => (
                  <option key={b.branchId} value={b.branchId}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Video türü</span>
              <select
                value={form.videoKind}
                onChange={(e) => setForm((f) => ({ ...f, videoKind: e.target.value as VideoKind }))}
                className="w-full rounded-xl border border-paper-200 px-3 py-2"
              >
                <option value="lesson">Ders videosu</option>
                <option value="exam_prep">Sınav hazırlık</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Süre (dk, isteğe bağlı)</span>
              <input
                type="number"
                min={1}
                max={600}
                value={form.durationMinutes}
                onChange={(e) => setForm((f) => ({ ...f, durationMinutes: e.target.value }))}
                className="w-full rounded-xl border border-paper-200 px-3 py-2"
              />
            </label>
          </div>

          {curriculumOutcomes.length > 0 && (
            <div className="rounded-xl border border-paper-200 bg-paper-50 p-3" data-testid="curriculum-outcomes-picker">
              <div className="text-xs font-semibold text-paper-800">Müfredat kazanımları</div>
              <label className="mt-2 block text-sm">
                <span className="mb-1 block font-medium">Kazanım ara</span>
                <input
                  value={outcomeSearch}
                  onChange={(e) => setOutcomeSearch(e.target.value)}
                  placeholder="Ünite veya kazanım adı"
                  className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm"
                />
              </label>
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {curriculumOutcomes.map((o) => (
                  <button
                    key={`${o.outcomeCode}-${o.unitTitle}`}
                    type="button"
                    onClick={() => applyCurriculumOutcome(o)}
                    className="w-full rounded-lg border border-paper-200 bg-white px-3 py-2 text-left text-xs hover:border-brand-200"
                  >
                    <span className="font-mono text-brand-800">{o.outcomeCode}</span> — {o.outcomeTitle}
                    <div className="text-paper-800/55">{o.unitTitle}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-3">
              <div className="text-xs font-semibold text-brand-900">Profilinizdeki kazanım önerileri</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {suggestions.slice(0, 8).map((s) => (
                  <button
                    key={`${s.branchSlug}-${s.outcomeTitle}`}
                    type="button"
                    onClick={() => applySuggestion(s)}
                    className="rounded-full bg-white px-3 py-1 text-xs font-medium text-brand-900 ring-1 ring-brand-200 hover:bg-brand-50"
                  >
                    {s.outcomeTitle}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Video başlığı</span>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full rounded-xl border border-paper-200 px-3 py-2"
              required
              minLength={3}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Konu</span>
            <input
              value={form.topicTitle}
              onChange={(e) => setForm((f) => ({ ...f, topicTitle: e.target.value }))}
              placeholder="Örn. Üslü sayılar"
              className="w-full rounded-xl border border-paper-200 px-3 py-2"
              required
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Kazanım kodu</span>
              <input
                value={form.outcomeCode}
                onChange={(e) => setForm((f) => ({ ...f, outcomeCode: e.target.value }))}
                placeholder="M.8.1.2"
                className="w-full rounded-xl border border-paper-200 px-3 py-2"
                required
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Kazanım açıklaması</span>
              <input
                value={form.outcomeTitle}
                onChange={(e) => setForm((f) => ({ ...f, outcomeTitle: e.target.value }))}
                className="w-full rounded-xl border border-paper-200 px-3 py-2"
                required
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Video bağlantısı (YouTube / Vimeo)</span>
            <input
              type="url"
              value={form.videoUrl}
              onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full rounded-xl border border-paper-200 px-3 py-2"
              required
            />
            {videoPreview.message && (
              <p className="mt-1 text-xs text-red-700">{videoPreview.message}</p>
            )}
            {videoPreview.embed && (
              <div className="mt-3 aspect-video max-w-sm overflow-hidden rounded-xl bg-paper-900">
                <iframe src={videoPreview.embed} title="Önizleme" className="h-full w-full" allowFullScreen />
              </div>
            )}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Açıklama (isteğe bağlı)</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full rounded-xl border border-paper-200 px-3 py-2"
            />
          </label>
          {selectedBranch && (
            <p className="text-xs text-paper-800/55">
              Bu video <strong>{gradeLevelLabel(Number(form.gradeLevel))}</strong> öğrencilerine,{" "}
              <strong>{selectedBranch.name}</strong> branşında listelenecek.
            </p>
          )}
          {error && <p className="text-sm text-red-700">{error}</p>}
          {ok && <p className="text-sm text-green-800">{ok}</p>}
          <button
            type="submit"
            disabled={saving || !videoPreview.ok}
            className="rounded-xl bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Kaydediliyor…" : "Yayınla"}
          </button>
        </form>

        <section className="mt-8">
          <h2 className="text-sm font-semibold text-paper-950">Yayınladığınız videolar</h2>
          {loading ? (
            <p className="mt-3 text-sm text-paper-800/60">Yükleniyor…</p>
          ) : videos.length === 0 ? (
            <p className="mt-3 text-sm text-paper-800/60">Henüz video yok. İlk videonuzu yukarıdan ekleyin.</p>
          ) : (
            <ul className="mt-3 space-y-2" data-testid="teacher-lesson-videos-list">
              {videos.map((v) => (
                <li
                  key={v.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-paper-200 bg-white p-4"
                >
                  <div>
                    <div className="text-sm font-semibold text-paper-950">{v.title}</div>
                    <div className="mt-1 text-xs text-paper-800/65">
                      {gradeLevelLabel(v.gradeLevel)} · {v.branchName} · {v.topicTitle}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-paper-800/50">
                      <span
                        className={`rounded-full px-2 py-0.5 font-semibold ${moderationClass(v.moderationStatus ?? v.status)}`}
                      >
                        {moderationLabel(v.moderationStatus ?? "pending_review")}
                      </span>
                      <span>
                        {videoKindLabel(v.videoKind)} · {v.outcomeCode} · {v.viewCount} izlenme (
                        {v.uniqueViewerCount} öğrenci)
                      </span>
                    </div>
                    {v.moderationNote && (
                      <p className="mt-1 text-xs text-red-700">Not: {v.moderationNote}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={v.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-paper-200 px-3 py-1.5 text-xs font-semibold"
                    >
                      Aç
                    </a>
                    <button
                      type="button"
                      onClick={() => void archiveVideo(v.id)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-800"
                    >
                      Kaldır
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
