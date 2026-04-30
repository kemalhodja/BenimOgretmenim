"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../../lib/api";
import { loginHrefWithReturn } from "../../../lib/authRedirect";
import { clearToken, getToken } from "../../../lib/auth";

type PostDetail = {
  id: string;
  topic: string;
  help_text: string;
  status: string;
  branch_name: string | null;
  image_urls_jsonb: unknown;
  audio_url: string | null;
  answer_text: string | null;
  answer_image_urls_jsonb: unknown;
  answered_at: string | null;
  student_satisfied_at: string | null;
  homework_reward_minor: number | null;
  homework_reward_applied_at: string | null;
  teacher_display_name: string | null;
  resolve_deadline_at: string | null;
};

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
    if (!window.confirm(`Öğretmene ${tl} TL aktarılacak (cüzdanınızdan düşülür). Onaylıyor musunuz?`)) {
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
      if (m.includes("insufficient_wallet")) {
        setError("Cüzdan bakiyeniz yetersiz. Önce cüzdan yükleyin (/student/panel).");
      }
    } finally {
      setBusy(false);
    }
  }

  if (!token) return null;

  const post = data?.post;
  const imgs = Array.isArray(post?.image_urls_jsonb) ? (post!.image_urls_jsonb as string[]) : [];
  const ansImgs = Array.isArray(post?.answer_image_urls_jsonb)
    ? (post!.answer_image_urls_jsonb as string[])
    : [];

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <Link href="/student/odev-sor/gonderiler" className="text-sm font-medium text-brand-800 underline">
          ← Gönderilerim
        </Link>
        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {!post ? (
          <p className="mt-6 text-sm text-zinc-500">Yükleniyor…</p>
        ) : (
          <div className="mt-6 space-y-6">
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h1 className="text-xl font-semibold text-zinc-900">{post.topic}</h1>
              <p className="mt-1 text-xs text-zinc-500">
                {post.branch_name ?? "—"} · {post.status} ·{" "}
                {post.teacher_display_name ? `Öğretmen: ${post.teacher_display_name}` : null}
              </p>
              <p className="mt-4 whitespace-pre-wrap text-sm text-zinc-800">{post.help_text}</p>
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
            </section>

            {post.answer_text ? (
              <section className="rounded-2xl border border-brand-200 bg-brand-50/40 p-5 shadow-sm">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-900">
                  Öğretmen cevabı
                </h2>
                <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-900">{post.answer_text}</p>
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
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void markSatisfied()}
                    className="mt-4 w-full rounded-xl bg-brand-700 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {busy
                      ? "…"
                      : `Cevabı yeterli buldum — öğretmene ${((data?.satisfactionRewardMinor ?? 500) / 100).toFixed(2)} TL`}
                  </button>
                ) : null}
                {post.homework_reward_applied_at ? (
                  <p className="mt-3 text-sm font-medium text-emerald-800">
                    Teşekkürünüz kaydedildi; ödeme öğretmen cüzdanına aktarıldı.
                  </p>
                ) : null}
              </section>
            ) : post.status === "claimed" ? (
              <p className="text-sm text-zinc-600">
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
