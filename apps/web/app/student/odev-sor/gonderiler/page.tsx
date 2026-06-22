"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../../lib/api";
import { loginHrefWithReturn } from "../../../lib/authRedirect";
import { clearToken, getToken } from "../../../lib/auth";
import { homeworkPostStatusLabelTr } from "../../../lib/homeworkStatusLabel";
import { userErrorMessage } from "../../../lib/userFacingMessageTr";
import { EmptyStateCard } from "../../../components/EmptyStateCard";

type PostRow = {
  id: string;
  topic: string;
  status: string;
  created_at: string;
  branch_name: string | null;
  answered_at: string | null;
  homework_reward_applied_at: string | null;
  last_answer_rejected_at?: string | null;
};

export default function OdevGonderilerPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [router, pathname]);

  const load = useCallback(async (t: string) => {
    const r = await apiFetch<{ posts: PostRow[] }>("/v1/student-platform/homework-posts/mine", {
      token: t,
    });
    setPosts(r.posts);
  }, []);

  useEffect(() => {
    if (!token) return;
    load(token).catch((e) => {
      const raw = e instanceof Error ? e.message : "yüklenemedi";
      if (raw.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
        return;
      }
      setError(userErrorMessage(e, "yüklenemedi"));
    });
  }, [token, load, router, pathname]);

  if (!token) return null;

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <Link
          href="/student/odev-sor"
          className="text-sm font-medium text-brand-800 underline decoration-brand-400 underline-offset-4"
        >
          ← Soru / ödev
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-paper-900">Gönderdiğim sorular</h1>
        <p className="mt-2 text-sm text-paper-800/65">
          <Link
            href="/student/odev-sor"
            className="text-paper-800/75 underline decoration-paper-300 underline-offset-4 hover:text-paper-900"
          >
            Yeni soru gönder
          </Link>
        </p>
        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}
        <ul className="mt-6 space-y-3">
          {posts.length === 0 ? (
            <li>
              <EmptyStateCard
                title="Henüz soru göndermediniz"
                body="Takıldığınız sorunun fotoğrafını çekin; öğretmen havuzundan çözüm gelsin."
                primaryHref="/student/odev-sor"
                primaryLabel="Soru gönder"
                secondaryHref="/student/panel"
                secondaryLabel="Öğrenci özeti"
                testId="odev-gonderiler-empty-state"
              />
            </li>
          ) : (
            posts.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/student/odev-sor/${p.id}`}
                  className="block rounded-xl border border-paper-200 bg-white p-4 shadow-sm hover:border-brand-300"
                >
                  <div className="font-medium text-paper-900">{p.topic}</div>
                  <div className="mt-1 text-xs text-paper-800/55">
                    {p.branch_name ?? "—"} · {homeworkPostStatusLabelTr(p.status)} ·{" "}
                    {new Date(p.created_at).toLocaleString("tr-TR")}
                  </div>
                  {p.status === "open" && p.last_answer_rejected_at ? (
                    <div className="mt-2 text-xs font-medium text-amber-900">
                      Cevap iade edildi — tekrar havuzda, öğretmen bekleniyor
                    </div>
                  ) : null}
                  {p.answered_at && !p.homework_reward_applied_at ? (
                    <div className="mt-2 text-xs font-medium text-amber-800">
                      Cevap geldi — onay ve ödeme için tıklayın
                    </div>
                  ) : null}
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
