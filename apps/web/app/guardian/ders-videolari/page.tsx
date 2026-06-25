"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { GuardianPanelHeader } from "../../components/GuardianPanelHeader";
import { apiFetch } from "../../lib/api";
import { getToken } from "../../lib/auth";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { gradeLevelLabel } from "../../lib/gradeLevels";
import { videoKindLabel, type VideoKind } from "../../lib/lessonVideos";

type LinkedStudent = {
  student_id: string;
  student_display_name: string;
  grade_level: number | null;
};

type LessonVideo = {
  id: string;
  title: string;
  branchName: string;
  topicTitle: string;
  outcomeCode: string;
  videoKind: VideoKind;
  teacherDisplayName: string;
  teacherId: string;
};

export default function GuardianDersVideolariPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [students, setStudents] = useState<LinkedStudent[]>([]);
  const [studentId, setStudentId] = useState("");
  const [videos, setVideos] = useState<LessonVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selected = students.find((s) => s.student_id === studentId) ?? null;

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [pathname, router]);

  const loadStudents = useCallback(async () => {
    const ov = await apiFetch<{ students: LinkedStudent[] }>("/v1/guardians/overview");
    setStudents(ov.students ?? []);
    setStudentId((prev) => prev || ov.students?.[0]?.student_id || "");
  }, []);

  const loadVideos = useCallback(async (sid: string) => {
    if (!sid) {
      setVideos([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch<{ videos: LessonVideo[]; error?: string; message?: string }>(
        `/v1/lesson-videos/for-guardian?studentId=${encodeURIComponent(sid)}`,
      );
      if (r.error === "grade_level_required") {
        setVideos([]);
        setError(r.message ?? "Öğrencinin sınıfı tanımlı değil.");
        return;
      }
      setVideos(r.videos);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Videolar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        await loadStudents();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Öğrenci listesi alınamadı.");
      }
    })();
  }, [token, loadStudents]);

  useEffect(() => {
    if (!token || !studentId) return;
    void loadVideos(studentId);
  }, [token, studentId, loadVideos]);

  return (
    <div className="min-h-screen bg-paper-50 pb-24">
      <GuardianPanelHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold text-paper-950" data-testid="guardian-lesson-videos-title">
          Öğrenci ders videoları
        </h1>
        <p className="mt-2 text-sm text-paper-800/70">
          Bağlı öğrencinizin sınıfına uygun onaylı videoları görüntüleyin. İzleme öğrenci hesabından yapılır.
        </p>

        {students.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-paper-200 bg-white p-6 text-sm text-paper-800/70">
            Henüz bağlı öğrenci yok.{" "}
            <Link href="/guardian" className="font-semibold text-brand-800">
              Veli panelinden davet oluşturun
            </Link>
            .
          </p>
        ) : (
          <>
            <label className="mt-6 block max-w-sm text-sm">
              <span className="mb-1 block font-medium">Öğrenci</span>
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full rounded-xl border border-paper-200 px-3 py-2"
                data-testid="guardian-student-select"
              >
                {students.map((s) => (
                  <option key={s.student_id} value={s.student_id}>
                    {s.student_display_name}
                    {s.grade_level != null ? ` · ${gradeLevelLabel(s.grade_level)}` : ""}
                  </option>
                ))}
              </select>
            </label>

            {selected?.grade_level != null && (
              <p className="mt-2 text-sm text-brand-900">
                Listelenen videolar: {gradeLevelLabel(selected.grade_level)}
              </p>
            )}

            {error && (
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {error}
              </p>
            )}

            {loading ? (
              <p className="mt-6 text-sm text-paper-800/60">Yükleniyor…</p>
            ) : videos.length === 0 && !error ? (
              <p className="mt-6 text-sm text-paper-800/60">Bu öğrenci için uygun video bulunamadı.</p>
            ) : (
              <ul className="mt-6 space-y-3" data-testid="guardian-lesson-videos-list">
                {videos.map((v) => (
                  <li key={v.id} className="rounded-2xl border border-paper-200 bg-white p-4">
                    <div className="text-sm font-semibold text-paper-950">{v.title}</div>
                    <div className="mt-1 text-xs text-paper-800/65">
                      {v.branchName} · {videoKindLabel(v.videoKind)} · {v.topicTitle} · {v.outcomeCode}
                    </div>
                    <div className="mt-1 text-xs text-paper-800/50">{v.teacherDisplayName}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={`/ogretmenler/${v.teacherId}`}
                        className="rounded-lg border border-paper-200 px-3 py-1.5 text-xs font-semibold"
                      >
                        Öğretmen profili
                      </Link>
                      <span className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-900">
                        İzlemek için öğrenci hesabıyla giriş yapın
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}
