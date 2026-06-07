"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../../lib/api";
import { loginHrefWithReturn } from "../../../lib/authRedirect";
import { clearToken, getToken } from "../../../lib/auth";
import { homeworkPostStatusLabelTr } from "../../../lib/homeworkStatusLabel";

type PostDetail = {
  id: string;
  topic: string;
  help_text: string;
  status: string;
  branch_name: string | null;
  image_urls_jsonb: unknown;
  audio_url: string | null;
  grade_level_text?: string | null;
  target_exam?: string | null;
  learning_objective?: string | null;
  urgency_level?: "normal" | "priority" | "urgent";
  answer_text: string | null;
  answer_image_urls_jsonb: unknown;
  answer_video_url?: string | null;
  answered_at: string | null;
  target_answer_minutes?: number;
  quality_status?: string;
  quality_score?: number | null;
  ai_metadata_jsonb?: unknown;
  answer_quality_jsonb?: unknown;
  storage_backend?: string | null;
  revision_requested_at?: string | null;
  accepted_quality_at?: string | null;
  moderator_note?: string | null;
  resolution_sla_due_at?: string | null;
  student_satisfied_at: string | null;
  homework_reward_minor: number | null;
  homework_reward_applied_at: string | null;
  teacher_display_name: string | null;
  resolve_deadline_at: string | null;
  /** Migration 017 sonrası API döner; yoksa iade rozeti gösterilmez. */
  last_answer_rejected_at?: string | null;
};

function aiList(meta: unknown, key: string): string[] {
  if (!meta || typeof meta !== "object") return [];
  const value = (meta as Record<string, unknown>)[key];
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean).slice(0, 3) : [];
}

function aiValue(meta: unknown, key: string): string | null {
  if (!meta || typeof meta !== "object") return null;
  const value = (meta as Record<string, unknown>)[key];
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function homeworkNextStep(post: PostDetail): string {
  if (post.status === "open") return "Öğretmen havuzunda; uygun öğretmen üstlenince süre başlar.";
  if (post.status === "claimed") return "Öğretmen çözüm üzerinde; hedef süre takip ediliyor.";
  if (post.status === "answered") return "Cevabı inceleyin; yeterliyse onaylayın, değilse iade edin.";
  if (post.status === "satisfied") return "Cevap onaylandı; benzer alıştırmalarla tekrar yapın.";
  if (post.status === "cancelled") return "Gönderi iptal edildi.";
  return "Durumu takip edin.";
}

function qualityStatusLabel(status: string | null | undefined): string {
  if (!status) return "İnceleme bekliyor";
  const labels: Record<string, string> = {
    not_reviewed: "İnceleme bekliyor",
    pending_review: "İncelemede",
    approved: "Uygun",
    needs_revision: "Düzeltme gerekiyor",
    rejected: "Uygun bulunmadı",
  };
  return labels[status] ?? "Durum güncellendi";
}

export default function OdevDetayPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const params = useParams<{ postId: string }>();
  const postId = params.postId;

  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<{
    post: PostDetail;
    satisfactionRewardMinor: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectBusy, setRejectBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [router, pathname]);

  const load = useCallback(async () => {
    if (!token || !postId) return;
    setError(null);
    const r = await apiFetch<{
      post: PostDetail;
      satisfactionRewardMinor: number;
    }>(`/v1/student-platform/homework-posts/view/${postId}`, { token });
    setData(r);
  }, [token, postId]);

  useEffect(() => {
    if (!token || !postId) return;
    load().catch((e) => {
      const m = e instanceof Error ? e.message : "yükle";
      if (m.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
        return;
      }
      if (m.includes("[403]")) {
        setError("Bu soruyu görüntüleme yetkiniz yok.");
        return;
      }
      setError(m);
    });
  }, [token, postId, load, router, pathname]);

  async function markSatisfied() {
    if (!token || !postId) return;
    const reward = data?.satisfactionRewardMinor ?? 500;
    const tl = (reward / 100).toFixed(2);
    if (
      !window.confirm(
        `Öğretmene ${tl} TL ödül aktarılacak (BenimÖğretmenim havuzundan). Onaylıyor musunuz?`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/v1/student-platform/homework-posts/${postId}/mark-satisfied`, {
        method: "POST",
        token,
        body: JSON.stringify({}),
      });
      await load();
    } catch (e) {
      const m = e instanceof Error ? e.message : "hata";
      setError(m);
      if (m.includes("insufficient_platform_pool") || m.includes("platform_pool_balance")) {
        setError(
          "Ödeme havuzunda geçici olarak yeterli bakiye yok. Kısa süre sonra tekrar deneyin veya destek ile iletişime geçin.",
        );
      }
      if (m.includes("platform_homework_wallet_not_configured")) {
        setError("Ödeme havuzu yapılandırılmamış. Lütfen destek ile iletişime geçin.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function rejectAnswer() {
    if (!token || !postId) return;
    if (
      !window.confirm(
        "Öğretmen cevabı kaldırılır ve soru tekrar branş havuzuna açılır. Henüz ödeme yapılmaz. Devam edilsin mi?",
      )
    ) {
      return;
    }
    setRejectBusy(true);
    setError(null);
    try {
      const note = rejectNote.trim().slice(0, 500);
      await apiFetch(`/v1/student-platform/homework-posts/${postId}/reject-answer`, {
        method: "POST",
        token,
        body: JSON.stringify(note ? { note } : {}),
      });
      setRejectNote("");
      await load();
    } catch (e) {
      const m = e instanceof Error ? e.message : "hata";
      setError(m);
    } finally {
      setRejectBusy(false);
    }
  }

  async function cancelHomework() {
    if (!token || !postId) return;
    if (
      !window.confirm(
        "Gönderi iptal edilecek; öğretmen havuzunda görünmez. Emin misiniz?",
      )
    ) {
      return;
    }
    setCancelBusy(true);
    setError(null);
    try {
      await apiFetch(`/v1/student-platform/homework-posts/${postId}/cancel`, {
        method: "POST",
        token,
        body: JSON.stringify({}),
      });
      router.push("/student/odev-sor/gonderiler");
    } catch (e) {
      const m = e instanceof Error ? e.message : "hata";
      if (m.includes("not_cancellable")) {
        setError("Bu aşamada iptal edilemez (ör. öğretmen zaten üstlendiyse).");
      } else {
        setError(m);
      }
    } finally {
      setCancelBusy(false);
    }
  }

  if (!token) return null;

  const post = data?.post;
  const imgs = Array.isArray(post?.image_urls_jsonb) ? (post!.image_urls_jsonb as string[]) : [];
  const ansImgs = Array.isArray(post?.answer_image_urls_jsonb)
    ? (post!.answer_image_urls_jsonb as string[])
    : [];

  const urgencyText =
    post?.urgency_level === "urgent" ? "Acil" : post?.urgency_level === "priority" ? "Öncelikli" : "Normal";

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <Link href="/student/odev-sor/gonderiler" className="text-sm font-medium text-brand-800 underline">
          ← Gönderilerim
        </Link>
        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {!post ? (
          <p className="mt-6 text-sm text-paper-800/55">Yükleniyor…</p>
        ) : (
          <div className="mt-6 space-y-6">
            <header>
                            <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Gönderi detayı</h1>
            </header>
            {post.status === "open" && post.last_answer_rejected_at ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
                Son öğretmen cevabını havuza iade ettiniz; soru branş havuzunda tekrar görünür. Başka bir
                öğretmen üstlenebilir.
              </div>
            ) : null}
            {post.status === "cancelled" ? (
              <div className="rounded-xl border border-paper-200 bg-paper-100/90 p-4 text-sm text-paper-800">
                Bu gönderiyi iptal ettiniz; öğretmen havuzunda listelenmez.
              </div>
            ) : null}
            <section className="rounded-xl border border-paper-200 bg-white p-5 shadow-sm" aria-labelledby="homework-topic">
              <h2 id="homework-topic" className="text-xl font-semibold text-paper-900">
                {post.topic}
              </h2>
              <p className="mt-1 text-xs text-paper-800/55">
                {post.branch_name ?? "—"} · {homeworkPostStatusLabelTr(post.status)} ·{" "}
                {post.teacher_display_name ? `Öğretmen: ${post.teacher_display_name}` : null}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                <span className="rounded-full bg-paper-100 px-2 py-0.5 font-medium text-paper-800">
                  Öncelik: {urgencyText}
                </span>
                {post.grade_level_text ? (
                  <span className="rounded-full bg-paper-100 px-2 py-0.5 font-medium text-paper-800">
                    {post.grade_level_text}
                  </span>
                ) : null}
                {post.target_exam ? (
                  <span className="rounded-full bg-paper-100 px-2 py-0.5 font-medium text-paper-800">
                    {post.target_exam}
                  </span>
                ) : null}
                {post.learning_objective ? (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-900">
                    {post.learning_objective}
                  </span>
                ) : null}
                <span className="rounded-full bg-paper-100 px-2 py-0.5 font-medium text-paper-800">
                  Hedef süre: {post.target_answer_minutes ?? 20} dk
                </span>
                <span className="rounded-full bg-paper-100 px-2 py-0.5 font-medium text-paper-800">
                  Kalite: {qualityStatusLabel(post.quality_status)}
                </span>
                {post.quality_score ? (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-900">
                    Puan: {post.quality_score}/100
                  </span>
                ) : null}
                {aiValue(post.ai_metadata_jsonb, "difficulty") ? (
                  <span className="rounded-full bg-warm-50 px-2 py-0.5 font-medium text-warm-900">
                    Zorluk: {aiValue(post.ai_metadata_jsonb, "difficulty")}
                  </span>
                ) : null}
                {aiValue(post.ai_metadata_jsonb, "topic_hint") ? (
                  <span className="rounded-full bg-warm-50 px-2 py-0.5 font-medium text-warm-900">
                    Konu: {aiValue(post.ai_metadata_jsonb, "topic_hint")}
                  </span>
                ) : null}
              </div>
              <div className="mt-4 rounded-xl border border-paper-100 bg-paper-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-paper-800/55">
                  Sıradaki adım
                </div>
                <p className="mt-1 text-sm font-medium text-paper-900">{homeworkNextStep(post)}</p>
                <p className="mt-1 text-xs leading-relaxed text-paper-800/60">
                  Hedef süre: {post.target_answer_minutes ?? 20} dk · Cevap kalite durumu: {qualityStatusLabel(post.quality_status)}
                </p>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm text-paper-800">{post.help_text}</p>
              {aiList(post.ai_metadata_jsonb, "similar_practice").length > 0 ? (
                <div className="mt-3 rounded-xl border border-brand-100 bg-brand-50/60 p-3 text-xs text-brand-950">
                  <div className="font-semibold">Bu sorudan sonra önerilen 3 benzer alıştırma</div>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {aiList(post.ai_metadata_jsonb, "similar_practice").map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {imgs.length > 0 && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {imgs.map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={src}
                      alt={`Görsel ${i + 1}`}
                      className="max-h-64 w-full rounded-lg border object-contain"
                    />
                  ))}
                </div>
              )}
              {post.audio_url ? (
                <a
                  href={post.audio_url}
                  className="mt-2 inline-block text-sm text-blue-700 underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Ses dosyası
                </a>
              ) : null}
              {post.status === "open" ? (
                <div className="mt-5 border-t border-paper-100 pt-4">
                  <button
                    type="button"
                    disabled={cancelBusy || busy || rejectBusy}
                    onClick={() => void cancelHomework()}
                    className="text-sm font-medium text-red-700 underline decoration-red-300 hover:text-red-900 disabled:opacity-50"
                  >
                    {cancelBusy ? "…" : "Gönderiyi iptal et (havuzdan kaldır)"}
                  </button>
                </div>
              ) : null}
            </section>

            {post.answer_text ? (
              <section className="rounded-xl border border-brand-200 bg-brand-50/40 p-5 shadow-sm">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-900">
                  Öğretmen cevabı
                </h2>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {[
                    ["Kalite", post.quality_score ? `${post.quality_score}/100` : qualityStatusLabel(post.quality_status)],
                    ["Ödeme", post.homework_reward_applied_at ? "Ödül aktarıldı" : "Onay bekliyor"],
                    ["Tekrar", aiList(post.ai_metadata_jsonb, "similar_practice").length ? "Alıştırma hazır" : "Cevap sonrası önerilir"],
                  ].map(([title, value]) => (
                    <div key={title} className="rounded-xl border border-brand-100 bg-white/80 p-3">
                      <div className="text-xs font-semibold text-brand-950">{title}</div>
                      <div className="mt-1 text-sm font-semibold text-paper-900">{value}</div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-paper-900">{post.answer_text}</p>
                {post.answer_video_url ? (
                  <a
                    href={post.answer_video_url}
                    className="mt-3 inline-block text-sm font-medium text-blue-700 underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Çözüm videosunu aç
                  </a>
                ) : null}
                {ansImgs.length > 0 && (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {ansImgs.map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={src}
                        alt={`Cevap görseli ${i + 1}`}
                        className="max-h-64 w-full rounded-lg border object-contain"
                      />
                    ))}
                  </div>
                )}
                {post.status === "answered" && !post.homework_reward_applied_at ? (
                  <div className="mt-4 space-y-3">
                    <label className="block text-xs text-paper-800/75">
                      İsteğe bağlı kısa not (öğretmene bildirimde iletilir, en fazla 500 karakter)
                      <textarea
                        className="mt-1 w-full min-h-16 rounded-xl border border-paper-200 px-3 py-2 text-sm text-paper-900"
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        maxLength={500}
                        disabled={busy || rejectBusy}
                        placeholder="Örn. Adım açıklaması eksik kaldı…"
                      />
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                      <button
                        type="button"
                        disabled={busy || rejectBusy}
                        onClick={() => void rejectAnswer()}
                        className="w-full rounded-xl border border-amber-300 bg-amber-50 py-2.5 text-sm font-medium text-amber-950 disabled:opacity-50 sm:flex-1"
                      >
                        {rejectBusy ? "…" : "Cevabı yeterli bulmadım — havuza iade"}
                      </button>
                      <button
                        type="button"
                        disabled={busy || rejectBusy}
                        onClick={() => void markSatisfied()}
                        className="w-full rounded-xl bg-brand-700 py-2.5 text-sm font-medium text-white disabled:opacity-50 sm:flex-1"
                      >
                    {busy
                      ? "…"
                      : `Cevabı yeterli buldum — öğretmene ${((data?.satisfactionRewardMinor ?? 1000) / 100).toFixed(2)} TL (havuzdan)`}
                      </button>
                    </div>
                  </div>
                ) : null}
                {post.homework_reward_applied_at ? (
                  <p className="mt-3 text-sm font-medium text-brand-800">
                    Teşekkürünüz kaydedildi; ödeme öğretmen cüzdanına aktarıldı.
                  </p>
                ) : null}
              </section>
            ) : post.status === "claimed" ? (
              <p className="text-sm text-paper-800/75">
                Bir öğretmen soruyu üstlendi; cevap hazırlanıyor. Son tarih:{" "}
                {post.resolve_deadline_at
                  ? new Date(post.resolve_deadline_at).toLocaleString("tr-TR")
                  : "—"}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
