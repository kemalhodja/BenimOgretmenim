"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { clearToken, getToken } from "../../lib/auth";
import { homeworkPostStatusLabelTr } from "../../lib/homeworkStatusLabel";
import { prepareHomeworkImage } from "../../lib/homeworkMedia";

type Branch = { id: number; parent_id: number | null; name: string; slug: string };
type PoolPost = {
  id: string;
  topic: string;
  status: string;
  created_at: string;
  help_text: string;
  image_urls_jsonb: unknown;
  audio_url: string | null;
  grade_level_text?: string | null;
  target_exam?: string | null;
  learning_objective?: string | null;
  urgency_level?: "normal" | "priority" | "urgent";
  target_answer_minutes?: number;
  quality_status?: string;
  resolution_sla_due_at?: string | null;
  student_display_name: string;
};
type ClaimPost = PoolPost & {
  branch_id: number;
  claimed_at: string | null;
  resolve_deadline_at: string | null;
  answered_at: string | null;
  answer_text: string | null;
  answer_image_urls_jsonb: unknown;
  answer_video_url?: string | null;
  quality_score?: number | null;
  revision_requested_at?: string | null;
  accepted_quality_at?: string | null;
  moderator_note?: string | null;
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
  const [answerVideoByPost, setAnswerVideoByPost] = useState<Record<string, string>>({});
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
    const video = answerVideoByPost[id]?.trim() ?? "";
    try {
      await apiFetch(`/v1/student-platform/homework-posts/${id}/answer`, {
        method: "POST",
        token,
        body: JSON.stringify({ answerText: text, answerImageUrls: imgs, answerVideoUrl: video || null }),
      });
      setAnswerDraft((d) => ({ ...d, [id]: "" }));
      setAnswerVideoByPost((d) => ({ ...d, [id]: "" }));
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
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Soru / ödev havuzu</h1>
        <p className="mt-1 text-sm text-paper-800/75">
          Üstlenince soru {resolveMinutes} dakika yalnızca size aittir; sürede cevaplamazsanız tekrar havuza
          düşer. Öğrenci cevabı onaylarsa <strong>{rewardTl} TL</strong> BenimÖğretmenim havuzundan öğretmen
          cüzdanınıza aktarılır. Öğrenci, ödeme öncesi cevabı yeterli bulmazsa soruyu tekrar havuza iade edebilir; bu
          durumda bildirim alırsınız. Ayrıca siz de çözmeden soruyu iade edebilirsiniz (ödeme olmaz).
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        )}

        <div className="mt-6 flex gap-2 border-b border-paper-200 pb-2">
          <button
            type="button"
            onClick={() => setTab("pool")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === "pool" ? "bg-brand-800 text-white" : "text-paper-800 hover:bg-paper-100"
            }`}
          >
            Havuz
          </button>
          <button
            type="button"
            onClick={() => setTab("claims")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === "claims" ? "bg-brand-800 text-white" : "text-paper-800 hover:bg-paper-100"
            }`}
          >
            Üstlendiklerim ({claims.length})
          </button>
        </div>

        {tab === "pool" ? (
          <>
            <div className="mt-4">
              <label className="text-sm">
                <span className="font-medium text-paper-800">Branş</span>
                <select
                  className="ml-0 mt-1 w-full max-w-sm rounded-xl border border-paper-200 px-3 py-2"
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
                <p className="text-sm text-paper-800/55">Branş seçin.</p>
              ) : posts.length === 0 ? (
                <p className="text-sm text-paper-800/55">Açık gönderi yok.</p>
              ) : (
                posts.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl border border-paper-200 bg-white p-4 text-sm shadow-sm"
                  >
                    <div className="font-medium text-paper-900">
                      {p.topic}{" "}
                      <span className="text-xs text-paper-800/55">· {p.student_display_name}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                      <span className={`rounded-full px-2 py-0.5 font-medium ${urgencyClass(p.urgency_level)}`}>
                        {urgencyLabel(p.urgency_level)}
                      </span>
                      {p.grade_level_text ? (
                        <span className="rounded-full bg-paper-100 px-2 py-0.5 font-medium text-paper-800">
                          {p.grade_level_text}
                        </span>
                      ) : null}
                      {p.target_exam ? (
                        <span className="rounded-full bg-paper-100 px-2 py-0.5 font-medium text-paper-800">
                          {p.target_exam}
                        </span>
                      ) : null}
                      {p.learning_objective ? (
                        <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-900">
                          {p.learning_objective}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-paper-800">{p.help_text}</p>
                    <div className="mt-1 text-xs text-paper-800/55">
                      {homeworkPostStatusLabelTr(p.status)} ·{" "}
                      {new Date(p.created_at).toLocaleString("tr-TR")}
                      {p.target_answer_minutes ? ` · SLA: ${p.target_answer_minutes} dk` : ""}
                    </div>
                    <div className="mt-2 inline-flex rounded-full bg-paper-100 px-2 py-0.5 text-[11px] font-medium text-paper-800">
                      Kalite: {p.quality_status ?? "not_reviewed"}
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
                      className="mt-2 rounded-lg bg-brand-800 px-3 py-1.5 text-xs text-white"
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
              <p className="text-sm text-paper-800/55">Üstlenilmiş soru yok.</p>
            ) : (
              claims.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-paper-200 bg-white p-4 text-sm shadow-sm"
                >
                  <div className="font-medium text-paper-900">
                    {p.topic} <span className="text-xs text-paper-800/55">· {p.student_display_name}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    <span className={`rounded-full px-2 py-0.5 font-medium ${urgencyClass(p.urgency_level)}`}>
                      {urgencyLabel(p.urgency_level)}
                    </span>
                    {p.grade_level_text ? (
                      <span className="rounded-full bg-paper-100 px-2 py-0.5 font-medium text-paper-800">
                        {p.grade_level_text}
                      </span>
                    ) : null}
                    {p.target_exam ? (
                      <span className="rounded-full bg-paper-100 px-2 py-0.5 font-medium text-paper-800">
                        {p.target_exam}
                      </span>
                    ) : null}
                    {p.learning_objective ? (
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-900">
                        {p.learning_objective}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-xs text-paper-800/55">
                    {homeworkPostStatusLabelTr(p.status)}
                    {p.status === "claimed" && p.resolve_deadline_at ? (
                      <> · Kalan: {formatRemaining(p.resolve_deadline_at)}</>
                    ) : null}
                    {p.resolution_sla_due_at ? (
                      <> · SLA: {formatRemaining(p.resolution_sla_due_at)}</>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-full bg-paper-100 px-2 py-0.5 font-medium text-paper-800">
                      Kalite: {p.quality_status ?? "not_reviewed"}
                    </span>
                    {p.quality_score ? (
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-900">
                        Puan: {p.quality_score}/5
                      </span>
                    ) : null}
                    {p.revision_requested_at ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-950">
                        Revizyon istendi
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-paper-800">{p.help_text}</p>
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
                    <div className="mt-3 space-y-2 border-t border-paper-100 pt-3">
                      <label className="block text-xs font-medium text-paper-800">Cevabınız</label>
                      <textarea
                        className="w-full min-h-32 rounded-xl border border-paper-200 px-3 py-2 text-sm"
                        placeholder="Çözümü yazın (en az 10 karakter)…"
                        value={answerDraft[p.id] ?? ""}
                        onChange={(e) =>
                          setAnswerDraft((d) => ({
                            ...d,
                            [p.id]: e.target.value,
                          }))
                        }
                      />
                      <label className="block text-xs text-paper-800/75">
                        Çözüm videosu URL (isteğe bağlı)
                        <input
                          value={answerVideoByPost[p.id] ?? ""}
                          onChange={(e) =>
                            setAnswerVideoByPost((d) => ({
                              ...d,
                              [p.id]: e.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2 text-sm"
                          placeholder="https://..."
                        />
                      </label>
                      <label className="block text-xs text-paper-800/75">
                        Cevap görselleri (isteğe, en fazla 4, otomatik sıkıştırılır)
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          className="mt-1 block w-full text-xs file:mr-2 file:rounded file:border file:border-paper-200 file:bg-white file:px-2 file:py-0.5"
                          onChange={(e) => {
                            const files = Array.from(e.target.files ?? []).slice(0, 4);
                            if (files.length === 0) return;
                            const remaining = Math.max(0, 4 - (answerImagesByPost[p.id] ?? []).length);
                            if (remaining === 0) {
                              setError("En fazla 4 cevap görseli ekleyebilirsiniz.");
                              e.target.value = "";
                              return;
                            }
                            void Promise.all(files.slice(0, remaining).map((file) => prepareHomeworkImage(file)))
                              .then((items) => {
                                setAnswerImagesByPost((prev) => ({
                                  ...prev,
                                  [p.id]: [...(prev[p.id] ?? []), ...items.map((item) => item.dataUrl)].slice(0, 4),
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
                        <div className="text-xs text-paper-800/55">
                          <span>{answerImagesByPost[p.id]!.length} görsel eklendi.</span>
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
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {answerImagesByPost[p.id]!.map((src, idx) => (
                              <div key={`${p.id}-${idx}`} className="rounded-lg border border-paper-200 bg-paper-50 p-1">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={src} alt={`Cevap önizleme ${idx + 1}`} className="h-24 w-full object-contain" />
                              </div>
                            ))}
                          </div>
                        </div>
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
                        className="rounded-lg border border-paper-200 bg-white px-3 py-2 text-xs font-medium text-paper-900 disabled:opacity-50"
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
