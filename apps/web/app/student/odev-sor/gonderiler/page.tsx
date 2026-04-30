"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../../lib/api";
import { loginHrefWithReturn } from "../../../lib/authRedirect";
import { clearToken, getToken } from "../../../lib/auth";

type PostRow = {
  id: string;
  topic: string;
  status: string;
  created_at: string;
  branch_name: string | null;
  answered_at: string | null;
  homework_reward_applied_at: string | null;
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
      const m = e instanceof Error ? e.message : "yükle";
      if (m.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
        return;
      }
      setError(m);
    });
  }, [token, load, router, pathname]);

  if (!token) return null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <div className="text-sm text-zinc-500">Öğrenci</div>
        <h1 className="text-2xl font-semibold text-zinc-900">Gönderdiğim sorular</h1>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link className="font-medium text-brand-800 underline" href="/student/odev-sor">
            Yeni soru
          </Link>
          <Link className="text-zinc-700 underline" href="/student/panel">
            Panel
          </Link>
        </div>
        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}
        <ul className="mt-6 space-y-3">
          {posts.length === 0 ? (
            <p className="text-sm text-zinc-500">Henüz gönderi yok.</p>
          ) : (
            posts.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/student/odev-sor/${p.id}`}
                  className="block rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-brand-300"
                >
                  <div className="font-medium text-zinc-900">{p.topic}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {p.branch_name ?? "—"} · {p.status} ·{" "}
                    {new Date(p.created_at).toLocaleString("tr-TR")}
                  </div>
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
