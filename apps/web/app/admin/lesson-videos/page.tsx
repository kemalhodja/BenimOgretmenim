"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { embedVideoUrl, gradeLevelLabel } from "../../lib/gradeLevels";
import { useRequireAdmin } from "../useRequireAdmin";

type VideoRow = {
  id: string;
  title: string;
  grade_level: number;
  topic_title: string;
  outcome_code: string;
  video_url: string;
  video_kind: string;
  moderation_status: string;
  moderation_note: string | null;
  created_at: string;
  teacher_display_name: string;
  branch_name: string;
};

function moderationLabel(status: string): string {
  if (status === "pending_review") return "İnceleme bekliyor";
  if (status === "approved") return "Onaylandı";
  if (status === "rejected") return "Reddedildi";
  if (status === "flagged") return "İşaretlendi";
  return status;
}

export default function AdminLessonVideosPage() {
  const token = useRequireAdmin();
  const [status, setStatus] = useState("pending_review");
  const [rows, setRows] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch<{ videos: VideoRow[] }>(
        `/v1/admin/lesson-videos?status=${encodeURIComponent(status)}`,
        { token },
      );
      setRows(r.videos);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Liste yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [token, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function moderate(videoId: string, moderationStatus: "approved" | "rejected" | "flagged") {
    if (!token) return;
    const note = rejectNote[videoId]?.trim() || null;
    if (moderationStatus === "rejected" && !note) {
      setError("Red için kısa bir gerekçe yazın.");
      return;
    }
    setBusyId(videoId);
    setError(null);
    try {
      await apiFetch(`/v1/admin/lesson-videos/${videoId}/moderation`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ moderationStatus, moderationNote: note }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "İşlem başarısız.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-paper-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link href="/admin/merkez" className="text-sm font-semibold text-brand-800">
              ← Kontrol merkezi
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-paper-950">Ders video moderasyonu</h1>
            <p className="mt-1 text-sm text-paper-800/70">
              Onaylanmayan videolar öğrencilere gösterilmez.
            </p>
          </div>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Durum</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-xl border border-paper-200 px-3 py-2"
              data-testid="admin-lesson-videos-status"
            >
              <option value="pending_review">İnceleme bekleyen</option>
              <option value="approved">Onaylı</option>
              <option value="rejected">Reddedilen</option>
              <option value="flagged">İşaretli</option>
              <option value="all">Tümü</option>
            </select>
          </label>
        </div>

        {error && (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
        )}

        {loading ? (
          <p className="text-sm text-paper-800/60">Yükleniyor…</p>
        ) : rows.length === 0 ? (
          <p className="rounded-2xl border border-paper-200 bg-white p-6 text-sm text-paper-800/70">
            Bu filtrede video yok.
          </p>
        ) : (
          <ul className="space-y-4" data-testid="admin-lesson-videos-list">
            {rows.map((v) => {
              const embed = embedVideoUrl(v.video_url);
              return (
                <li key={v.id} className="rounded-2xl border border-paper-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-paper-950">{v.title}</div>
                      <div className="mt-1 text-xs text-paper-800/65">
                        {v.teacher_display_name} · {gradeLevelLabel(v.grade_level)} · {v.branch_name}
                      </div>
                      <div className="mt-1 text-xs text-paper-800/50">
                        {v.topic_title} · {v.outcome_code} · {moderationLabel(v.moderation_status)}
                      </div>
                    </div>
                    <a
                      href={v.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-brand-800"
                    >
                      Kaynağı aç
                    </a>
                  </div>
                  {embed && (
                    <div className="mt-3 aspect-video max-w-md overflow-hidden rounded-xl bg-paper-900">
                      <iframe src={embed} title={v.title} className="h-full w-full" allowFullScreen />
                    </div>
                  )}
                  {v.moderation_status === "pending_review" && (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                      <label className="block flex-1 text-sm">
                        <span className="mb-1 block font-medium">Red gerekçesi (red için zorunlu)</span>
                        <input
                          value={rejectNote[v.id] ?? ""}
                          onChange={(e) =>
                            setRejectNote((prev) => ({ ...prev, [v.id]: e.target.value }))
                          }
                          className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm"
                          placeholder="Örn. telif / konu dışı"
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busyId === v.id}
                          onClick={() => void moderate(v.id, "approved")}
                          className="rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          Onayla
                        </button>
                        <button
                          type="button"
                          disabled={busyId === v.id}
                          onClick={() => void moderate(v.id, "flagged")}
                          className="rounded-xl border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-900"
                        >
                          İşaretle
                        </button>
                        <button
                          type="button"
                          disabled={busyId === v.id}
                          onClick={() => void moderate(v.id, "rejected")}
                          className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-800"
                        >
                          Reddet
                        </button>
                      </div>
                    </div>
                  )}
                  {v.moderation_note && (
                    <p className="mt-2 text-xs text-paper-800/60">Son not: {v.moderation_note}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
