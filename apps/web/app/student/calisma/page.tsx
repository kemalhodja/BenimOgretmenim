"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { clearToken, getToken } from "../../lib/auth";
import { loginHrefWithReturn } from "../../lib/authRedirect";

type LearningModule = {
  id: string;
  slug: string;
  title: string;
  branch_slug: string | null;
  level_code: string | null;
  estimated_minutes: number | null;
};

type StudyPlan = {
  id: string;
  target_exam: string | null;
  weekly_minutes: number;
  weak_topics_jsonb: unknown;
  created_at: string;
  items: Array<{ id: string; dayIndex: number; title: string; minutes: number; status: string }>;
};

type Attempt = {
  id: string;
  title: string;
  score_percent: string | number | null;
  duration_minutes: number | null;
  weak_topics_jsonb: unknown;
  module_title: string | null;
  created_at: string;
};

type Overview = {
  plans: StudyPlan[];
  attempts: Attempt[];
  modules: LearningModule[];
};

function topicList(value: unknown): string {
  if (!Array.isArray(value)) return "—";
  const values = value.map((x) => String(x)).filter(Boolean);
  return values.length ? values.join(", ") : "—";
}

function topicsFrom(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x).trim()).filter(Boolean);
}

function percentLabel(value: number): string {
  return `${Math.round(value)}%`;
}

export default function StudentCalismaPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [itemBusy, setItemBusy] = useState<string | null>(null);
  const [targetExam, setTargetExam] = useState("LGS");
  const [weeklyMinutes, setWeeklyMinutes] = useState(300);
  const [weakTopics, setWeakTopics] = useState("Problem, Paragraf");
  const [attemptTitle, setAttemptTitle] = useState("Konu tarama testi");
  const [score, setScore] = useState(70);
  const [attemptWeakTopics, setAttemptWeakTopics] = useState("Problem");

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [router, pathname]);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    const r = await apiFetch<Overview>("/v1/learning/overview", { token });
    setData(r);
  }, [token]);

  useEffect(() => {
    load().catch((e) => {
      const msg = e instanceof Error ? e.message : "learning_load_failed";
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
        return;
      }
      if (msg.includes("[403]")) {
        setError("Bu sayfa öğrenci hesabı içindir.");
        return;
      }
      setError(msg);
    });
  }, [load, router, pathname]);

  async function createPlan() {
    if (!token) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await apiFetch("/v1/learning/study-plan", {
        method: "POST",
        token,
        body: JSON.stringify({
          targetExam: targetExam.trim() || null,
          weeklyMinutes,
          weakTopics: weakTopics.split(",").map((x) => x.trim()).filter(Boolean),
        }),
      });
      setOk("Haftalık çalışma planı oluşturuldu.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "plan_failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveAttempt() {
    if (!token) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await apiFetch("/v1/learning/exam-attempts", {
        method: "POST",
        token,
        body: JSON.stringify({
          title: attemptTitle,
          scorePercent: score,
          durationMinutes: 40,
          weakTopics: attemptWeakTopics.split(",").map((x) => x.trim()).filter(Boolean),
        }),
      });
      setOk("Deneme/test sonucu kaydedildi.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "attempt_failed");
    } finally {
      setBusy(false);
    }
  }

  async function updatePlanItem(itemId: string, status: "todo" | "done" | "skipped") {
    if (!token) return;
    setItemBusy(itemId);
    setError(null);
    setOk(null);
    try {
      await apiFetch(`/v1/learning/study-plan-items/${itemId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "plan_item_failed");
    } finally {
      setItemBusy(null);
    }
  }

  if (!token) return null;

  const latestPlan = data?.plans[0] ?? null;
  const planItems = latestPlan?.items ?? [];
  const doneCount = planItems.filter((item) => item.status === "done").length;
  const skippedCount = planItems.filter((item) => item.status === "skipped").length;
  const progressPercent = planItems.length > 0 ? (doneCount / planItems.length) * 100 : 0;
  const attempts = data?.attempts ?? [];
  const scoredAttempts = attempts
    .map((attempt) => Number(attempt.score_percent))
    .filter((value) => Number.isFinite(value));
  const averageScore =
    scoredAttempts.length > 0
      ? scoredAttempts.reduce((sum, value) => sum + value, 0) / scoredAttempts.length
      : null;
  const weakTopicCounts = new Map<string, number>();
  for (const attempt of attempts) {
    for (const topic of topicsFrom(attempt.weak_topics_jsonb)) {
      weakTopicCounts.set(topic, (weakTopicCounts.get(topic) ?? 0) + 1);
    }
  }
  const focusTopics = [...weakTopicCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([topic]) => topic);
  const nextPlanItem = planItems.find((item) => item.status === "todo") ?? null;
  const coachCard = !latestPlan
    ? {
        title: "İlk çalışma planını oluştur",
        body: "Hedef sınav, haftalık dakika ve zayıf konuları girerek 7 günlük net bir çalışma akışı başlat.",
        href: "#plan-olustur",
        cta: "Plan formuna git",
      }
    : nextPlanItem
      ? {
          title: `Bugünün odağı: Gün ${nextPlanItem.dayIndex}`,
          body: `${nextPlanItem.title} için ${nextPlanItem.minutes} dakika ayır. Tamamladığında plan ilerlemen güncellenir.`,
          href: "#haftalik-plan",
          cta: "Planı aç",
        }
      : {
          title: focusTopics.length ? "Yeni planı yanlış analizine göre yenile" : "Yeni deneme sonucu ekle",
          body: focusTopics.length
            ? `${focusTopics.slice(0, 2).join(", ")} odağıyla yeni haftalık plan oluşturabilirsin.`
            : "Bir deneme/test sonucu girince sistem odak konuları ve yeni plan önerilerini netleştirir.",
          href: focusTopics.length ? "#plan-olustur" : "#deneme-kaydi",
          cta: focusTopics.length ? "Planı yenile" : "Sonuç ekle",
        };

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Çalışma alanı</h1>
            <p className="mt-1 max-w-2xl text-sm text-paper-800/75">
              İçerik modülleri, deneme sonuçları ve kişisel haftalık plan burada birleşir.
            </p>
          </div>
          <Link href="/student/panel" className="text-sm font-medium text-brand-800 underline">
            Özete dön
          </Link>
        </div>

        {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
        {ok ? <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">{ok}</div> : null}

        <section className="mt-6 rounded-2xl border border-brand-200 bg-[linear-gradient(135deg,#ecfeff_0%,#ffffff_56%,#fff7ed_100%)] p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-900/70">Akıllı sonraki adım</div>
              <h2 className="mt-1 text-lg font-semibold text-paper-900">{coachCard.title}</h2>
              <p className="mt-1 max-w-2xl text-sm text-paper-800/70">{coachCard.body}</p>
            </div>
            <a
              href={coachCard.href}
              className="w-fit rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900"
            >
              {coachCard.cta}
            </a>
          </div>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-paper-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-paper-800/55">Haftalık ilerleme</div>
            <div className="mt-2 text-2xl font-semibold text-paper-900">{percentLabel(progressPercent)}</div>
            <div className="mt-1 text-xs text-paper-800/60">
              {doneCount} tamamlandı · {skippedCount} atlandı · {planItems.length} görev
            </div>
          </div>
          <div className="rounded-2xl border border-paper-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-paper-800/55">Deneme ortalaması</div>
            <div className="mt-2 text-2xl font-semibold text-paper-900">
              {averageScore == null ? "—" : percentLabel(averageScore)}
            </div>
            <div className="mt-1 text-xs text-paper-800/60">{scoredAttempts.length} sonuç üzerinden</div>
          </div>
          <div className="rounded-2xl border border-paper-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-paper-800/55">Odak konular</div>
            <div className="mt-2 text-sm font-medium text-paper-900">
              {focusTopics.length ? focusTopics.join(", ") : "Deneme sonucundan sonra oluşur"}
            </div>
            <div className="mt-1 text-xs text-paper-800/60">Yanlış analizi tekrarına göre</div>
          </div>
        </section>

        <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section id="haftalik-plan" className="rounded-2xl border border-paper-200 bg-white p-5">
            <h2 className="text-base font-semibold text-paper-900">Haftalık plan</h2>
            {!latestPlan ? (
              <p className="mt-3 text-sm text-paper-800/65">Henüz plan yok. Sağdaki formdan hedefinize göre plan oluşturun.</p>
            ) : (
              <>
                <div className="mt-3 rounded-xl bg-paper-50 p-3 text-sm">
                  <div className="font-medium text-paper-900">
                    {latestPlan.target_exam ?? "Genel hedef"} · {latestPlan.weekly_minutes} dk/hafta
                  </div>
                  <div className="mt-1 text-xs text-paper-800/55">
                    Zayıf konular: {topicList(latestPlan.weak_topics_jsonb)}
                  </div>
                </div>
                <ol className="mt-4 grid gap-2 sm:grid-cols-2">
                  {latestPlan.items.map((item) => (
                    <li
                      key={item.id}
                      className={`rounded-xl border p-3 text-sm ${
                        item.status === "done"
                          ? "border-brand-200 bg-brand-50/50"
                          : item.status === "skipped"
                            ? "border-amber-200 bg-amber-50/50"
                            : "border-paper-100 bg-paper-50"
                      }`}
                    >
                      <div className="text-xs font-medium text-paper-800/55">
                        Gün {item.dayIndex} · {item.minutes} dk · {item.status}
                      </div>
                      <div className="mt-1 font-medium text-paper-900">{item.title}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={itemBusy === item.id || item.status === "done"}
                          onClick={() => void updatePlanItem(item.id, "done")}
                          className="rounded-lg bg-brand-700 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                        >
                          Tamamlandı
                        </button>
                        <button
                          type="button"
                          disabled={itemBusy === item.id || item.status === "skipped"}
                          onClick={() => void updatePlanItem(item.id, "skipped")}
                          className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-amber-900 disabled:opacity-40"
                        >
                          Atla
                        </button>
                        {item.status !== "todo" ? (
                          <button
                            type="button"
                            disabled={itemBusy === item.id}
                            onClick={() => void updatePlanItem(item.id, "todo")}
                            className="rounded-lg border border-paper-200 bg-white px-2 py-1 text-xs font-medium text-paper-800 disabled:opacity-40"
                          >
                            Geri al
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </section>

          <aside className="space-y-4">
            <section id="plan-olustur" className="rounded-2xl border border-paper-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-paper-900">Plan oluştur</h2>
              <div className="mt-3 space-y-3">
                <label className="block text-xs font-medium text-paper-800">
                  Hedef
                  <input value={targetExam} onChange={(e) => setTargetExam(e.target.value)} className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2 text-sm" />
                </label>
                <label className="block text-xs font-medium text-paper-800">
                  Haftalık dakika
                  <input type="number" min={60} max={3000} value={weeklyMinutes} onChange={(e) => setWeeklyMinutes(Number(e.target.value) || 300)} className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2 text-sm" />
                </label>
                <label className="block text-xs font-medium text-paper-800">
                  Zayıf konular
                  <input value={weakTopics} onChange={(e) => setWeakTopics(e.target.value)} className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2 text-sm" />
                </label>
                <button type="button" disabled={busy} onClick={() => void createPlan()} className="w-full rounded-xl bg-brand-800 py-2 text-sm font-medium text-white disabled:opacity-50">
                  Planı oluştur
                </button>
              </div>
            </section>

            <section id="deneme-kaydi" className="rounded-2xl border border-paper-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-paper-900">Deneme/test kaydı</h2>
              <div className="mt-3 space-y-3">
                <input value={attemptTitle} onChange={(e) => setAttemptTitle(e.target.value)} className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm" />
                <input type="number" min={0} max={100} value={score} onChange={(e) => setScore(Number(e.target.value) || 0)} className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm" />
                <input value={attemptWeakTopics} onChange={(e) => setAttemptWeakTopics(e.target.value)} className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm" />
                <button type="button" disabled={busy} onClick={() => void saveAttempt()} className="w-full rounded-xl border border-paper-300 bg-white py-2 text-sm font-medium text-paper-900 disabled:opacity-50">
                  Sonucu kaydet
                </button>
              </div>
            </section>
          </aside>
        </div>

        <section className="mt-6 rounded-2xl border border-paper-200 bg-white p-5">
          <h2 className="text-base font-semibold text-paper-900">İçerik modülleri</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(data?.modules ?? []).map((m) => (
              <article key={m.id} className="rounded-xl border border-paper-100 bg-paper-50 p-4 text-sm">
                <div className="font-semibold text-paper-900">{m.title}</div>
                <div className="mt-1 text-xs text-paper-800/55">
                  {m.level_code ?? "genel"} · {m.branch_slug ?? "karma"} · {m.estimated_minutes ?? "—"} dk
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-paper-200 bg-white p-5">
          <h2 className="text-base font-semibold text-paper-900">Son deneme ve testler</h2>
          <div className="mt-3 space-y-2">
            {(data?.attempts ?? []).length === 0 ? (
              <p className="text-sm text-paper-800/55">Henüz sonuç kaydı yok.</p>
            ) : (
              data!.attempts.map((a) => (
                <div key={a.id} className="rounded-xl border border-paper-100 bg-paper-50 p-3 text-sm">
                  <div className="font-medium text-paper-900">
                    {a.title} · %{a.score_percent ?? "—"}
                  </div>
                  <div className="mt-1 text-xs text-paper-800/55">
                    Zayıf konular: {topicList(a.weak_topics_jsonb)} · {new Date(a.created_at).toLocaleString("tr-TR")}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
