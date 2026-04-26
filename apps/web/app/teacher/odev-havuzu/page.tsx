"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { clearToken, getToken } from "../../lib/auth";

type Branch = { id: number; parent_id: number | null; name: string; slug: string };
type Post = {
  id: string;
  topic: string;
  status: string;
  created_at: string;
  image_urls_jsonb: unknown;
  audio_url: string | null;
  student_display_name: string;
};

export default function OdevHavuzuPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<number | "">("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [claimBusy, setClaimBusy] = useState<string | null>(null);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [router, pathname]);

  useEffect(() => {
    apiFetch<{ branches: Branch[] }>("/v1/meta/branches")
      .then((r) => setBranches(r.branches))
      .catch(() => setError("branş yok"));
  }, []);

  const leaf = useMemo(() => {
    const h = new Set<number>();
    for (const b of branches) if (b.parent_id != null) h.add(b.parent_id);
    return branches.filter((b) => !h.has(b.id));
  }, [branches]);

  const load = useCallback(
    async (t: string, bid: number) => {
      const r = await apiFetch<{ posts: Post[] }>(
        `/v1/student-platform/homework-posts/teacher/feed?branchId=${bid}`,
        { token: t },
      );
      setPosts(r.posts);
    },
    [],
  );

  useEffect(() => {
    if (!token || branchId === "") return;
    setError(null);
    load(token, Number(branchId)).catch((e) => {
      const m = e instanceof Error ? e.message : "yükle";
      if (m.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
        return;
      }
      if (m.includes("not_your_branch")) {
        setError("Bu branş profilinde tanımlı değil. Önce branş ekleyin (öğretmen profili).");
        return;
      }
      if (m.includes("[403]")) {
        setError("Bu sayfa yalnızca öğretmen hesabı içindir.");
        return;
      }
      setError(m);
    });
  }, [token, branchId, load, router, pathname]);

  async function claim(id: string) {
    if (!token) return;
    setClaimBusy(id);
    setError(null);
    try {
      await apiFetch(`/v1/student-platform/homework-posts/${id}/claim`, { method: "POST", token });
      if (branchId !== "") await load(token, Number(branchId));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "alınamadı";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Bu ilanı alma izniniz yok.");
      }
    } finally {
      setClaimBusy(null);
    }
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="text-sm text-zinc-500">Öğretmen</div>
        <h1 className="text-2xl font-semibold text-zinc-900">Soru / ödev havuzu</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Branş profilinizle eşleşen ilanlar. Aç → öğrenci adı ile havuz dışı iletişim
          (mesaj) sonraki adımda.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/teacher/requests"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
          >
            Açık talepler
          </Link>
          <Link
            href="/teacher/teklifler"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
          >
            Tekliflerim
          </Link>
          <Link
            href="/teacher/dersler"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
          >
            Ders oturumları
          </Link>
          <Link
            href="/teacher/cuzdan"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
          >
            Cüzdan
          </Link>
          <Link
            href="/teacher/dogrudan-dersler"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
          >
            Doğrudan dersler
          </Link>
          <Link
            href="/teacher/kurslar"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
          >
            Online kurslar
          </Link>
          <Link
            href="/teacher"
            className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
          >
            Panel
          </Link>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="mt-6">
          <label className="text-sm">
            <span className="font-medium text-zinc-700">Branş (sizin teacher_branches kaydınız olmalı)</span>
            <select
              className="ml-0 mt-1 w-full max-w-sm rounded-xl border border-zinc-200 px-3 py-2"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Seçin</option>
              {leaf.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 space-y-3">
          {branchId === "" ? (
            <p className="text-sm text-zinc-500">Branş seçin.</p>
          ) : posts.length === 0 ? (
            <p className="text-sm text-zinc-500">Açık gönderi yok.</p>
          ) : (
            posts.map((p) => (
              <div
                key={p.id}
                className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm"
              >
                <div className="font-medium text-zinc-900">
                  {p.topic}{" "}
                  <span className="text-xs text-zinc-500">· {p.student_display_name}</span>
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {p.status} · {new Date(p.created_at).toLocaleString("tr-TR")}
                </div>
                {Array.isArray(p.image_urls_jsonb) && (p.image_urls_jsonb as string[]).length > 0 && (
                  <ul className="mt-2 text-xs text-blue-700">
                    {(p.image_urls_jsonb as string[]).map((u, i) => (
                      <li key={i}>
                        <a href={u} className="underline" target="_blank" rel="noreferrer">
                          Görsel {i + 1}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                {p.audio_url ? (
                  <a
                    href={p.audio_url}
                    className="mt-1 block text-xs text-blue-700 underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ses
                  </a>
                ) : null}
                <button
                  type="button"
                  disabled={claimBusy === p.id}
                  onClick={() => void claim(p.id)}
                  className="mt-2 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs text-white"
                >
                  {claimBusy === p.id ? "…" : "Üstlen"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
