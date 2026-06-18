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

type CurriculumCatalog = {
  gradeLevel: number;
  label: string;
  branches: Array<{
    branchSlug: string;
    branchName: string;
    units: Array<{ unitSlug: string; unitTitle: string; questionCount: number }>;
  }>;
};

type CurriculumQuestion = {
  id: string;
  gradeLevel: number;
  branchSlug: string;
  branchName: string;
  unitSlug: string;
  unitTitle: string;
  outcomeCode: string;
  outcomeTitle: string;
  prompt: string;
  choices: Array<{ key: "A" | "B" | "C" | "D"; text: string }>;
  difficulty: "easy" | "medium" | "hard";
  sortOrder: number;
  metadata?: {
    skill: string;
    misconception: string;
    bloomLevel: string;
    estimatedSeconds: number;
    practiceHint: string;
  };
};

type CurriculumTest = {
  mode?: "full" | "mini";
  gradeLevel: number;
  branchSlug: string;
  branchName: string;
  unitSlug: string;
  unitTitle: string;
  questionCount: number;
  thresholdCorrect: number;
  questions: CurriculumQuestion[];
};

type TeacherRecommendation = {
  id: string;
  displayName: string;
  ratingAvg: string | number | null;
  ratingCount: number;
  cityName: string | null;
  branchName: string | null;
  minHourlyRateMinor: number | null;
  recommendationScore: number;
  reasons: string[];
};

type RecommendedAction = {
  title: string;
  body: string;
};

type CurriculumAttempt = {
  id: string;
  student_display_name?: string;
  grade_level: number;
  branch_slug: string;
  branch_name: string;
  unit_slug: string;
  unit_title: string;
  question_count: number;
  correct_count: number;
  score_percent: string | number;
  weak_outcomes_jsonb: unknown;
  teacher_support_recommended: boolean;
  teacher_recommendations_jsonb?: unknown;
  mastery_level?: string | null;
  misconceptions_jsonb?: unknown;
  recommended_actions_jsonb?: unknown;
  answered_count?: number | null;
  created_at: string;
};

type CurriculumResult = {
  id: string;
  title: string;
  gradeLevel: number;
  branchSlug: string;
  branchName: string;
  unitSlug: string;
  unitTitle: string;
  correctCount: number;
  questionCount: number;
  scorePercent: number;
  masteryLevel: "kritik" | "destek_gerekli" | "pekistirme" | "guclu";
  masteryLabel: string;
  weakOutcomes: string[];
  misconceptions: string[];
  recommendedActions: RecommendedAction[];
  teacherSupportRecommended: boolean;
  teacherRecommendations: TeacherRecommendation[];
  questionResults: Array<{
    questionId: string;
    outcomeTitle: string;
    selectedChoice: "A" | "B" | "C" | "D" | null;
    correctChoice: "A" | "B" | "C" | "D";
    isCorrect: boolean;
    explanation: string;
    skill: string;
    misconception: string;
    practiceHint: string;
  }>;
  createdAt: string;
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
  curriculumAttempts: CurriculumAttempt[];
};

function planItemStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    todo: "Yapılacak",
    done: "Tamamlandı",
    skipped: "Atlandı",
  };
  return labels[status] ?? "Durum güncellendi";
}

function topicList(value: unknown): string {
  if (!Array.isArray(value)) return "—";
  const values = value.map((x) => String(x)).filter(Boolean);
  return values.length ? values.join(", ") : "—";
}

function topicsFrom(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x).trim()).filter(Boolean);
}

function actionTitlesFrom(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const action = item as { title?: unknown; body?: unknown };
      const title = typeof action.title === "string" ? action.title : "";
      const body = typeof action.body === "string" ? action.body : "";
      return title && body ? `${title}: ${body}` : title || body;
    })
    .filter(Boolean);
}

function percentLabel(value: number): string {
  return `${Math.round(value)}%`;
}

function teacherSearchHref(branchName: string, branchSlug?: string): string {
  const query = branchSlug?.includes("matematik") ? "Matematik" : branchName;
  return `/ogretmenler?verifiedOnly=1&sort=recommended&q=${encodeURIComponent(query)}`;
}

function moneyLabel(minor: number | null): string {
  if (minor == null) return "Ücret bilgisi profilde";
  return `${Math.round(minor / 100)} TL'den başlayan`;
}

function learningRiskLabel(progressPercent: number, averageScore: number | null, focusTopics: string[]): string {
  if (averageScore != null && averageScore < 55) return "Temel tekrar gerekli";
  if (progressPercent < 40 && focusTopics.length > 0) return "Plan aksıyor";
  if (focusTopics.length >= 3) return "Odak konular birikiyor";
  if (progressPercent >= 75 && averageScore != null && averageScore >= 70) return "Ritim güçlü";
  return "Takipte kal";
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
  const [catalog, setCatalog] = useState<CurriculumCatalog[]>([]);
  const [selectedGrade, setSelectedGrade] = useState(5);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [curriculumTest, setCurriculumTest] = useState<CurriculumTest | null>(null);
  const [testAnswers, setTestAnswers] = useState<Record<string, "A" | "B" | "C" | "D">>({});
  const [curriculumResult, setCurriculumResult] = useState<CurriculumResult | null>(null);
  const [curriculumBusy, setCurriculumBusy] = useState(false);
  const [teacherMatch, setTeacherMatch] = useState<TeacherRecommendation[]>([]);
  const [teacherMatchBranch, setTeacherMatchBranch] = useState("matematik");

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
    const [r, c] = await Promise.all([
      apiFetch<Overview>("/v1/learning/overview", { token }),
      apiFetch<{ catalog: CurriculumCatalog[] }>("/v1/learning/curriculum-tests/catalog", { token }),
    ]);
    setData(r);
    setCatalog(c.catalog ?? []);
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

  useEffect(() => {
    if (catalog.length === 0 || selectedBranch) return;
    const grade = catalog.find((item) => item.gradeLevel === selectedGrade) ?? catalog[0];
    const branch = grade?.branches[0];
    const unit = branch?.units[0];
    if (!grade || !branch || !unit) return;
    setSelectedGrade(grade.gradeLevel);
    setSelectedBranch(branch.branchSlug);
    setSelectedUnit(unit.unitSlug);
  }, [catalog, selectedBranch, selectedGrade]);

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

  async function loadCurriculumTest(mode: "full" | "mini" = "full") {
    if (!token || !selectedBranch || !selectedUnit) return;
    setCurriculumBusy(true);
    setError(null);
    setOk(null);
    setCurriculumResult(null);
    try {
      const qs = new URLSearchParams({
        gradeLevel: String(selectedGrade),
        branchSlug: selectedBranch,
        unitSlug: selectedUnit,
        mode,
      });
      const r = await apiFetch<{ test: CurriculumTest }>(`/v1/learning/curriculum-tests?${qs.toString()}`, {
        token,
      });
      setCurriculumTest(r.test);
      setTestAnswers({});
      setOk(mode === "mini" ? "10 soruluk mini deneme hazırlandı." : "20 soruluk kazanım testi hazırlandı.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "curriculum_test_load_failed");
    } finally {
      setCurriculumBusy(false);
    }
  }

  async function submitCurriculumTest() {
    if (!token || !curriculumTest) return;
    const missingCount = curriculumTest.questions.filter((question) => !testAnswers[question.id]).length;
    if (missingCount > 0) {
      setError(`Sonucu göndermeden önce ${missingCount} cevapsız soruyu tamamlayın.`);
      setOk(null);
      return;
    }
    setCurriculumBusy(true);
    setError(null);
    setOk(null);
    try {
      const r = await apiFetch<{ attempt: CurriculumResult }>("/v1/learning/curriculum-test-attempts", {
        method: "POST",
        token,
        body: JSON.stringify({
          gradeLevel: curriculumTest.gradeLevel,
          branchSlug: curriculumTest.branchSlug,
          unitSlug: curriculumTest.unitSlug,
          mode: curriculumTest.mode ?? "full",
          answers: testAnswers,
        }),
      });
      setCurriculumResult(r.attempt);
      setOk(
        r.attempt.teacherSupportRecommended
          ? "Sonuç kaydedildi. 15 doğru altında olduğu için branş öğretmeni önerileri hazırlandı ve veliye bildirim gitti."
          : "Sonuç kaydedildi ve veliye bildirim gönderildi.",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "curriculum_test_submit_failed");
    } finally {
      setCurriculumBusy(false);
    }
  }

  useEffect(() => {
    if (!token || !data) return;
    const attempts = data.attempts ?? [];
    const weakTopicCounts = new Map<string, number>();
    for (const attempt of attempts) {
      for (const topic of topicsFrom(attempt.weak_topics_jsonb)) {
        weakTopicCounts.set(topic, (weakTopicCounts.get(topic) ?? 0) + 1);
      }
    }
    const focus = [...weakTopicCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([topic]) => topic);
    const curriculumAttempts = data.curriculumAttempts ?? [];
    const branch =
      curriculumAttempts[0]?.branch_slug ??
      (focus.some((t) => /paragraf|türkçe|turkce/i.test(t)) ? "turkce" : "matematik");
    setTeacherMatchBranch(branch);
    const weak = [...focus, ...topicsFrom(curriculumAttempts[0]?.weak_outcomes_jsonb)]
      .filter(Boolean)
      .slice(0, 8)
      .join(",");
    const qs = new URLSearchParams({ branchSlug: branch });
    if (weak) qs.set("weakOutcomes", weak);
    apiFetch<{ recommendations: TeacherRecommendation[] }>(`/v1/learning/teacher-match?${qs}`, { token })
      .then((r) => setTeacherMatch(r.recommendations ?? []))
      .catch(() => setTeacherMatch([]));
  }, [token, data]);

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
        body: "Hedef sınav, haftalık dakika ve zayıf konuları girerek 7 günlük net bir çalışma planı başlat.",
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
  const learningRisk = learningRiskLabel(progressPercent, averageScore, focusTopics);
  const selectedGradeData = catalog.find((item) => item.gradeLevel === selectedGrade) ?? catalog[0] ?? null;
  const selectedBranchData = selectedGradeData?.branches.find((item) => item.branchSlug === selectedBranch) ?? selectedGradeData?.branches[0] ?? null;
  const selectedUnitData = selectedBranchData?.units.find((item) => item.unitSlug === selectedUnit) ?? selectedBranchData?.units[0] ?? null;
  const latestCurriculumAttempts = data?.curriculumAttempts ?? [];
  const answeredCount = curriculumTest?.questions.filter((question) => testAnswers[question.id]).length ?? 0;
  const unansweredCount = (curriculumTest?.questionCount ?? 0) - answeredCount;
  const estimatedMinutes = curriculumTest
    ? Math.max(12, Math.round(curriculumTest.questions.reduce((sum, question) => sum + (question.metadata?.estimatedSeconds ?? 60), 0) / 60))
    : 0;

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
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-900/70">Sonraki adım</div>
              <h2 className="mt-1 text-lg font-semibold text-paper-900">{coachCard.title}</h2>
              <p className="mt-1 max-w-2xl text-sm text-paper-800/70">
                {coachCard.body} Ders, deneme ve haftalık plan aynı sırada takip edilir.
              </p>
            </div>
            <a
              href={coachCard.href}
              className="w-fit rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900"
            >
              {coachCard.cta}
            </a>
          </div>
        </section>

        {teacherMatch.length > 0 ? (
          <section className="mt-6 rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-paper-900">AI öğretmen eşleşmesi</h2>
                <p className="mt-1 text-sm text-paper-800/70">
                  Zayıf kazanımlarınıza göre {teacherMatchBranch} branşında önerilen öğretmenler.
                </p>
              </div>
              <Link
                href={teacherSearchHref(teacherMatchBranch, teacherMatchBranch)}
                className="text-sm font-medium text-brand-800 underline"
              >
                Tümünü gör
              </Link>
            </div>
            <ul className="mt-4 grid gap-3 sm:grid-cols-3">
              {teacherMatch.map((teacher) => (
                <li key={teacher.id} className="rounded-xl border border-paper-200 bg-paper-50 p-4">
                  <div className="font-semibold text-paper-900">{teacher.displayName}</div>
                  <div className="mt-1 text-xs text-paper-800/60">
                    {teacher.branchName ?? teacherMatchBranch}
                    {teacher.cityName ? ` · ${teacher.cityName}` : ""}
                  </div>
                  <div className="mt-1 text-xs text-paper-800/60">{moneyLabel(teacher.minHourlyRateMinor)}</div>
                  <ul className="mt-2 space-y-0.5 text-xs text-paper-800/70">
                    {teacher.reasons.slice(0, 2).map((reason) => (
                      <li key={reason}>• {reason}</li>
                    ))}
                  </ul>
                  <Link
                    href={`/ogretmenler/${teacher.id}`}
                    className="mt-3 inline-flex rounded-lg bg-brand-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-900"
                  >
                    Profili aç
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

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

        <section className="mt-6 rounded-2xl border border-paper-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-paper-800/55">
                Öğrenme raporu
              </div>
              <h2 className="mt-1 text-base font-semibold text-paper-900">{learningRisk}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-paper-800/70">
                Plan ilerlemesi, deneme sonuçları ve zayıf konular birlikte okunur; amaç her hafta tek bir net aksiyona dönmektir.
              </p>
            </div>
            <Link
              href="/guardian"
              className="w-fit rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-900 hover:bg-brand-100"
            >
              Veli görünümü
            </Link>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {[
              ["Bugünün işi", nextPlanItem ? `${nextPlanItem.title} · ${nextPlanItem.minutes} dk` : "Yeni plan veya deneme sonucu ekle"],
              ["Tekrar odağı", focusTopics.length ? focusTopics.slice(0, 2).join(", ") : "Yanlış analizi bekleniyor"],
              ["Hafta hedefi", latestPlan ? `${latestPlan.weekly_minutes} dk planı %${Math.round(progressPercent)} tamamlandı` : "İlk planı oluştur"],
            ].map(([title, body]) => (
              <div key={title} className="rounded-xl border border-paper-200 bg-paper-50 p-3">
                <div className="text-xs font-semibold text-paper-900">{title}</div>
                <p className="mt-1 text-xs leading-relaxed text-paper-800/65">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-800/70">
                Kazanım testleri
              </div>
              <h2 className="mt-1 text-base font-semibold text-paper-900">20 soruluk ünite kontrolü</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-paper-800/70">
                Sınıf, branş ve ünite seç; sonuç veliye gider. 15 doğru altında ilgili branştan öğretmen önerisi hemen açılır.
              </p>
            </div>
            <div className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-900">
              Eşik: 15/20
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <label className="block text-xs font-medium text-paper-800">
              Sınıf
              <select
                value={selectedGrade}
                onChange={(e) => {
                  const gradeLevel = Number(e.target.value);
                  const grade = catalog.find((item) => item.gradeLevel === gradeLevel) ?? null;
                  const branch = grade?.branches[0] ?? null;
                  const unit = branch?.units[0] ?? null;
                  setSelectedGrade(gradeLevel);
                  setSelectedBranch(branch?.branchSlug ?? "");
                  setSelectedUnit(unit?.unitSlug ?? "");
                  setCurriculumTest(null);
                  setCurriculumResult(null);
                  setTestAnswers({});
                }}
                className="mt-1 w-full rounded-xl border border-paper-200 bg-white px-3 py-2 text-sm"
              >
                {catalog.map((grade) => (
                  <option key={grade.gradeLevel} value={grade.gradeLevel}>
                    {grade.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-paper-800">
              Branş
              <select
                value={selectedBranchData?.branchSlug ?? ""}
                onChange={(e) => {
                  const branch = selectedGradeData?.branches.find((item) => item.branchSlug === e.target.value) ?? null;
                  const unit = branch?.units[0] ?? null;
                  setSelectedBranch(branch?.branchSlug ?? "");
                  setSelectedUnit(unit?.unitSlug ?? "");
                  setCurriculumTest(null);
                  setCurriculumResult(null);
                  setTestAnswers({});
                }}
                className="mt-1 w-full rounded-xl border border-paper-200 bg-white px-3 py-2 text-sm"
              >
                {(selectedGradeData?.branches ?? []).map((branch) => (
                  <option key={branch.branchSlug} value={branch.branchSlug}>
                    {branch.branchName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-paper-800">
              Ünite
              <select
                value={selectedUnitData?.unitSlug ?? ""}
                onChange={(e) => {
                  setSelectedUnit(e.target.value);
                  setCurriculumTest(null);
                  setCurriculumResult(null);
                  setTestAnswers({});
                }}
                className="mt-1 w-full rounded-xl border border-paper-200 bg-white px-3 py-2 text-sm"
              >
                {(selectedBranchData?.units ?? []).map((unit) => (
                  <option key={unit.unitSlug} value={unit.unitSlug}>
                    {unit.unitTitle}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={curriculumBusy || !selectedBranchData || !selectedUnitData}
              onClick={() => void loadCurriculumTest("mini")}
              className="rounded-xl border border-brand-300 bg-white px-4 py-2 text-sm font-semibold text-brand-900 disabled:opacity-50"
            >
              {curriculumBusy && !curriculumTest ? "Hazırlanıyor…" : "Mini deneme (10 soru)"}
            </button>
            <button
              type="button"
              disabled={curriculumBusy || !selectedBranchData || !selectedUnitData}
              onClick={() => void loadCurriculumTest("full")}
              className="rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {curriculumBusy && !curriculumTest ? "Hazırlanıyor…" : "Tam test (20 soru)"}
            </button>
            <div className="text-xs text-paper-800/60">
              {selectedBranchData && selectedUnitData
                ? `${selectedGrade}. sınıf · ${selectedBranchData.branchName} · ${selectedUnitData.unitTitle} · mini eşik 7/10 · tam eşik 15/20`
                : "Katalog yükleniyor"}
            </div>
          </div>

          {curriculumTest ? (
            <div className="mt-5 rounded-2xl border border-paper-200 bg-paper-50 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-paper-900">
                    {curriculumTest.branchName} · {curriculumTest.unitTitle}
                  </h3>
                  <p className="mt-1 text-xs text-paper-800/60">
                    {answeredCount}/{curriculumTest.questionCount} soru cevaplandı · tahmini {estimatedMinutes} dk · eşik {curriculumTest.thresholdCorrect}/{curriculumTest.questionCount}.
                  </p>
                  {unansweredCount > 0 ? (
                    <p className="mt-1 text-xs font-medium text-amber-800">
                      {unansweredCount} soru cevapsız. Sonuç kaydı için tüm soruları tamamlayın.
                    </p>
                  ) : (
                    <p className="mt-1 text-xs font-medium text-brand-800">Tüm sorular cevaplandı; sonucu güvenle gönderebilirsiniz.</p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={curriculumBusy || unansweredCount > 0}
                  onClick={() => void submitCurriculumTest()}
                  className="rounded-xl border border-brand-300 bg-white px-4 py-2 text-sm font-semibold text-brand-900 disabled:opacity-50"
                >
                  {curriculumBusy ? "Kaydediliyor…" : "Sonucu gönder"}
                </button>
              </div>
              <ol className="mt-4 space-y-3">
                {curriculumTest.questions.map((question, index) => (
                  <li key={question.id} className="rounded-xl border border-paper-200 bg-white p-3">
                    <div className="text-xs font-semibold text-paper-800/55">
                      Soru {index + 1} · {question.outcomeTitle}
                    </div>
                    <p className="mt-2 text-sm font-medium text-paper-900">{question.prompt}</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {question.choices.map((choice) => (
                        <button
                          key={choice.key}
                          type="button"
                          onClick={() =>
                            setTestAnswers((prev) => ({
                              ...prev,
                              [question.id]: choice.key,
                            }))
                          }
                          className={`rounded-lg border px-3 py-2 text-left text-xs ${
                            testAnswers[question.id] === choice.key
                              ? "border-brand-400 bg-brand-50 text-brand-950"
                              : "border-paper-200 bg-paper-50 text-paper-800 hover:border-brand-200"
                          }`}
                        >
                          <span className="font-semibold">{choice.key}) </span>
                          {choice.text}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {curriculumResult ? (
            <div className="mt-5 rounded-2xl border border-brand-200 bg-brand-50/60 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-brand-900/70">
                    Sonuç
                  </div>
                  <h3 className="mt-1 text-lg font-semibold text-paper-900">
                    {curriculumResult.correctCount}/{curriculumResult.questionCount} doğru · {percentLabel(curriculumResult.scorePercent)}
                  </h3>
                  <div className="mt-2 inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-900">
                    {curriculumResult.masteryLabel}
                  </div>
                  <p className="mt-1 text-sm text-paper-800/70">
                    {curriculumResult.teacherSupportRecommended
                      ? "15 doğru altında olduğu için veliye risk bildirimi gitti ve branş öğretmeni önerileri hazırlandı."
                      : "15 doğru ve üstü: ünite için pekiştirme ve sonraki kazanıma geçiş önerilir."}
                  </p>
                </div>
                <Link
                  href={teacherSearchHref(curriculumResult.branchName, curriculumResult.branchSlug)}
                  className="w-fit rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900"
                >
                  Branş öğretmenlerini gör
                </Link>
              </div>
              <div className="mt-3 text-xs text-paper-800/65">
                Zayıf kazanımlar: {curriculumResult.weakOutcomes.join(", ") || "Belirgin zayıf kazanım yok"}
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {curriculumResult.recommendedActions.map((action, index) => (
                  <div key={`${action.title}-${index}`} className="rounded-xl border border-brand-100 bg-white p-3">
                    <div className="text-xs font-semibold text-brand-900">
                      {index + 1}. {action.title}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-paper-800/65">{action.body}</p>
                  </div>
                ))}
              </div>
              {curriculumResult.misconceptions.length > 0 ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <div className="text-xs font-semibold text-amber-950">Yanılgı analizi</div>
                  <p className="mt-1 text-xs leading-relaxed text-amber-900">
                    {curriculumResult.misconceptions.slice(0, 3).join(" · ")}
                  </p>
                </div>
              ) : null}
              <div className="mt-4 rounded-xl border border-paper-200 bg-white p-3">
                <div className="text-xs font-semibold text-paper-900">Yanlışlardan öğren</div>
                <div className="mt-2 space-y-2">
                  {curriculumResult.questionResults.filter((result) => !result.isCorrect).slice(0, 4).map((result) => (
                    <div key={result.questionId} className="rounded-lg bg-paper-50 p-2 text-xs text-paper-800/70">
                      <div className="font-semibold text-paper-900">{result.outcomeTitle}</div>
                      <div className="mt-1">
                        Senin cevabın: {result.selectedChoice ?? "—"} · Doğru cevap: {result.correctChoice}
                      </div>
                      <div className="mt-1">{result.explanation}</div>
                    </div>
                  ))}
                  {curriculumResult.questionResults.every((result) => result.isCorrect) ? (
                    <p className="text-xs text-paper-800/60">Yanlış yok; süreli pekiştirme testiyle devam edebilirsiniz.</p>
                  ) : null}
                </div>
              </div>
              {curriculumResult.teacherSupportRecommended ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {curriculumResult.teacherRecommendations.length === 0 ? (
                    <Link
                      href={teacherSearchHref(curriculumResult.branchName, curriculumResult.branchSlug)}
                      className="rounded-xl border border-brand-200 bg-white p-3 text-sm font-semibold text-brand-900 hover:bg-brand-50"
                    >
                      Bu branşta doğrulanmış öğretmenleri listele
                    </Link>
                  ) : (
                    curriculumResult.teacherRecommendations.map((teacher) => (
                      <Link
                        key={teacher.id}
                        href={`/ogretmenler/${teacher.id}`}
                        className="rounded-xl border border-brand-200 bg-white p-3 hover:bg-brand-50"
                      >
                        <div className="text-sm font-semibold text-paper-950">{teacher.displayName}</div>
                        <div className="mt-1 text-xs text-paper-800/60">
                          {teacher.branchName ?? curriculumResult.branchName} · {teacher.cityName ?? "Online"}
                        </div>
                        <div className="mt-1 text-xs text-brand-900">
                          {teacher.ratingAvg ? `${teacher.ratingAvg}/5 · ` : ""}
                          {moneyLabel(teacher.minHourlyRateMinor)}
                        </div>
                        <div className="mt-2 text-[11px] leading-relaxed text-paper-800/55">
                          {teacher.reasons.slice(0, 3).join(" · ")}
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
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
                        Gün {item.dayIndex} · {item.minutes} dk · {planItemStatusLabel(item.status)}
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
          <h2 className="text-base font-semibold text-paper-900">Son kazanım testleri</h2>
          <div className="mt-3 space-y-2">
            {latestCurriculumAttempts.length === 0 ? (
              <p className="text-sm text-paper-800/55">Henüz kazanım testi çözülmedi.</p>
            ) : (
              latestCurriculumAttempts.slice(0, 5).map((attempt) => (
                <div key={attempt.id} className="rounded-xl border border-paper-100 bg-paper-50 p-3 text-sm">
                  <div className="font-medium text-paper-900">
                    {attempt.grade_level}. sınıf {attempt.branch_name} · {attempt.unit_title} · {attempt.correct_count}/{attempt.question_count}
                  </div>
                  <div className="mt-1 text-xs text-paper-800/55">
                    {attempt.mastery_level ? `${attempt.mastery_level} · ` : ""}
                    {attempt.teacher_support_recommended
                      ? "15 doğru altında: öğretmen desteği önerildi."
                      : "15 doğru ve üstü: pekiştirme önerildi."}{" "}
                    · {new Date(attempt.created_at).toLocaleString("tr-TR")}
                  </div>
                  {actionTitlesFrom(attempt.recommended_actions_jsonb)[0] ? (
                    <div className="mt-1 text-xs text-paper-800/55">
                      İlk aksiyon: {actionTitlesFrom(attempt.recommended_actions_jsonb)[0]}
                    </div>
                  ) : null}
                </div>
              ))
            )}
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
