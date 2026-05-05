"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { clearToken, getToken } from "../../lib/auth";
import { homeworkPostStatusLabelTr } from "../../lib/homeworkStatusLabel";

type Branch = { id: number; parent_id: number | null; name: string; slug: string };
type PoolPost = {
  id: string;
  topic: string;
  status: string;
  created_at: string;
  help_text: string;
  image_urls_jsonb: unknown;
  audio_url: string | null;
  student_display_name: string;
};
type ClaimPost = PoolPost & {
  branch_id: number;
  claimed_at: string | null;
  resolve_deadline_at: string | null;
  answered_at: string | null;
  answer_text: string | null;
  answer_image_urls_jsonb: unknown;
};

function formatRemaining(deadlineIso: string | null): string {
  if (!deadlineIso) return "—";
  const end = new Date(deadlineIso).getTime();
  const ms = end - Date.now();
  if (ms <= 0) return "Süre doldu (yenilenince havuza dönebilir)";
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m} dk ${s} sn`;
}

export default function OdevHavuzuPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<number | "">("");
  const [tab, setTab] = useState<"pool" | "claims">("pool");
  const [posts, setPosts] = useState<PoolPost[]>([]);
  const [claims, setClaims] = useState<ClaimPost[]>([]);
  const [resolveMinutes, setResolveMinutes] = useState(20);
  const [rewardMinor, setRewardMinor] = useState(1000);
  const [error, setError] = useState<string | null>(null);
  const [claimBusy, setClaimBusy] = useState<string | null>(null);
  const [answerBusy, setAnswerBusy] = useState<string | null>(null);
  const [returnBusy, setReturnBusy] = useState<string | null>(null);
  const [answerDraft, setAnswerDraft] = useState<Record<string, string>>({});
  const [answerImagesByPost, setAnswerImagesByPost] = useState<Record<string, string[]>>({});
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [router, pathname]);

  useEffect(() => {
    if (tab !== "claims") return;
    const id = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, [tab]);

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

  const loadPool = useCallback(
    async (t: string, bid: number) => {
      const r = await apiFetch<{ posts: PoolPost[]; resolveMinutes?: number; satisfactionRewardMinor?: number }>(
        `/v1/student-platform/homework-posts/teacher/feed?branchId=${bid}`,
        { token: t },
      );
      setPosts(r.posts);
      if (typeof r.resolveMinutes === "number") setResolveMinutes(r.resolveMinutes);
      if (typeof r.satisfactionRewardMinor === "number") setRewardMinor(r.satisfactionRewardMinor);
    },
    [],
  );

  const loadClaims = useCallback(async (t: string) => {
    const r = await apiFetch<{ posts: ClaimPost[]; resolveMinutes?: number; satisfactionRewardMinor?: number }>(
      "/v1/student-platform/homework-posts/teacher/claims",
      { token: t },
    );
    setClaims(r.posts);
    if (typeof r.resolveMinutes === "number") setResolveMinutes(r.resolveMinutes);
    if (typeof r.satisfactionRewardMinor === "number") setRewardMinor(r.satisfactionRewardMinor);
  }, []);

  useEffect(() => {
    if (!token || branchId === "") return;
    setError(null);
    loadPool(token, Number(branchId)).catch((e) => {
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
  }, [token, branchId, loadPool, router, pathname]);

  useEffect(() => {
    if (!token) return;
    loadClaims(token).catch(() => {});
  }, [token, loadClaims, tab]);

  async function claim(id: string) {
    if (!token) return;
    setClaimBusy(id);
    setError(null);
    try {
      await apiFetch(`/v1/student-platform/homework-posts/${id}/claim`, { method: "POST", token });
      if (branchId !== "") await loadPool(token, Number(branchId));
      await loadClaims(token);
      setTab("claims");
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

  async function submitAnswer(id: string) {
    if (!token) return;
    const text = (answerDraft[id] ?? "").trim();
    if (text.length < 10) {
      setError("Cevap en az 10 karakter olmalı.");
      return;
    }
    setAnswerBusy(id);
    setError(null);
    const imgs = answerImagesByPost[id] ?? [];
    try {
      await apiFetch(`/v1/student-platform/homework-posts/${id}/answer`, {
        method: "POST",
        token,
        body: JSON.stringify({ answerText: text, answerImageUrls: imgs }),
      });
      setAnswerDraft((d) => ({ ...d, [id]: "" }));
      setAnswerImagesByPost((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
      await loadClaims(token);
      if (branchId !== "") await loadPool(token, Number(branchId));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "gönderilemedi";
      setError(msg);
    } finally {
      setAnswerBusy(null);
    }
  }

  async function teacherReturn(id: string) {
    if (!token) return;
    if (!window.confirm("Bu soruyu iade edince tekrar branş havuzuna düşer. Devam edilsin mi?")) return;
    setReturnBusy(id);
    setError(null);
    try {
      await apiFetch(`/v1/student-platform/homework-posts/${id}/teacher-return`, {
        method: "POST",
        token,
        body: JSON.stringify({}),
      });
      await loadClaims(token);
      if (branchId !== "") await loadPool(token, Number(branchId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "iade edilemedi");
    } finally {
      setReturnBusy(null);
    }
  }

  if (!token) return null;

  const rewardTl = (rewardMinor / 100).toFixed(2);

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <p className="text-sm font-medium text-zinc-500">Öğretmen</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">Soru / ödev havuzu</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Üstlenince soru {resolveMinutes} dakika yalnızca size aittir; sürede cevaplamazsanız tekrar havuza
          düşer. Öğrenci cevabı onaylarsa öğretmen cüzdanına <strong>{rewardTl} TL</strong> aktarılır (öğrenci
          cüzdanından). Öğrenci, ödeme öncesi cevabı yeterli bulmazsa soruyu tekrar havuza iade edebilir; bu
          durumda bildirim alırsınız. Ayrıca siz de çözmeden soruyu iade edebilirsiniz (ödeme olmaz).
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/teacher/requests"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
          >
            Açık talepler
          </Link>
          <Link
            href="/teacher/cuzdan"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
          >
            Cüzdan
          </Link>
          <Link href="/teacher" className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white">
            Panel
          </Link>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        )}

        <div className="mt-6 flex gap-2 border-b border-zinc-200 pb-2">
          <button
            type="button"
            onClick={() => setTab("pool")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === "pool" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            Havuz
          </button>
          <button
            type="button"
            onClick={() => setTab("claims")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === "claims" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            Üstlendiklerim ({claims.length})
          </button>
        </div>

        {tab === "pool" ? (
          <>
            <div className="mt-4">
              <label className="text-sm">
                <span className="font-medium text-zinc-700">Branş</span>
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
                    <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-zinc-700">{p.help_text}</p>
                    <div className="mt-1 text-xs text-zinc-500">
                      {homeworkPostStatusLabelTr(p.status)} ·{" "}
                      {new Date(p.created_at).toLocaleString("tr-TR")}
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
          </>
        ) : (
          <div className="mt-6 space-y-4">
            <span className="sr-only" aria-hidden>
              {tick}
            </span>
            {claims.length === 0 ? (
              <p className="text-sm text-zinc-500">Üstlenilmiş soru yok.</p>
            ) : (
              claims.map((p) => (
                <div
                  key={p.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm"
                >
                  <div className="font-medium text-zinc-900">
                    {p.topic} <span className="text-xs text-zinc-500">· {p.student_display_name}</span>
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {homeworkPostStatusLabelTr(p.status)}
                    {p.status === "claimed" && p.resolve_deadline_at ? (
                      <> · Kalan: {formatRemaining(p.resolve_deadline_at)}</>
                    ) : null}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-zinc-800">{p.help_text}</p>
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
                  {p.status === "claimed" ? (
                    <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3">
                      <label className="block text-xs font-medium text-zinc-700">Cevabınız</label>
                      <textarea
                        className="w-full min-h-32 rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                        placeholder="Çözümü yazın (en az 10 karakter)…"
                        value={answerDraft[p.id] ?? ""}
                        onChange={(e) =>
                          setAnswerDraft((d) => ({
                            ...d,
                            [p.id]: e.target.value,
                          }))
                        }
                      />
                      <label className="block text-xs text-zinc-600">
                        Cevap görselleri (isteğe, en fazla 4, ~350 KB)
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          className="mt-1 block w-full text-xs file:mr-2 file:rounded file:border file:border-zinc-200 file:bg-white file:px-2 file:py-0.5"
                          onChange={(e) => {
                            const files = Array.from(e.target.files ?? []).slice(0, 4);
                            if (files.length === 0) return;
                            void Promise.all(
                              files.map(
                                (file) =>
                                  new Promise<string>((resolve, reject) => {
                                    if (file.size > 350_000) {
                                      reject(
                                        new Error("Dosya çok büyük; sıkıştırın veya daha küçük görsel seçin."),
                                      );
                                      return;
                                    }
                                    const fr = new FileReader();
                                    fr.onload = () => resolve(String(fr.result ?? ""));
                                    fr.onerror = () => reject(new Error("okuma"));
                                    fr.readAsDataURL(file);
                                  }),
                              ),
                            )
                              .then((urls) => {
                                setAnswerImagesByPost((prev) => ({
                                  ...prev,
                                  [p.id]: [...(prev[p.id] ?? []), ...urls].slice(0, 4),
                                }));
                                setError(null);
                              })
                              .catch((err) => {
                                setError(err instanceof Error ? err.message : "Görsel eklenemedi");
                              });
                            e.target.value = "";
                          }}
                        />
                      </label>
                      {(answerImagesByPost[p.id] ?? []).length > 0 ? (
                        <p className="text-xs text-zinc-500">
                          {answerImagesByPost[p.id]!.length} görsel eklendi.
                          <button
                            type="button"
                            className="ml-2 text-brand-800 underline"
                            onClick={() =>
                              setAnswerImagesByPost((prev) => {
                                const n = { ...prev };
                                delete n[p.id];
                                return n;
                              })
                            }
                          >
                            Temizle
                          </button>
                        </p>
                      ) : null}
                      <button
                        type="button"
                        disabled={answerBusy === p.id}
                        onClick={() => void submitAnswer(p.id)}
                        className="rounded-lg bg-brand-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                      >
                        {answerBusy === p.id ? "…" : "Cevabı öğrenciye gönder"}
                      </button>
                      <button
                        type="button"
                        disabled={returnBusy === p.id || answerBusy === p.id}
                        onClick={() => void teacherReturn(p.id)}
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-900 disabled:opacity-50"
                      >
                        {returnBusy === p.id ? "…" : "İade et (havuz)"}
                      </button>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs font-medium text-brand-800">
                      Cevap gönderildi. Öğrenci onayı ve {rewardTl} TL için bekleniyor.
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
