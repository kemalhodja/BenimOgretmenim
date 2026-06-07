"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useRequireAdmin } from "../useRequireAdmin";

type Row = {
  id: string;
  status: string;
  topic: string;
  created_at: string;
  student_name: string;
  student_email: string;
};

type QualityRow = {
  id: string;
  topic: string;
  status: string;
  help_text: string;
  answer_text: string | null;
  answer_video_url: string | null;
  grade_level_text: string | null;
  target_exam: string | null;
  learning_objective: string | null;
  urgency_level: "normal" | "priority" | "urgent";
  target_answer_minutes: number | null;
  resolution_sla_due_at: string | null;
  quality_status: string;
  quality_score: number | null;
  moderator_note: string | null;
  revision_requested_at: string | null;
  accepted_quality_at: string | null;
  created_at: string;
  student_display_name: string;
  teacher_display_name: string | null;
};

function urgencyLabel(level?: string | null): string {
  if (level === "urgent") return "Acil";
  if (level === "priority") return "Öncelikli";
  return "Normal";
}

function urgencyClass(level?: string | null): string {
  if (level === "urgent") return "bg-red-50 text-red-800";
  if (level === "priority") return "bg-amber-50 text-amber-900";
  return "bg-paper-100 text-paper-800";
}

function homeworkStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    open: "Havuzda bekliyor",
    claimed: "Öğretmen üstlendi",
    answered: "Cevaplandı",
    closed: "Kapatıldı",
    cancelled: "İptal edildi",
  };
  return labels[status] ?? status;
}

function qualityStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    not_reviewed: "İnceleme bekliyor",
    accepted: "Kabul edildi",
    revision_requested: "Revizyon istendi",
    flagged: "İşaretlendi",
  };
  return labels[status] ?? status;
}

export default function AdminHomeworkPage() {
  const token = useRequireAdmin();
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 40;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [qualityRows, setQualityRows] = useState<QualityRow[]>([]);
  const [qualityTotal, setQualityTotal] = useState(0);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [reviewBusy, setReviewBusy] = useState<string | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, { score: string; note: string }>>({});

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      if (status) sp.set("status", status);
      sp.set("limit", String(limit));
      sp.set("offset", String(offset));
      const r = await apiFetch<{ posts: Row[]; total: number }>(`/api/admin/homework-posts?${sp.toString()}`, {
        token,
      });
      setRows(r.posts);
      setTotal(r.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [token, status, offset]);

  const loadQuality = useCallback(async () => {
    if (!token) return;
    setQualityLoading(true);
    setError(null);
    try {
      const r = await apiFetch<{ posts: QualityRow[]; total: number }>(
        "/api/admin/homework-quality?limit=20&offset=0",
        { token },
      );
      setQualityRows(r.posts);
      setQualityTotal(r.total);
      setReviewDrafts((prev) => {
        const next = { ...prev };
        for (const row of r.posts) {
          next[row.id] = next[row.id] ?? {
            score: row.quality_score ? String(row.quality_score) : "5",
            note: row.moderator_note ?? "",
          };
        }
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "kalite kuyruğu yüklenemedi");
    } finally {
      setQualityLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadQuality();
  }, [loadQuality]);

  async function cancel(id: string) {
    if (!token) return;
    if (!window.confirm("Bu gönderiyi iptal edildi olarak işaretlemek istiyor musunuz?")) return;
    setBusy(id);
    setError(null);
    try {
      await apiFetch(`/api/admin/homework-posts/${id}/status`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status: "cancelled" }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "hata");
    } finally {
      setBusy(null);
    }
  }

  async function reviewQuality(id: string, qualityStatus: "accepted" | "revision_requested" | "flagged") {
    if (!token) return;
    const draft = reviewDrafts[id] ?? { score: "5", note: "" };
    const scoreNum = Number(draft.score);
    if (!Number.isInteger(scoreNum) || scoreNum < 1 || scoreNum > 5) {
      setError("Kalite puanı 1-5 arası olmalı.");
      return;
    }
    setReviewBusy(id);
    setError(null);
    try {
      await apiFetch(`/api/admin/homework-quality/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          qualityStatus,
          qualityScore: scoreNum,
          note: draft.note.trim() || null,
        }),
      });
      await loadQuality();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "kalite kararı kaydedilemedi");
    } finally {
      setReviewBusy(null);
    }
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mt-1 flex justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Ödev / soru gönderileri</h1>
          <Link
            href="/admin/merkez"
            className="text-sm font-medium text-brand-800 underline decoration-brand-400 underline-offset-4"
          >
            Merkez
          </Link>
        </div>
        <label className="mt-4 block max-w-sm text-sm">
          <span className="font-medium text-paper-800">Durum</span>
          <select
            className="mt-1 w-full rounded-xl border border-paper-200 bg-white px-3 py-2 text-sm"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">Tümü</option>
            <option value="open">Havuzda bekliyor</option>
            <option value="claimed">Öğretmen üstlendi</option>
            <option value="answered">Cevaplandı</option>
            <option value="closed">Kapatıldı</option>
            <option value="cancelled">İptal edildi</option>
          </select>
        </label>
        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        ) : null}
        <section className="mt-6 rounded-2xl border border-paper-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-paper-900">Kalite kontrol kuyruğu</h2>
              <p className="mt-1 text-sm text-paper-800/65">
                Öğretmen çözümlerini kabul edin, revizyon isteyin veya riskli cevapları işaretleyin. Karar sonrası
                öğrenci ve öğretmene bildirim gider.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadQuality()}
              className="rounded-xl border border-paper-200 bg-white px-3 py-2 text-xs font-medium text-paper-900"
            >
              Yenile
            </button>
          </div>
          <p className="mt-3 text-xs text-paper-800/55">Bekleyen kayıt: {qualityTotal}</p>
          {qualityLoading ? (
            <p className="mt-4 text-sm text-paper-800/55">Kalite kuyruğu yükleniyor…</p>
          ) : qualityRows.length === 0 ? (
            <p className="mt-4 text-sm text-paper-800/55">İncelenecek çözüm yok.</p>
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {qualityRows.map((q) => {
                const draft = reviewDrafts[q.id] ?? { score: q.quality_score ? String(q.quality_score) : "5", note: "" };
                return (
                  <article key={q.id} className="rounded-xl border border-paper-200 bg-paper-50/60 p-4 text-sm">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className={`rounded-full px-2 py-0.5 font-medium ${urgencyClass(q.urgency_level)}`}>
                        {urgencyLabel(q.urgency_level)}
                      </span>
                      <span className="rounded-full bg-paper-100 px-2 py-0.5 font-medium text-paper-800">
                        {qualityStatusLabel(q.quality_status)}
                      </span>
                      {q.target_answer_minutes ? (
                        <span className="rounded-full bg-paper-100 px-2 py-0.5 font-medium text-paper-800">
                          Hedef {q.target_answer_minutes} dk
                        </span>
                      ) : null}
                      {q.grade_level_text ? (
                        <span className="rounded-full bg-paper-100 px-2 py-0.5 font-medium text-paper-800">
                          {q.grade_level_text}
                        </span>
                      ) : null}
                      {q.target_exam ? (
                        <span className="rounded-full bg-paper-100 px-2 py-0.5 font-medium text-paper-800">
                          {q.target_exam}
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-3 font-semibold text-paper-900">{q.topic}</h3>
                    <p className="mt-1 text-xs text-paper-800/55">
                      Öğrenci: {q.student_display_name} · Öğretmen: {q.teacher_display_name ?? "—"} ·{" "}
                      {new Date(q.created_at).toLocaleString("tr-TR")}
                    </p>
                    {q.learning_objective ? (
                      <p className="mt-2 text-xs font-medium text-brand-900">Kazanım: {q.learning_objective}</p>
                    ) : null}
                    <div className="mt-3 grid gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-paper-800/60">Soru</div>
                        <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-paper-800">{q.help_text}</p>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-paper-800/60">Çözüm</div>
                        <p className="mt-1 line-clamp-5 whitespace-pre-wrap text-paper-900">
                          {q.answer_text ?? "Henüz cevap metni yok."}
                        </p>
                        {q.answer_video_url ? (
                          <a
                            href={q.answer_video_url}
                            className="mt-1 inline-block text-xs font-medium text-blue-700 underline"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Çözüm videosu
                          </a>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-[6rem_1fr]">
                      <label className="block text-xs font-medium text-paper-800">
                        Puan
                        <select
                          className="mt-1 w-full rounded-lg border border-paper-200 bg-white px-2 py-2 text-sm"
                          value={draft.score}
                          onChange={(e) =>
                            setReviewDrafts((prev) => ({
                              ...prev,
                              [q.id]: { ...draft, score: e.target.value },
                            }))
                          }
                        >
                          <option value="5">5</option>
                          <option value="4">4</option>
                          <option value="3">3</option>
                          <option value="2">2</option>
                          <option value="1">1</option>
                        </select>
                      </label>
                      <label className="block text-xs font-medium text-paper-800">
                        Moderasyon notu
                        <input
                          className="mt-1 w-full rounded-lg border border-paper-200 bg-white px-3 py-2 text-sm"
                          value={draft.note}
                          onChange={(e) =>
                            setReviewDrafts((prev) => ({
                              ...prev,
                              [q.id]: { ...draft, note: e.target.value },
                            }))
                          }
                          placeholder="Örn. Video çözüm daha açık olmalı"
                          maxLength={1000}
                        />
                      </label>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={reviewBusy === q.id}
                        onClick={() => void reviewQuality(q.id, "accepted")}
                        className="rounded-lg bg-brand-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                      >
                        Kabul et
                      </button>
                      <button
                        type="button"
                        disabled={reviewBusy === q.id}
                        onClick={() => void reviewQuality(q.id, "revision_requested")}
                        className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950 disabled:opacity-50"
                      >
                        Revizyon iste
                      </button>
                      <button
                        type="button"
                        disabled={reviewBusy === q.id}
                        onClick={() => void reviewQuality(q.id, "flagged")}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800 disabled:opacity-50"
                      >
                        Bayrakla
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
        <p className="mt-3 text-xs text-paper-800/55">Toplam {total}</p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-paper-200 bg-white shadow-sm">
          {loading ? (
            <p className="p-6 text-sm">Yükleniyor…</p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-paper-200 bg-paper-50 text-xs font-semibold uppercase text-paper-800/75">
                <tr>
                  <th className="px-3 py-2">Öğrenci</th>
                  <th className="px-3 py-2">Konu</th>
                  <th className="px-3 py-2">Durum</th>
                  <th className="px-3 py-2">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-paper-100">
                    <td className="px-3 py-2">
                      {r.student_name}
                      <div className="text-xs text-paper-800/55">{r.student_email}</div>
                    </td>
                    <td className="max-w-[12rem] truncate px-3 py-2">{r.topic}</td>
                    <td className="px-3 py-2">{homeworkStatusLabel(r.status)}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        disabled={busy === r.id || r.status === "cancelled" || r.status === "closed"}
                        onClick={() => void cancel(r.id)}
                        className="rounded border border-red-200 px-2 py-1 text-xs text-red-800 disabled:opacity-40"
                      >
                        {busy === r.id ? "…" : "İptal"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <nav className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm" aria-label="Sayfalama">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - limit))}
            className="font-medium text-brand-800 underline decoration-brand-400 underline-offset-4 disabled:cursor-not-allowed disabled:opacity-30 disabled:no-underline"
          >
            ← Önceki
          </button>
          <button
            type="button"
            disabled={offset + limit >= total}
            onClick={() => setOffset((o) => o + limit)}
            className="text-paper-800/75 underline decoration-paper-300 underline-offset-4 disabled:cursor-not-allowed disabled:opacity-30 disabled:no-underline"
          >
            Sonraki →
          </button>
        </nav>
      </div>
    </div>
  );
}
