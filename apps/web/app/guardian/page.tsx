"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../lib/api";
import { clearToken, getToken } from "../lib/auth";
import { loginHrefWithReturn } from "../lib/authRedirect";

type StudentRow = { student_id: string; student_display_name: string };

type ProgressRow = {
  snapshot_id: string;
  student_id: string;
  student_display_name: string;
  narrative_tr: string;
  metrics_jsonb?: unknown;
  created_at: string;
  teacher_display_name: string;
};

type MasteryRow = {
  student_id: string;
  student_display_name: string;
  topic_label: string;
  mastery_estimate: string | number | null;
  evidence_count: number;
  last_seen_at: string;
};

type StudyPlanRow = {
  id: string;
  student_id: string;
  student_display_name: string;
  target_exam: string | null;
  weekly_minutes: number;
  weak_topics_jsonb: unknown;
  items: Array<{ dayIndex: number; title: string; minutes: number; status: string }>;
  created_at: string;
};

type AttemptRow = {
  id: string;
  student_id: string;
  student_display_name: string;
  title: string;
  score_percent: string | number | null;
  weak_topics_jsonb: unknown;
  created_at: string;
};

type CurriculumAttemptRow = {
  id: string;
  student_id: string;
  student_display_name: string;
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

type NotifRow = {
  id: string;
  title: string;
  body: string;
  delivery_status: string;
  read_at: string | null;
  created_at: string;
  payload_jsonb?: unknown;
};

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

function teacherRecommendationsFrom(value: unknown): Array<{
  id: string;
  displayName: string;
  branchName?: string | null;
  minHourlyRateMinor?: number | null;
}> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const id = typeof row.id === "string" ? row.id : "";
      const displayName = typeof row.displayName === "string" ? row.displayName : "";
      if (!id || !displayName) return null;
      return {
        id,
        displayName,
        branchName: typeof row.branchName === "string" ? row.branchName : null,
        minHourlyRateMinor:
          typeof row.minHourlyRateMinor === "number" ? row.minHourlyRateMinor : null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

function teacherSearchHref(branchName: string, branchSlug?: string): string {
  const query = branchSlug?.includes("matematik") ? "Matematik" : branchName;
  return `/ogretmenler?verifiedOnly=1&sort=recommended&q=${encodeURIComponent(query)}`;
}

function planProgress(plan: StudyPlanRow): { done: number; skipped: number; total: number; percent: number } {
  const total = plan.items.length;
  const done = plan.items.filter((item) => item.status === "done").length;
  const skipped = plan.items.filter((item) => item.status === "skipped").length;
  return { done, skipped, total, percent: total > 0 ? (done / total) * 100 : 0 };
}

function guardianRiskLabel(args: {
  students: number;
  unread: number;
  averageScore: number | null;
  averageMastery: number | null;
  focusTopics: string[];
}): string {
  if (args.students === 0) return "Öğrenci bağlantısı bekleniyor";
  if (args.unread > 0) return "Okunmamış gelişme var";
  if (args.averageMastery != null && args.averageMastery < 0.55) return "Konu tekrarı gerekli";
  if (args.averageScore != null && args.averageScore < 60) return "Deneme sonucu riskli";
  if (args.focusTopics.length > 0) return "Odak konuları takip edin";
  return "Takip düzeni sağlıklı";
}

export default function GuardianPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [masteryGraph, setMasteryGraph] = useState<MasteryRow[]>([]);
  const [studyPlans, setStudyPlans] = useState<StudyPlanRow[]>([]);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [curriculumAttempts, setCurriculumAttempts] = useState<CurriculumAttemptRow[]>([]);
  const [notifications, setNotifications] = useState<NotifRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [readBusy, setReadBusy] = useState<string | null>(null);
  const [emailPrefs, setEmailPrefs] = useState({
    homeworkEnabled: true,
    lessonEnabled: true,
    paymentEnabled: true,
  });
  const [emailPrefsBusy, setEmailPrefsBusy] = useState(false);
  const [creditStudentId, setCreditStudentId] = useState("");
  const [monthlyCredits, setMonthlyCredits] = useState(4);
  const [perLessonTl, setPerLessonTl] = useState("150");
  const [creditPools, setCreditPools] = useState<
    Array<{
      id: string;
      student_display_name: string;
      credits_remaining: number;
      monthly_lesson_credits: number;
      per_lesson_budget_minor: number;
      period_month: string;
    }>
  >([]);
  const [weeklyReports, setWeeklyReports] = useState<
    Array<{ id: string; report_title: string; report_preview: string; week_start: string }>
  >([]);
  const [creditBusy, setCreditBusy] = useState(false);
  const [weekStart] = useState(() => Date.now() - 1000 * 60 * 60 * 24 * 7);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [router, pathname]);

  useEffect(() => {
    setShowOnboarding(new URLSearchParams(window.location.search).get("onboarding") === "1");
  }, []);

  useEffect(() => {
    if (!token) return;
    (async () => {
      setError(null);
      try {
        const [r, n, prefs, credits, reports] = await Promise.all([
          apiFetch<{
            students: StudentRow[];
            progress: ProgressRow[];
            masteryGraph: MasteryRow[];
            studyPlans: StudyPlanRow[];
            attempts: AttemptRow[];
            curriculumAttempts: CurriculumAttemptRow[];
          }>(
            "/v1/guardians/overview",
            { token },
          ),
          apiFetch<{ notifications: NotifRow[] }>("/v1/notifications?limit=30", {
            token,
          }),
          apiFetch<{ preferences: { homeworkEnabled: boolean; lessonEnabled: boolean; paymentEnabled: boolean } }>(
            "/v1/guardians/email-preferences",
            { token },
          ).catch(() => ({
            preferences: { homeworkEnabled: true, lessonEnabled: true, paymentEnabled: true },
          })),
          apiFetch<{ pools: typeof creditPools }>("/v1/guardians/lesson-credits", { token }).catch(() => ({ pools: [] })),
          apiFetch<{ reports: typeof weeklyReports }>("/v1/guardians/weekly-reports", { token }).catch(() => ({ reports: [] })),
        ]);
        setStudents(r.students);
        setProgress(r.progress);
        setMasteryGraph(r.masteryGraph ?? []);
        setStudyPlans(r.studyPlans ?? []);
        setAttempts(r.attempts ?? []);
        setCurriculumAttempts(r.curriculumAttempts ?? []);
        setNotifications(n.notifications);
        setEmailPrefs(prefs.preferences);
        setCreditPools(credits.pools ?? []);
        setWeeklyReports(reports.reports ?? []);
        if (r.students[0]?.student_id) {
          setCreditStudentId((prev) => prev ?? r.students[0].student_id);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "load_failed";
        setError(msg);
        if (msg.includes("[401]")) {
          clearToken();
          router.replace(loginHrefWithReturn(pathname));
        }
        if (msg.includes("[403]")) {
          setError("Bu sayfa yalnızca veli hesabı içindir.");
        }
      }
    })();
  }, [token, router, pathname]);

  async function allocateCredits() {
    if (!token || !creditStudentId) return;
    const perLessonBudgetMinor = Math.round(Number(perLessonTl.replace(",", ".")) * 100);
    if (!Number.isFinite(perLessonBudgetMinor) || perLessonBudgetMinor < 5000) {
      setError("Ders başı bütçe en az 50 TL olmalı.");
      return;
    }
    setCreditBusy(true);
    setError(null);
    setOk(null);
    try {
      await apiFetch("/v1/guardians/lesson-credits", {
        method: "POST",
        token,
        body: JSON.stringify({
          studentId: creditStudentId,
          monthlyCredits,
          perLessonBudgetMinor,
        }),
      });
      setOk("Güvenli havuz kredileri tanımlandı. Ders tamamlanınca öğretmene aktarılır.");
      const credits = await apiFetch<{ pools: typeof creditPools }>("/v1/guardians/lesson-credits", { token });
      setCreditPools(credits.pools ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "credit_allocate_failed");
    } finally {
      setCreditBusy(false);
    }
  }

  async function acceptInvite() {
    if (!token) return;
    const code = inviteCode.trim();
    if (code.length < 6) {
      setError("Davet kodunu girin.");
      return;
    }
    setInviteBusy(true);
    setError(null);
    setOk(null);
    try {
      await apiFetch("/v1/guardians/accept-invite", {
        method: "POST",
        token,
        body: JSON.stringify({ code }),
      });
      setInviteCode("");
      setOk("Öğrenci hesabı bağlandı.");
      const [r, n] = await Promise.all([
        apiFetch<{
          students: StudentRow[];
          progress: ProgressRow[];
          masteryGraph: MasteryRow[];
          studyPlans: StudyPlanRow[];
          attempts: AttemptRow[];
          curriculumAttempts: CurriculumAttemptRow[];
        }>("/v1/guardians/overview", { token }),
        apiFetch<{ notifications: NotifRow[] }>("/v1/notifications?limit=30", { token }),
      ]);
      setStudents(r.students);
      setProgress(r.progress);
      setMasteryGraph(r.masteryGraph ?? []);
      setStudyPlans(r.studyPlans ?? []);
      setAttempts(r.attempts ?? []);
      setCurriculumAttempts(r.curriculumAttempts ?? []);
      setNotifications(n.notifications);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "invite_accept_failed";
      if (msg.includes("expired")) setError("Davet kodunun süresi dolmuş.");
      else if (msg.includes("already_used")) setError("Bu davet kodu daha önce kullanılmış.");
      else if (msg.includes("not_found")) setError("Davet kodu bulunamadı.");
      else setError(msg);
    } finally {
      setInviteBusy(false);
    }
  }

  async function markRead(id: string) {
    if (!token) return;
    setReadBusy(id);
    try {
      await apiFetch(`/v1/notifications/${id}/read`, {
        method: "PATCH",
        token,
      });
      setNotifications((prev) =>
        prev.map((x) =>
          x.id === id
            ? { ...x, read_at: new Date().toISOString(), delivery_status: "read" }
            : x,
        ),
      );
    } catch {
      /* yoksay — tekrar dene */
    } finally {
      setReadBusy(null);
    }
  }

  if (!token) return null;

  const scoredAttempts = attempts
    .map((attempt) => Number(attempt.score_percent))
    .filter((value) => Number.isFinite(value));
  const averageScore =
    scoredAttempts.length > 0
      ? scoredAttempts.reduce((sum, value) => sum + value, 0) / scoredAttempts.length
      : null;
  const activePlanCount = studyPlans.length;
  const lowMasteryTopics = masteryGraph
    .map((row) => ({
      ...row,
      mastery: Number(row.mastery_estimate),
    }))
    .filter((row) => Number.isFinite(row.mastery))
    .slice(0, 6);
  const averageMastery =
    lowMasteryTopics.length > 0
      ? lowMasteryTopics.reduce((sum, row) => sum + row.mastery, 0) / lowMasteryTopics.length
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
  const unreadNotifications = notifications.filter((n) => !n.read_at).length;
  const weeklyProgress = progress.filter((row) => new Date(row.created_at).getTime() >= weekStart);
  const weeklyNotifications = notifications.filter((row) => new Date(row.created_at).getTime() >= weekStart);
  const weeklyLessonSignals = weeklyNotifications.filter((row) =>
    /ders|lesson|classroom/i.test(`${row.title} ${row.body}`),
  ).length;
  const weeklyHomeworkSignals = weeklyNotifications.filter((row) =>
    /ödev|soru|homework/i.test(`${row.title} ${row.body}`),
  ).length;
  const weeklyCurriculumAttempts = curriculumAttempts.filter((row) => new Date(row.created_at).getTime() >= weekStart);
  const lowCurriculumAttempts = curriculumAttempts.filter((row) => row.teacher_support_recommended);
  const latestCurriculumAttempt = curriculumAttempts[0] ?? null;
  const curriculumWeakCounts = new Map<string, number>();
  for (const attempt of curriculumAttempts) {
    for (const topic of topicsFrom(attempt.weak_outcomes_jsonb)) {
      curriculumWeakCounts.set(topic, (curriculumWeakCounts.get(topic) ?? 0) + 1);
    }
  }
  const topCurriculumWeakTopics = [...curriculumWeakCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([topic]) => topic);
  const latestTeacherNote = weeklyProgress[0] ?? progress[0] ?? null;
  const familyRisk = guardianRiskLabel({
    students: students.length,
    unread: unreadNotifications,
    averageScore,
    averageMastery,
    focusTopics,
  });
  const nextBestAction =
    students.length === 0
      ? {
          title: "Öğrenci hesabını bağlayın",
          body: "Öğrenci panelinden veli davet kodu alın; bağlandıktan sonra ders, plan ve bildirim özetleri burada görünür.",
          href: "#ogrenci-baglama",
          cta: "Bağlama rehberi",
        }
      : lowCurriculumAttempts.length > 0
        ? {
            title: "Düşük kazanım testini birlikte kapatın",
            body: `${lowCurriculumAttempts[0].branch_name} / ${lowCurriculumAttempts[0].unit_title} sonucunda öğretmen desteği önerildi. Önce yanlış kazanımı konuşun, sonra branş öğretmeni seçeneklerine bakın.`,
            href: "#kazanim-takibi",
            cta: "Test aksiyonuna git",
          }
      : notifications.some((n) => !n.read_at)
        ? {
            title: "Okunmamış bildirimleri kontrol edin",
            body: "Ödev, ders ve çalışma güncellemelerini okuyup aile takibini güncel tutun.",
            href: "#bildirimler",
            cta: "Bildirimlere git",
          }
        : {
            title: "Çalışma planı ve odak konuları izleyin",
            body: "Deneme yanlışlarından çıkan odak konuları ve haftalık plan ilerlemesini düzenli kontrol edin.",
            href: "#calisma-takibi",
            cta: "Takibe git",
          };

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Veli paneli</h1>
          <p className="mt-1 text-sm text-paper-800/65">Öğrenci hesabı veli olarak bağlar.</p>
          <p className="mt-2 text-sm">
            <Link
              href="/"
              className="text-paper-800/75 underline decoration-paper-300 underline-offset-4 hover:text-paper-900"
            >
              Ana sayfa
            </Link>
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
        {ok && (
          <div className="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
            {ok}
          </div>
        )}

        <section className="mt-6 rounded-2xl border border-brand-200 bg-[linear-gradient(135deg,#ecfeff_0%,#ffffff_58%,#fff7ed_100%)] p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-800/70">
                {showOnboarding ? "Veli onboarding" : "Sonraki en iyi işlem"}
              </div>
              <h2 className="mt-2 text-lg font-semibold text-paper-900">{nextBestAction.title}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-paper-800/70">{nextBestAction.body}</p>
            </div>
            <Link
              href={nextBestAction.href}
              className="shrink-0 rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-900"
            >
              {nextBestAction.cta}
            </Link>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-800/70">
                Ders ilanı ve teklifler
              </div>
              <h2 className="mt-1 text-lg font-semibold text-paper-900">
                Öğrenciniz adına ilan açın, gelen teklifleri karşılaştırın
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-paper-800/65">
                Branş, konu ve uygun zamanı yazın. İlan ilgili öğretmenlere bildirilir; teklif geldiğinde öğretmen profili,
                ücret ve mesajı aynı ekranda değerlendirebilirsiniz.
              </p>
            </div>
            <Link
              href="/guardian/requests"
              className="shrink-0 rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-900"
            >
              İlan ve teklifleri aç
            </Link>
          </div>
          {students.length === 0 ? (
            <p className="mt-3 rounded-xl border border-paper-200 bg-paper-50 px-3 py-2 text-xs text-paper-800/65">
              İlan oluşturmak için önce öğrenci hesabını veli hesabınıza bağlayın.
            </p>
          ) : null}
        </section>

        <section id="kazanim-takibi" className="mt-6 rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-800/70">
                Haftalık veli raporu
              </div>
              <h2 className="mt-1 text-lg font-semibold text-paper-900">Katılım, soru ve risk özeti</h2>
              <p className="mt-1 text-sm leading-relaxed text-paper-800/65">
                Son 7 günde oluşan ders, soru ve öğretmen notu kayıtları.
              </p>
            </div>
            <div className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-900">
              {familyRisk}
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {[
              ["Katılım kaydı", weeklyNotifications.length],
              ["Çözülen/iletilen soru", weeklyHomeworkSignals],
              ["Kazanım testi", weeklyCurriculumAttempts.length],
              ["Öğretmen notu", weeklyProgress.length + weeklyLessonSignals],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-paper-200 bg-paper-50 p-3">
                <div className="text-xs text-paper-800/60">{label}</div>
                <div className="mt-1 text-2xl font-semibold text-paper-950">{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-paper-200 bg-paper-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-paper-800/50">
              Son öğretmen notu / aksiyon
            </div>
            <p className="mt-2 text-sm leading-relaxed text-paper-800/75">
              {latestTeacherNote
                ? `${latestTeacherNote.student_display_name} için ${latestTeacherNote.teacher_display_name}: ${latestTeacherNote.narrative_tr}`
                : "Bu hafta öğretmen notu oluşmadı. Öğrenci ders veya soru tamamladığında burada görünecek."}
            </p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              {
                title: "Ders katılımını kontrol et",
                body: weeklyLessonSignals > 0 ? "Bu hafta ders kaydı var; öğretmen notunu okuyun." : "Bu hafta tamamlanan ders kaydı yoksa öğrenciyle takvim planını netleştirin.",
                href: "#bildirimler",
              },
              {
                title: "Soru/ödev temposunu takip et",
                body: weeklyHomeworkSignals > 0 ? "Soru çözümü yapılmış; çözüm kalitesini ve tekrar notunu kontrol edin." : "Öğrenci takıldığı konuyu soru havuzuna göndermemiş olabilir.",
                href: "#bildirimler",
              },
              {
                title: "Gerekirse destek alın",
                body: "Ödeme, erişim veya öğretmen iletişimi aksarsa destek talebinde bağlamı hazır iletin.",
                href: "/yardim",
              },
            ].map((item) => (
              <Link key={item.title} href={item.href} className="rounded-xl border border-paper-200 bg-paper-50 p-4 hover:border-brand-200 hover:bg-brand-50/40">
                <div className="text-sm font-semibold text-paper-950">{item.title}</div>
                <p className="mt-2 text-xs leading-relaxed text-paper-800/65">{item.body}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-800/70">
                Kazanım testi takibi
              </div>
              <h2 className="mt-1 text-lg font-semibold text-paper-900">
                {latestCurriculumAttempt
                  ? `${latestCurriculumAttempt.branch_name} · ${latestCurriculumAttempt.unit_title}`
                  : "Ünite bazlı sonuç bekleniyor"}
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-paper-800/65">
                Öğrenci 20 soruluk kazanım testi çözdüğünde sonuç burada görünür. 15 doğru altı sonuçlarda branş öğretmeni desteği önerilir.
              </p>
            </div>
            <div className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-900">
              {lowCurriculumAttempts.length} düşük skor · {curriculumAttempts.length} test
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              ["Bu hafta", `${weeklyCurriculumAttempts.length} test`, "Yeni çözüm ritmi"],
              ["Düşük skor", `${lowCurriculumAttempts.length} sonuç`, "15 doğru altı takip"],
              ["En sık zorlanılan", topCurriculumWeakTopics[0] ?? "Veri bekleniyor", "Kazanım odağı"],
            ].map(([title, value, body]) => (
              <div key={title} className="rounded-xl border border-paper-200 bg-paper-50 p-3">
                <div className="text-xs font-semibold text-paper-900">{title}</div>
                <div className="mt-1 text-sm font-semibold text-brand-900">{value}</div>
                <p className="mt-1 text-xs text-paper-800/60">{body}</p>
              </div>
            ))}
          </div>
          {latestCurriculumAttempt ? (
            <div className="mt-4 rounded-xl border border-paper-200 bg-paper-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-paper-950">
                    {latestCurriculumAttempt.student_display_name} · {latestCurriculumAttempt.grade_level}. sınıf · {latestCurriculumAttempt.correct_count}/{latestCurriculumAttempt.question_count}
                  </div>
                  <div className="mt-1 text-xs text-paper-800/60">
                    {latestCurriculumAttempt.teacher_support_recommended
                      ? "15 doğru altında: tekrar ve öğretmen desteği önerildi."
                      : "15 doğru ve üstü: pekiştirme ile devam edebilir."}
                  </div>
                  {latestCurriculumAttempt.mastery_level ? (
                    <div className="mt-1 text-xs font-semibold text-brand-900">
                      Seviye: {latestCurriculumAttempt.mastery_level}
                    </div>
                  ) : null}
                  <div className="mt-2 text-xs text-paper-800/60">
                    Zayıf kazanımlar: {topicsFrom(latestCurriculumAttempt.weak_outcomes_jsonb).slice(0, 3).join(", ") || "—"}
                  </div>
                  <div className="mt-2 text-xs text-paper-800/60">
                    Aile aksiyonu: {actionTitlesFrom(latestCurriculumAttempt.recommended_actions_jsonb)[0] ?? "Yanlış kazanımı birlikte okuyun ve tekrar planlayın."}
                  </div>
                </div>
                {latestCurriculumAttempt.teacher_support_recommended ? (
                  <Link
                    href={teacherSearchHref(latestCurriculumAttempt.branch_name, latestCurriculumAttempt.branch_slug)}
                    className="w-fit rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900"
                  >
                    Branş öğretmeni bul
                  </Link>
                ) : null}
              </div>
              {latestCurriculumAttempt.teacher_support_recommended ? (
                <ul className="mt-4 grid gap-2 sm:grid-cols-3">
                  {teacherRecommendationsFrom(latestCurriculumAttempt.teacher_recommendations_jsonb).map((t) => (
                    <li key={t.id} className="rounded-xl border border-paper-200 bg-paper-50 p-3 text-sm">
                      <div className="font-semibold text-paper-900">{t.displayName}</div>
                      <div className="mt-1 text-xs text-paper-800/60">{t.branchName ?? latestCurriculumAttempt.branch_name}</div>
                      <Link href={`/ogretmenler/${t.id}`} className="mt-2 inline-block text-xs font-semibold text-brand-800 underline">
                        Profili incele
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-paper-200 bg-paper-50 p-4 text-sm text-paper-800/65">
              Öğrenci çalışma alanından ilk kazanım testini çözdüğünde veli bildirimi ve sonuç özeti burada oluşur.
            </div>
          )}
          {curriculumAttempts.length > 1 ? (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-paper-900">Son 5 kazanım testi</h3>
              <ul className="mt-2 space-y-2">
                {curriculumAttempts.slice(0, 5).map((attempt) => (
                  <li key={attempt.id} className="rounded-xl border border-paper-200 bg-paper-50 p-3 text-sm">
                    <div className="font-semibold text-paper-950">
                      {attempt.student_display_name} · {attempt.branch_name} · {attempt.unit_title} · {attempt.correct_count}/{attempt.question_count}
                    </div>
                    <div className="mt-1 text-xs text-paper-800/60">
                      {attempt.mastery_level ?? "seviye bekleniyor"} · {new Date(attempt.created_at).toLocaleString("tr-TR")}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section id="guvenli-havuz" className="mt-8 rounded-2xl border border-paper-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-paper-900">Güvenli havuz — aylık ders kredisi</h2>
          <p className="mt-1 text-sm text-paper-800/70">
            Cüzdanınızdan ayrılan bütçe ile çocuğunuza ders kredisi tanımlayın. Ders tamamlanınca ücret öğretmene aktarılır.
          </p>
          {students.length === 0 ? (
            <p className="mt-3 text-sm text-paper-800/55">Önce öğrenci bağlayın.</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Öğrenci
                <select
                  value={creditStudentId}
                  onChange={(e) => setCreditStudentId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2"
                >
                  {students.map((s) => (
                    <option key={s.student_id} value={s.student_id}>
                      {s.student_display_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Aylık ders kredisi
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={monthlyCredits}
                  onChange={(e) => setMonthlyCredits(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                Ders başı bütçe (TL)
                <input
                  value={perLessonTl}
                  onChange={(e) => setPerLessonTl(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  disabled={creditBusy}
                  onClick={() => void allocateCredits()}
                  className="rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {creditBusy ? "…" : "Kredi tanımla"}
                </button>
              </div>
            </div>
          )}
          {creditPools.length > 0 ? (
            <ul className="mt-4 space-y-2 text-sm">
              {creditPools.map((p) => (
                <li key={p.id} className="rounded-lg border border-paper-100 bg-paper-50 p-3">
                  {p.student_display_name}: {p.credits_remaining}/{p.monthly_lesson_credits} kredi ·{" "}
                  {Math.round(p.per_lesson_budget_minor / 100)} TL/ders
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {weeklyReports.length > 0 ? (
          <section className="mt-8 rounded-2xl border border-brand-200 bg-brand-50/50 p-5">
            <h2 className="text-base font-semibold text-brand-950">AI haftalık gelişim raporları</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {weeklyReports.map((rep) => (
                <li key={rep.id} className="rounded-lg bg-white/80 p-3">
                  <div className="font-semibold text-paper-900">{rep.report_title}</div>
                  <div className="mt-1 text-xs text-paper-800/60">{rep.week_start}</div>
                  <p className="mt-2 text-paper-800/75">{rep.report_preview}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section id="ogrenci-baglama" className="mt-8">
          <h2 className="text-base font-semibold text-paper-900">Bağlı öğrenciler</h2>
          <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50/60 p-4">
            <div className="text-sm font-semibold text-brand-950">Davet koduyla bağlan</div>
            <p className="mt-1 text-xs text-brand-900/75">
              Öğrenci panelinden üretilen 7 günlük kodu girin. Kod tek kullanımlıdır.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="min-w-0 flex-1 rounded-xl border border-brand-200 bg-white px-3 py-2 font-mono text-sm text-paper-900"
                placeholder="Örn. A1B2C3D4"
                maxLength={32}
              />
              <button
                type="button"
                disabled={inviteBusy}
                onClick={() => void acceptInvite()}
                className="rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {inviteBusy ? "…" : "Bağlan"}
              </button>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {students.length === 0 ? (
              <div className="rounded-xl border border-paper-200 bg-white p-4 text-sm text-paper-800/75">
                Bağlı öğrenci yok. Öğrenci, veli hesabını bağlamalıdır.
              </div>
            ) : (
              students.map((s) => (
                <div
                  key={s.student_id}
                  className="rounded-xl border border-paper-200 bg-white px-4 py-3 text-sm font-medium text-paper-900"
                >
                  {s.student_display_name}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-paper-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-paper-800/55">Aktif plan</div>
            <div className="mt-2 text-2xl font-semibold text-paper-900">{activePlanCount}</div>
            <div className="mt-1 text-xs text-paper-800/60">Bağlı öğrenciler için</div>
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
              {focusTopics.length ? focusTopics.join(", ") : "Henüz veri yok"}
            </div>
            <div className="mt-1 text-xs text-paper-800/60">Deneme yanlışlarına göre</div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-paper-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-paper-800/55">
                Aile takip özeti
              </div>
              <h2 className="mt-1 text-base font-semibold text-paper-900">{familyRisk}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-paper-800/70">
                Bu özet; ders bildirimleri, konu kavrama durumu, deneme sonuçları ve çalışma planını birlikte okur.
              </p>
            </div>
            <Link
              href="#bildirimler"
              className="w-fit rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-900 hover:bg-brand-100"
            >
              Bildirimleri aç
            </Link>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {[
              ["Okunmamış", `${unreadNotifications} bildirim`, "Ders, ödev ve ödeme dışı gelişmeler burada toplanır."],
              ["Kavrama", averageMastery == null ? "İlk ders bekleniyor" : percentLabel(averageMastery * 100), "Ders sonu özetlerinden konu bazlı durum çıkar."],
              ["Odak", focusTopics.length ? focusTopics.slice(0, 2).join(", ") : "Veri bekleniyor", "Deneme yanlışları tekrar planını besler."],
            ].map(([title, value, body]) => (
              <div key={title} className="rounded-xl border border-paper-200 bg-paper-50 p-3">
                <div className="text-xs font-semibold text-paper-900">{title}</div>
                <div className="mt-1 text-sm font-semibold text-brand-900">{value}</div>
                <p className="mt-1 text-xs leading-relaxed text-paper-800/60">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-800/70">
                Veli güven merkezi
              </div>
              <h2 className="mt-2 text-lg font-semibold text-paper-900">Konu takibi ve risk durumu</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-paper-800/70">
                Ders özetleri, deneme yanlışları ve haftalık plan birlikte takip edilir.
              </p>
            </div>
            <div className="rounded-xl border border-paper-200 bg-paper-50 px-4 py-3 text-sm">
              <div className="text-xs text-paper-800/55">Ortalama kavrama</div>
              <div className="mt-1 text-xl font-semibold text-paper-900">
                {averageMastery == null ? "—" : percentLabel(averageMastery * 100)}
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {lowMasteryTopics.length === 0 ? (
              <div className="rounded-xl border border-paper-200 bg-paper-50 p-4 text-sm text-paper-800/65">
                İlk ders değerlendirmesinden sonra konu takibi burada görünür.
              </div>
            ) : (
              lowMasteryTopics.map((row) => (
                <div key={`${row.student_id}-${row.topic_label}`} className="rounded-xl border border-paper-200 bg-paper-50 p-3">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <div className="font-semibold text-paper-900">{row.topic_label}</div>
                    <div className="text-xs font-medium text-brand-900">{percentLabel(row.mastery * 100)}</div>
                  </div>
                  <div className="mt-1 text-xs text-paper-800/55">
                    {row.student_display_name} · {row.evidence_count} ders kaydı
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper-200">
                    <div
                      className="h-full rounded-full bg-brand-700"
                      style={{ width: `${Math.min(100, Math.max(0, row.mastery * 100))}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section id="calisma-takibi" className="mt-10">
          <h2 className="text-base font-semibold text-paper-900">Çalışma planı ve deneme takibi</h2>
          <p className="mt-1 text-xs text-paper-800/55">Öğrencinin hedef planı ve son test sonuçları.</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-paper-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-paper-900">Aktif planlar</h3>
              {studyPlans.length === 0 ? (
                <p className="mt-2 text-sm text-paper-800/55">Aktif plan yok.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {studyPlans.map((p) => {
                    const progressInfo = planProgress(p);
                    return (
                      <li key={p.id} className="rounded-lg bg-paper-50 p-3 text-sm">
                        <div className="font-medium text-paper-900">
                          {p.student_display_name} · {p.target_exam ?? "Genel"} · {p.weekly_minutes} dk/hafta
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper-200">
                          <div
                            className="h-full rounded-full bg-brand-700"
                            style={{ width: `${Math.min(100, Math.max(0, progressInfo.percent))}%` }}
                          />
                        </div>
                        <div className="mt-1 text-xs text-paper-800/55">
                          {percentLabel(progressInfo.percent)} · {progressInfo.done}/{progressInfo.total} tamamlandı
                          {progressInfo.skipped ? ` · ${progressInfo.skipped} atlandı` : ""}
                        </div>
                        <div className="mt-2 text-xs text-paper-800/55">
                          {p.items.slice(0, 2).map((i) => i.title).join(" · ") || "Plan maddesi yok"}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-paper-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-paper-900">Son denemeler</h3>
              {attempts.length === 0 ? (
                <p className="mt-2 text-sm text-paper-800/55">Sonuç kaydı yok.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {attempts.slice(0, 5).map((a) => (
                    <li key={a.id} className="rounded-lg bg-paper-50 p-3 text-sm">
                      <div className="font-medium text-paper-900">
                        {a.student_display_name} · {a.title} · %{a.score_percent ?? "—"}
                      </div>
                      <div className="mt-1 text-xs text-paper-800/55">
                        {new Date(a.created_at).toLocaleString("tr-TR")}
                      </div>
                      <div className="mt-1 text-xs text-paper-800/55">
                        Zayıf konular: {topicsFrom(a.weak_topics_jsonb).join(", ") || "—"}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-2xl border border-paper-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-paper-900">E-posta bildirimleri</h2>
          <p className="mt-1 text-xs text-paper-800/55">
            Uygulama içi bildirimlere ek olarak e-posta almak istediğiniz konuları seçin. RESEND_API_KEY yapılandırılmadıysa
            e-postalar kuyruğa alınır.
          </p>
          <div className="mt-4 space-y-2 text-sm">
            {(
              [
                ["homeworkEnabled", "Ödev / soru gönderimi"],
                ["lessonEnabled", "Ders ve plan güncellemeleri"],
                ["paymentEnabled", "Ödeme ve kayıt (bilgilendirme)"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={emailPrefs[key]}
                  onChange={(e) => setEmailPrefs((p) => ({ ...p, [key]: e.target.checked }))}
                />
                {label}
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={emailPrefsBusy}
            onClick={() => {
              if (!token) return;
              setEmailPrefsBusy(true);
              setError(null);
              setOk(null);
              apiFetch("/v1/guardians/email-preferences", {
                method: "PATCH",
                token,
                body: JSON.stringify(emailPrefs),
              })
                .then(() => setOk("E-posta tercihleri kaydedildi."))
                .catch((e) => setError(e instanceof Error ? e.message : "kaydedilemedi"))
                .finally(() => setEmailPrefsBusy(false));
            }}
            className="mt-4 rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {emailPrefsBusy ? "Kaydediliyor…" : "Tercihleri kaydet"}
          </button>
        </section>

        <section id="bildirimler" className="mt-10">
          <h2 className="text-base font-semibold text-paper-900">Bildirimler</h2>
          <p className="mt-1 text-xs text-paper-800/55">Özet ve ödev; ödeme öğrenci hesabından.</p>
          <div className="mt-3 space-y-2">
            {notifications.length === 0 ? (
              <div className="rounded-xl border border-paper-200 bg-white p-4 text-sm text-paper-800/75">
                Bildirim yok.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`rounded-xl border p-4 ${
                    n.read_at
                      ? "border-paper-100 bg-paper-50"
                      : "border-brand-200 bg-brand-50/40"
                  }`}
                >
                  <div className="text-sm font-semibold text-paper-900">{n.title}</div>
                  <div className="mt-1 text-xs text-paper-800/55">
                    {new Date(n.created_at).toLocaleString("tr-TR")}
                    {n.read_at ? " · Okundu" : ""}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-paper-800">
                    {n.body}
                  </p>
                  {(() => {
                    const p = n.payload_jsonb;
                    if (!p || typeof p !== "object") return null;
                    const payload = p as { kind?: string; classroomHref?: string };
                    if (typeof payload.classroomHref === "string" && payload.classroomHref.startsWith("/classroom/")) {
                      return (
                        <Link href={payload.classroomHref} className="mt-2 inline-block text-xs font-medium text-brand-800 underline">
                          Canlı sınıfa git
                        </Link>
                      );
                    }
                    const k = payload.kind;
                    if (
                      k === "homework_new_post_guardian" ||
                      k === "homework_claimed_guardian" ||
                      k === "homework_answered_guardian" ||
                      k === "homework_rewarded_guardian" ||
                      k === "homework_answer_rejected_guardian" ||
                      k === "homework_teacher_returned_guardian"
                    ) {
                      return (
                        <p className="mt-2 text-xs text-paper-800/55">Detaylar öğrenci panelinde.</p>
                      );
                    }
                    if (k === "curriculum_test_result_guardian") {
                      return (
                        <p className="mt-2 text-xs text-paper-800/55">
                          Kazanım testi detayı üstteki test takibi bölümünde.
                        </p>
                      );
                    }
                    if (
                      k === "lesson_scheduled" ||
                      k === "lesson_completed" ||
                      k === "lesson_reminder_24h" ||
                      k === "lesson_reminder_2h"
                    ) {
                      return (
                        <p className="mt-2 text-xs text-paper-800/55">
                          Ders linki ve yorum adımları öğrencinin Dersler ekranında.
                        </p>
                      );
                    }
                    if (
                      k === "course_session_scheduled" ||
                      k === "course_session_reminder_24h" ||
                      k === "course_session_reminder_2h"
                    ) {
                      return (
                        <p className="mt-2 text-xs text-paper-800/55">
                          Kurs sınıf linki öğrencinin Kurslar ekranında.
                        </p>
                      );
                    }
                    if (
                      k === "group_lesson_teacher_assigned" ||
                      k === "group_lesson_joined" ||
                      k === "group_lesson_completed"
                    ) {
                      return (
                        <p className="mt-2 text-xs text-paper-800/55">
                          Grup ders detayları öğrencinin Grup dersler ekranında.
                        </p>
                      );
                    }
                    if (k === "direct_booking_completed") {
                      return (
                        <p className="mt-2 text-xs text-paper-800/55">
                          Doğrudan ders anlaşması öğrencinin Doğrudan dersler ekranında.
                        </p>
                      );
                    }
                    return null;
                  })()}
                  {!n.read_at && (
                    <button
                      type="button"
                      disabled={readBusy === n.id}
                      onClick={() => void markRead(n.id)}
                      className="mt-3 rounded-lg border border-paper-300 bg-white px-3 py-1.5 text-xs font-medium text-paper-900 hover:bg-paper-50 disabled:opacity-50"
                    >
                      {readBusy === n.id ? "…" : "Okundu işaretle"}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-base font-semibold text-paper-900">Ders özeti</h2>
          <p className="mt-1 text-xs text-paper-800/55">Öğretmen ders sonu notu.</p>
          <div className="mt-3 space-y-3">
            {progress.length === 0 ? (
              <div className="rounded-xl border border-paper-200 bg-white p-4 text-sm text-paper-800/75">
                Kayıt yok.
              </div>
            ) : (
              progress.map((p) => (
                <article
                  key={p.snapshot_id}
                  className="rounded-xl border border-paper-200 bg-white p-4"
                >
                  <div className="text-xs text-paper-800/55">
                    {p.student_display_name} · {p.teacher_display_name} ·{" "}
                    {new Date(p.created_at).toLocaleString("tr-TR")}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-paper-800">
                    {p.narrative_tr}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
