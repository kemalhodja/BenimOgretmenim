"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { StudentPanelHeader } from "../../components/StudentPanelHeader";
import { apiFetch } from "../../lib/api";
import { getToken } from "../../lib/auth";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { embedVideoUrl, gradeLevelLabel, GRADE_LEVEL_OPTIONS } from "../../lib/gradeLevels";
import { videoKindLabel, type VideoKind } from "../../lib/lessonVideos";

type Branch = { id: number; name: string; slug: string };

type LessonVideo = {
  id: string;
  teacherId: string;
  teacherDisplayName: string;
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
  viewCount: number;
};

type Facets = {
  total: number;
  lesson: number;
  examPrep: number;
  branches: Array<{
    branchId: number;
    branchName: string;
    total: number;
    lesson: number;
    examPrep: number;
  }>;
};

type VideosResponse = {
  videos: LessonVideo[];
  facets: Facets | null;
  filters: { gradeLevel: number | null; branchId: number | null; videoKind: string | null; topic: string | null };
  studentGradeLevel: number | null;
  error?: string;
  message?: string;
};

const KIND_CHIPS: Array<{ value: "" | VideoKind; label: string }> = [
  { value: "", label: "Tümü" },
  { value: "lesson", label: "Ders" },
  { value: "exam_prep", label: "Sınav hazırlık" },
];

export default function StudentDersVideolariPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [studentGrade, setStudentGrade] = useState<number | null>(null);
  const [gradeDraft, setGradeDraft] = useState("8");
  const [savingGrade, setSavingGrade] = useState(false);
  const [facets, setFacets] = useState<Facets | null>(null);

  const [branchId, setBranchId] = useState("");
  const [videoKind, setVideoKind] = useState<"" | VideoKind>("");
  const [topic, setTopic] = useState("");
  const [topicDraft, setTopicDraft] = useState("");

  const [videos, setVideos] = useState<LessonVideo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gradeRequired, setGradeRequired] = useState(false);
  const trackedViewRef = useRef<string | null>(null);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [pathname, router]);

  useEffect(() => {
    const initialTopic = searchParams.get("topic")?.trim();
    if (initialTopic) {
      setTopicDraft(initialTopic);
      setTopic(initialTopic);
    }
  }, [searchParams]);

  const loadProfile = useCallback(async () => {
    const p = await apiFetch<{ student: { gradeLevel: number | null } }>("/v1/student-platform/profile");
    setStudentGrade(p.student.gradeLevel);
    if (p.student.gradeLevel) setGradeDraft(String(p.student.gradeLevel));
  }, []);

  const loadVideos = useCallback(async () => {
    setLoading(true);
    setError(null);
    setGradeRequired(false);
    try {
      const q = new URLSearchParams();
      if (branchId) q.set("branchId", branchId);
      if (videoKind) q.set("videoKind", videoKind);
      if (topic.trim()) q.set("topic", topic.trim());
      const suffix = q.toString() ? `?${q.toString()}` : "";
      const data = await apiFetch<VideosResponse>(`/v1/lesson-videos${suffix}`);
      if (data.error === "grade_level_required") {
        setGradeRequired(true);
        setVideos([]);
        setFacets(null);
        return;
      }
      setVideos(data.videos);
      setFacets(data.facets);
      setStudentGrade(data.studentGradeLevel);
      setSelectedId((prev) => {
        if (prev && data.videos.some((v) => v.id === prev)) return prev;
        return data.videos[0]?.id ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Videolar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [branchId, videoKind, topic]);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const [branchRes] = await Promise.all([
          apiFetch<{ branches: Branch[] }>("/v1/meta/branches"),
          loadProfile(),
        ]);
        setBranches(branchRes.branches.filter((b) => b.id > 0));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Veriler yüklenemedi.");
      }
    })();
  }, [token, loadProfile]);

  useEffect(() => {
    if (!token || gradeRequired) return;
    void loadVideos();
  }, [token, loadVideos, gradeRequired]);

  const selected = useMemo(
    () => videos.find((v) => v.id === selectedId) ?? videos[0] ?? null,
    [videos, selectedId],
  );

  const embedSrc = selected ? embedVideoUrl(selected.videoUrl) : null;

  useEffect(() => {
    if (!selected?.id || trackedViewRef.current === selected.id) return;
    trackedViewRef.current = selected.id;
    void apiFetch(`/v1/lesson-videos/${selected.id}/view`, { method: "POST" }).catch(() => {
      trackedViewRef.current = null;
    });
  }, [selected?.id]);

  async function saveGrade() {
    setSavingGrade(true);
    setError(null);
    try {
      const r = await apiFetch<{ student: { gradeLevel: number } }>("/v1/student-platform/profile", {
        method: "PATCH",
        body: JSON.stringify({ gradeLevel: Number(gradeDraft) }),
      });
      setStudentGrade(r.student.gradeLevel);
      setGradeRequired(false);
      await loadVideos();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sınıf kaydedilemedi.");
    } finally {
      setSavingGrade(false);
    }
  }

  function selectKind(next: "" | VideoKind) {
    setVideoKind(next);
  }

  return (
    <div className="min-h-screen bg-paper-50 pb-24">
      <StudentPanelHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-800/70">Öğrenme</p>
          <h1 className="mt-1 text-2xl font-semibold text-paper-950" data-testid="lesson-videos-title">
            Ders videoları
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-paper-800/70">
              Öğretmenlerin paylaştığı ders ve sınav hazırlık videoları. Yalnızca kendi sınıfınıza uygun içerikler
              listelenir.
            </p>
            {studentGrade != null && (
              <p className="mt-2 text-sm font-medium text-brand-900">
                Sınıfınız: {gradeLevelLabel(studentGrade)}
              </p>
            )}
          </div>
          {facets && facets.total > 0 && (
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white px-3 py-1.5 font-semibold text-paper-800 ring-1 ring-paper-200">
                {facets.total} video
              </span>
              <span className="rounded-full bg-brand-50 px-3 py-1.5 font-semibold text-brand-900">
                {facets.lesson} ders
              </span>
              <span className="rounded-full bg-amber-50 px-3 py-1.5 font-semibold text-amber-900">
                {facets.examPrep} sınav hazırlık
              </span>
            </div>
          )}
        </div>

        {gradeRequired && (
          <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4" data-testid="lesson-videos-grade-required">
            <h2 className="text-sm font-semibold text-amber-950">Sınıfınızı seçin</h2>
            <p className="mt-1 text-sm text-amber-900/80">
              Size uygun videoları gösterebilmemiz için sınıf seviyenizi belirtin.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-paper-800">Sınıf</span>
                <select
                  value={gradeDraft}
                  onChange={(e) => setGradeDraft(e.target.value)}
                  className="rounded-xl border border-paper-200 px-3 py-2 text-sm"
                >
                  {GRADE_LEVEL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => void saveGrade()}
                disabled={savingGrade}
                className="rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {savingGrade ? "Kaydediliyor…" : "Kaydet ve videoları göster"}
              </button>
            </div>
          </section>
        )}

        {!gradeRequired && (
          <>
            <div className="mb-3 flex flex-wrap gap-2" data-testid="lesson-videos-kind-chips">
              {KIND_CHIPS.map((chip) => {
                const active = videoKind === chip.value;
                const count =
                  chip.value === ""
                    ? facets?.total
                    : chip.value === "lesson"
                      ? facets?.lesson
                      : facets?.examPrep;
                return (
                  <button
                    key={chip.value || "all"}
                    type="button"
                    onClick={() => selectKind(chip.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? "bg-brand-800 text-white"
                        : "bg-white text-paper-800 ring-1 ring-paper-200 hover:ring-brand-200"
                    }`}
                  >
                    {chip.label}
                    {count != null ? ` (${count})` : ""}
                  </button>
                );
              })}
            </div>

            <section className="mb-6 grid gap-3 rounded-2xl border border-paper-200 bg-white p-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-paper-800">Branş</span>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm"
                >
                  <option value="">Tüm branşlar</option>
                  {(facets?.branches.length ? facets.branches : branches.map((b) => ({ branchId: b.id, branchName: b.name, total: 0 }))).map(
                    (b) => (
                      <option key={b.branchId} value={b.branchId}>
                        {b.branchName}
                        {"total" in b && b.total > 0 ? ` (${b.total})` : ""}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-paper-800">Konu / kazanım ara</span>
                <div className="flex gap-2">
                  <input
                    value={topicDraft}
                    onChange={(e) => setTopicDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setTopic(topicDraft);
                    }}
                    placeholder="Örn. üslü sayılar, paragraf"
                    className="min-w-0 flex-1 rounded-xl border border-paper-200 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setTopic(topicDraft)}
                    className="shrink-0 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-900"
                  >
                    Ara
                  </button>
                </div>
              </label>
            </section>
          </>
        )}

        {error && (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
        )}

        {loading ? (
          <p className="text-sm text-paper-800/60">Videolar yükleniyor…</p>
        ) : !gradeRequired && videos.length === 0 ? (
          <div className="rounded-2xl border border-paper-200 bg-white p-8 text-center">
            <p className="text-sm text-paper-800/70">
              Bu filtrelerle eşleşen video bulunamadı. Branş veya arama terimini değiştirmeyi deneyin.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Link href="/ogretmenler" className="text-sm font-semibold text-brand-800">
                Öğretmen bul →
              </Link>
              <Link href="/student/calisma" className="text-sm font-semibold text-brand-800">
                Çalışma planına git →
              </Link>
            </div>
          </div>
        ) : (
          !gradeRequired && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <div className="space-y-2 lg:max-h-[70vh] lg:overflow-y-auto" data-testid="lesson-videos-list">
                {videos.map((v) => {
                  const active = v.id === (selected?.id ?? "");
                  return (
                    <button
                      key={v.id}
                      type="button"
                      data-testid={`lesson-video-card-${v.id}`}
                      onClick={() => setSelectedId(v.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        active
                          ? "border-brand-300 bg-brand-50 shadow-sm"
                          : "border-paper-200 bg-white hover:border-brand-200"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-full bg-paper-100 px-2 py-0.5 font-semibold text-paper-800">
                          {v.branchName}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 font-semibold ${
                            v.videoKind === "exam_prep"
                              ? "bg-amber-100 text-amber-900"
                              : "bg-brand-100 text-brand-900"
                          }`}
                        >
                          {videoKindLabel(v.videoKind)}
                        </span>
                        {v.durationMinutes != null && (
                          <span className="text-paper-800/50">{v.durationMinutes} dk</span>
                        )}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-paper-950">{v.title}</div>
                      <div className="mt-0.5 text-xs text-paper-800/65">
                        {v.topicTitle} · {v.outcomeCode}
                      </div>
                      <div className="mt-1 text-xs text-paper-800/50">{v.teacherDisplayName}</div>
                    </button>
                  );
                })}
              </div>

              {selected && (
                <article
                  className="rounded-2xl border border-paper-200 bg-white p-4 lg:sticky lg:top-4 lg:self-start"
                  data-testid="lesson-video-player"
                >
                  <h2 className="text-lg font-semibold text-paper-950">{selected.title}</h2>
                  <p className="mt-1 text-sm text-paper-800/70">
                    {selected.branchName} · {gradeLevelLabel(selected.gradeLevel)} ·{" "}
                    <Link href={`/ogretmenler/${selected.teacherId}`} className="font-semibold text-brand-800">
                      {selected.teacherDisplayName}
                    </Link>
                  </p>
                  <dl className="mt-3 grid gap-2 text-sm">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-paper-800/50">Konu</dt>
                      <dd>{selected.topicTitle}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-paper-800/50">Kazanım</dt>
                      <dd>
                        <span className="font-mono text-xs text-brand-800">{selected.outcomeCode}</span> —{" "}
                        {selected.outcomeTitle}
                      </dd>
                    </div>
                  </dl>
                  {selected.description && (
                    <p className="mt-3 text-sm leading-relaxed text-paper-800/75">{selected.description}</p>
                  )}
                  {embedSrc ? (
                    <div className="mt-4 aspect-video overflow-hidden rounded-xl bg-paper-900">
                      <iframe
                        src={embedSrc}
                        title={selected.title}
                        className="h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <a
                      href={selected.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white"
                    >
                      Videoyu aç
                    </a>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/ogretmenler/${selected.teacherId}`}
                      className="rounded-xl border border-paper-200 px-3 py-2 text-xs font-semibold text-paper-800"
                    >
                      Öğretmen profili
                    </Link>
                    <Link
                      href="/student/odev-sor"
                      className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-900"
                    >
                      Bu konudan soru sor
                    </Link>
                  </div>
                </article>
              )}
            </div>
          )
        )}
      </main>
    </div>
  );
}
