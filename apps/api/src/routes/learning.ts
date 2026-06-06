import { Hono } from "hono";
import { z } from "zod";
import { pool } from "../db.js";
import type { AppVariables } from "../types.js";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  enhanceCurriculumQuestion,
  getStaticCurriculumCatalog,
  getStaticCurriculumQuestions,
  publicCurriculumQuestion,
  recommendationBranchSlugs,
  type CurriculumChoice,
  type CurriculumGrade,
  type CurriculumQuestion,
} from "../lib/curriculumTests.js";

export const learning = new Hono<{ Variables: AppVariables }>();

const createPlanSchema = z.object({
  targetExam: z.string().max(80).optional().nullable(),
  weeklyMinutes: z.number().int().min(60).max(3000).optional().default(300),
  weakTopics: z.array(z.string().min(1).max(120)).max(20).optional().default([]),
});

const attemptSchema = z.object({
  moduleId: z.string().uuid().optional().nullable(),
  title: z.string().min(2).max(160),
  scorePercent: z.number().min(0).max(100).optional().nullable(),
  durationMinutes: z.number().int().min(1).max(600).optional().nullable(),
  weakTopics: z.array(z.string().min(1).max(120)).max(30).optional().default([]),
  answers: z.record(z.string(), z.unknown()).optional().default({}),
});

const planItemStatusSchema = z.object({
  status: z.enum(["todo", "done", "skipped"]),
});

const curriculumTestQuerySchema = z.object({
  gradeLevel: z.coerce.number().int().min(1).max(12),
  branchSlug: z.string().min(2).max(80),
  unitSlug: z.string().min(2).max(120),
});

const curriculumTestSubmitSchema = z.object({
  gradeLevel: z.number().int().min(1).max(12),
  branchSlug: z.string().min(2).max(80),
  unitSlug: z.string().min(2).max(120),
  answers: z.record(z.string(), z.enum(["A", "B", "C", "D"])),
});

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

type MasteryLevel = "kritik" | "destek_gerekli" | "pekistirme" | "guclu";

async function studentIdForUser(userId: string): Promise<string | null> {
  const r = await pool.query(`select id from students where user_id = $1`, [userId]);
  return (r.rows[0]?.id as string | undefined) ?? null;
}

function isMissingRelation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "42P01";
}

function parseChoices(value: unknown): CurriculumChoice[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((choice) => {
      if (!choice || typeof choice !== "object") return null;
      const row = choice as { key?: unknown; text?: unknown };
      if (row.key !== "A" && row.key !== "B" && row.key !== "C" && row.key !== "D") return null;
      if (typeof row.text !== "string") return null;
      return { key: row.key, text: row.text };
    })
    .filter((choice): choice is CurriculumChoice => choice !== null);
}

function questionFromDbRow(row: Record<string, unknown>): CurriculumQuestion {
  const correctChoice = row.correct_choice;
  return enhanceCurriculumQuestion({
    id: String(row.id),
    gradeLevel: Number(row.grade_level),
    branchSlug: String(row.branch_slug),
    branchName: String(row.branch_name),
    unitSlug: String(row.unit_slug),
    unitTitle: String(row.unit_title),
    outcomeCode: String(row.outcome_code),
    outcomeTitle: String(row.outcome_title),
    prompt: String(row.question_text),
    choices: parseChoices(row.choices_jsonb),
    correctChoice:
      correctChoice === "A" || correctChoice === "B" || correctChoice === "C" || correctChoice === "D"
        ? correctChoice
        : "A",
    explanation: typeof row.explanation === "string" ? row.explanation : "",
    difficulty: row.difficulty === "easy" || row.difficulty === "hard" ? row.difficulty : "medium",
    sortOrder: Number(row.sort_order),
    metadata: {
      skill: "",
      misconception: "",
      bloomLevel: "apply",
      estimatedSeconds: 70,
      practiceHint: "",
    },
  });
}

async function loadCurriculumQuestions(args: {
  gradeLevel: number;
  branchSlug: string;
  unitSlug: string;
}): Promise<CurriculumQuestion[]> {
  try {
    const r = await pool.query(
      `select id,
              grade_level,
              branch_slug,
              branch_name,
              unit_slug,
              unit_title,
              outcome_code,
              outcome_title,
              question_text,
              choices_jsonb,
              correct_choice,
              explanation,
              difficulty,
              sort_order
       from curriculum_test_questions
       where status = 'published'
         and grade_level = $1
         and branch_slug = $2
         and unit_slug = $3
       order by sort_order
       limit 20`,
      [args.gradeLevel, args.branchSlug, args.unitSlug],
    );
    if (r.rows.length === 20) return r.rows.map((row) => questionFromDbRow(row));
  } catch (e) {
    if (!isMissingRelation(e)) throw e;
  }
  return getStaticCurriculumQuestions(args);
}

async function loadCurriculumCatalog(): Promise<CurriculumGrade[]> {
  try {
    const r = await pool.query(
      `select grade_level,
              branch_slug,
              branch_name,
              unit_slug,
              unit_title,
              count(*)::int as question_count
       from curriculum_test_questions
       where status = 'published'
       group by grade_level, branch_slug, branch_name, unit_slug, unit_title
       having count(*) >= 20
       order by grade_level, branch_name, unit_title`,
    );
    if (r.rows.length > 0) {
      const byGrade = new Map<number, Map<string, { branchSlug: string; branchName: string; units: Array<{ unitSlug: string; unitTitle: string; questionCount: number }> }>>();
      for (const row of r.rows as Array<{
        grade_level: number;
        branch_slug: string;
        branch_name: string;
        unit_slug: string;
        unit_title: string;
        question_count: number;
      }>) {
        if (!byGrade.has(row.grade_level)) byGrade.set(row.grade_level, new Map());
        const branches = byGrade.get(row.grade_level)!;
        if (!branches.has(row.branch_slug)) {
          branches.set(row.branch_slug, { branchSlug: row.branch_slug, branchName: row.branch_name, units: [] });
        }
        branches.get(row.branch_slug)!.units.push({
          unitSlug: row.unit_slug,
          unitTitle: row.unit_title,
          questionCount: row.question_count,
        });
      }
      return [...byGrade.entries()].map(([gradeLevel, branches]) => ({
        gradeLevel,
        label: `${gradeLevel}. sınıf`,
        branches: [...branches.values()],
      }));
    }
  } catch (e) {
    if (!isMissingRelation(e)) throw e;
  }
  return getStaticCurriculumCatalog();
}

function masteryLevelFor(correctCount: number): MasteryLevel {
  if (correctCount < 10) return "kritik";
  if (correctCount < 15) return "destek_gerekli";
  if (correctCount < 18) return "pekistirme";
  return "guclu";
}

function masteryLabel(level: MasteryLevel): string {
  if (level === "kritik") return "Kritik tekrar gerekli";
  if (level === "destek_gerekli") return "Öğretmen desteği önerilir";
  if (level === "pekistirme") return "Pekiştirme aşaması";
  return "Güçlü ilerleme";
}

function recommendedActions(args: {
  first: CurriculumQuestion;
  masteryLevel: MasteryLevel;
  weakOutcomes: string[];
  misconceptions: string[];
  teacherSupportRecommended: boolean;
}) {
  const weakFocus = args.weakOutcomes.slice(0, 2).join(", ") || args.first.unitTitle;
  const misconception = args.misconceptions[0] ?? args.first.metadata.misconception;
  const base = [
    {
      title: "Yanlışını adlandır",
      body: `${weakFocus} için önce hatanın türünü yaz: ${misconception}.`,
    },
    {
      title: "Hedefli tekrar yap",
      body: args.first.metadata.practiceHint,
    },
    {
      title: args.teacherSupportRecommended ? "Branş öğretmeniyle kapat" : "Sonraki kazanıma hazırlan",
      body: args.teacherSupportRecommended
        ? `${args.first.branchName} branşında 15 doğru eşiği geçilmedi; öğretmenle 1 kısa analiz dersi planla.`
        : `${args.masteryLevel === "guclu" ? "Güçlü sonuç var" : "Pekiştirme gerekli"}; aynı üniteden süreli tekrar çöz ve sonraki üniteye geç.`,
    },
  ];
  return base;
}

async function queryCurriculumAttempts(studentIds: string[]) {
  try {
    const r = await pool.query(
      `select a.id,
              a.student_id,
              su.display_name as student_display_name,
              a.grade_level,
              a.branch_slug,
              a.branch_name,
              a.unit_slug,
              a.unit_title,
              a.question_count,
              a.correct_count,
              a.score_percent,
              a.weak_outcomes_jsonb,
              a.teacher_support_recommended,
              a.teacher_recommendations_jsonb,
              a.mastery_level,
              a.misconceptions_jsonb,
              a.recommended_actions_jsonb,
              a.answered_count,
              a.created_at
       from student_curriculum_test_attempts a
       join students s on s.id = a.student_id
       join users su on su.id = s.user_id
       where a.student_id = any($1::uuid[])
       order by a.created_at desc
       limit 20`,
      [studentIds],
    );
    return r.rows;
  } catch (e) {
    if (isMissingRelation(e)) return [];
    throw e;
  }
}

async function recommendTeachersForBranch(branchSlug: string, studentId: string): Promise<TeacherRecommendation[]> {
  const branchSlugs = recommendationBranchSlugs(branchSlug);
  const r = await pool.query(
    `select t.id,
            u.display_name,
            t.rating_avg,
            t.rating_count,
            c.name as city_name,
            string_agg(distinct b.name, ', ' order by b.name) as branch_name,
            min(case when tb.hourly_rate_range is null then null else lower(tb.hourly_rate_range)::int end) as min_hourly_rate_minor,
            bool_or(tb.is_primary) as has_primary_branch,
            bool_or(b.slug = $1) as exact_branch_match,
            bool_or(st.city_id is not null and t.city_id = st.city_id) as city_match
     from teachers t
     join users u on u.id = t.user_id
     join teacher_branches tb on tb.teacher_id = t.id
     join branches b on b.id = tb.branch_id
     left join students st on st.id = $2
     left join cities c on c.id = t.city_id
     where b.slug = any($3::text[])
       and t.verification_status = 'verified'
     group by t.id, u.display_name, t.rating_avg, t.rating_count, c.name
     order by bool_or(b.slug = $1) desc,
              bool_or(tb.is_primary) desc,
              coalesce(t.rating_avg, 0) desc,
              t.rating_count desc
     limit 12`,
    [branchSlug, studentId, branchSlugs],
  );
  return r.rows
    .map((row) => ({
      id: String(row.id),
      displayName: String(row.display_name),
      ratingAvg: row.rating_avg as string | number | null,
      ratingCount: Number(row.rating_count ?? 0),
      cityName: (row.city_name as string | null) ?? null,
      branchName: (row.branch_name as string | null) ?? null,
      minHourlyRateMinor: row.min_hourly_rate_minor == null ? null : Number(row.min_hourly_rate_minor),
      recommendationScore:
        (row.exact_branch_match ? 35 : 16) +
        (row.has_primary_branch ? 20 : 0) +
        (row.city_match ? 12 : 0) +
        Math.min(25, Math.round(Number(row.rating_avg ?? 0) * 5)) +
        Math.min(8, Number(row.rating_count ?? 0)),
      reasons: [
        row.exact_branch_match ? "Aynı branş eşleşmesi" : "Yakın branş eşleşmesi",
        row.has_primary_branch ? "Birincil uzmanlık alanı" : "",
        row.city_match ? "Aynı şehir avantajı" : "",
        Number(row.rating_avg ?? 0) >= 4.5 ? "Yüksek veli/öğrenci puanı" : "",
        row.min_hourly_rate_minor != null ? "Ücret bandı görünür" : "Profil bilgileri incelenebilir",
      ].filter(Boolean),
    }))
    .sort((a, b) => b.recommendationScore - a.recommendationScore || b.ratingCount - a.ratingCount)
    .slice(0, 3);
}

learning.get("/content", async (c) => {
  const r = await pool.query(
    `select m.id,
            m.slug,
            m.title,
            m.branch_slug,
            m.audience,
            m.description,
            m.level_code,
            m.estimated_minutes,
            m.metadata_jsonb,
            coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'id', i.id,
                  'sortOrder', i.sort_order,
                  'itemType', i.item_type,
                  'title', i.title,
                  'url', i.url,
                  'durationMinutes', i.duration_minutes
                )
                order by i.sort_order
              ) filter (where i.id is not null),
              '[]'::jsonb
            ) as items
     from learning_content_modules m
     left join learning_content_items i on i.module_id = m.id
     where m.status = 'published'
     group by m.id
     order by m.created_at desc
     limit 50`,
  );
  return c.json({ modules: r.rows });
});

learning.get("/overview", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "student" && role !== "guardian") {
    return c.json({ error: "forbidden_students_or_guardians_only" }, 403);
  }

  let studentIds: string[] = [];
  if (role === "student") {
    const sid = await studentIdForUser(userId);
    if (!sid) return c.json({ plans: [], attempts: [], modules: [], curriculumAttempts: [] });
    studentIds = [sid];
  } else {
    const gr = await pool.query(
      `select student_id from student_guardians where guardian_user_id = $1`,
      [userId],
    );
    studentIds = gr.rows.map((r) => r.student_id as string);
  }

  if (studentIds.length === 0) return c.json({ plans: [], attempts: [], modules: [], curriculumAttempts: [] });

  const [plans, attempts, modules, curriculumAttempts] = await Promise.all([
    pool.query(
      `select p.id,
              p.student_id,
              su.display_name as student_display_name,
              p.target_exam,
              p.weekly_minutes,
              p.weak_topics_jsonb,
              p.status,
              p.created_at,
              coalesce(
                jsonb_agg(
                  jsonb_build_object(
                    'id', i.id,
                    'dayIndex', i.day_index,
                    'title', i.title,
                    'minutes', i.minutes,
                    'status', i.status
                  )
                  order by i.day_index, i.created_at
                ) filter (where i.id is not null),
                '[]'::jsonb
              ) as items
       from student_study_plans p
       join students s on s.id = p.student_id
       join users su on su.id = s.user_id
       left join student_study_plan_items i on i.plan_id = p.id
       where p.student_id = any($1::uuid[])
       group by p.id, su.display_name
       order by p.created_at desc
       limit 10`,
      [studentIds],
    ),
    pool.query(
      `select a.id,
              a.student_id,
              su.display_name as student_display_name,
              a.title,
              a.score_percent,
              a.duration_minutes,
              a.weak_topics_jsonb,
              a.created_at,
              m.title as module_title
       from student_assessment_attempts a
       join students s on s.id = a.student_id
       join users su on su.id = s.user_id
       left join learning_content_modules m on m.id = a.module_id
       where a.student_id = any($1::uuid[])
       order by a.created_at desc
       limit 20`,
      [studentIds],
    ),
    pool.query(
      `select id, slug, title, branch_slug, level_code, estimated_minutes
       from learning_content_modules
       where status = 'published'
       order by created_at desc
       limit 12`,
    ),
    queryCurriculumAttempts(studentIds),
  ]);

  return c.json({
    plans: plans.rows,
    attempts: attempts.rows,
    modules: modules.rows,
    curriculumAttempts,
  });
});

learning.get("/curriculum-tests/catalog", requireAuth, async (c) => {
  if (c.get("userRole") !== "student") return c.json({ error: "forbidden_students_only" }, 403);
  const catalog = await loadCurriculumCatalog();
  return c.json({ catalog, thresholdCorrect: 15, questionCount: 20 });
});

learning.get("/curriculum-tests", requireAuth, async (c) => {
  if (c.get("userRole") !== "student") return c.json({ error: "forbidden_students_only" }, 403);
  const parsed = curriculumTestQuerySchema.safeParse({
    gradeLevel: c.req.query("gradeLevel"),
    branchSlug: c.req.query("branchSlug"),
    unitSlug: c.req.query("unitSlug"),
  });
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const questions = await loadCurriculumQuestions(parsed.data);
  if (questions.length !== 20) return c.json({ error: "curriculum_test_not_found" }, 404);
  const first = questions[0];
  return c.json({
    test: {
      gradeLevel: first.gradeLevel,
      branchSlug: first.branchSlug,
      branchName: first.branchName,
      unitSlug: first.unitSlug,
      unitTitle: first.unitTitle,
      questionCount: questions.length,
      thresholdCorrect: 15,
      questions: questions.map(publicCurriculumQuestion),
    },
  });
});

learning.post("/curriculum-test-attempts", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "student") return c.json({ error: "forbidden_students_only" }, 403);
  const studentId = await studentIdForUser(userId);
  if (!studentId) return c.json({ error: "student_profile_missing" }, 400);

  const parsed = curriculumTestSubmitSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const questions = await loadCurriculumQuestions(parsed.data);
  if (questions.length !== 20) return c.json({ error: "curriculum_test_not_found" }, 404);

  const answers = parsed.data.answers;
  const expectedQuestionIds = new Set(questions.map((question) => question.id));
  const answerIds = Object.keys(answers);
  const missingQuestionIds = questions
    .filter((question) => answers[question.id] == null)
    .map((question) => question.id);
  const invalidQuestionIds = answerIds.filter((id) => !expectedQuestionIds.has(id));
  if (missingQuestionIds.length > 0) {
    return c.json(
      {
        error: "incomplete_curriculum_test",
        message: "20 sorunun tamamı cevaplanmadan sonuç kaydedilemez.",
        missingQuestionIds,
      },
      400,
    );
  }
  if (invalidQuestionIds.length > 0) {
    return c.json(
      {
        error: "invalid_curriculum_question_ids",
        message: "Bu teste ait olmayan soru cevapları gönderildi.",
        invalidQuestionIds,
      },
      400,
    );
  }
  const questionResults = questions.map((question) => {
    const selectedChoice = answers[question.id] ?? null;
    const isCorrect = selectedChoice === question.correctChoice;
    return {
      questionId: question.id,
      outcomeCode: question.outcomeCode,
      outcomeTitle: question.outcomeTitle,
      selectedChoice,
      correctChoice: question.correctChoice,
      isCorrect,
      explanation: question.explanation,
      skill: question.metadata.skill,
      misconception: question.metadata.misconception,
      practiceHint: question.metadata.practiceHint,
    };
  });
  const correctCount = questionResults.filter((result) => result.isCorrect).length;
  const questionCount = questions.length;
  const scorePercent = Math.round((correctCount / questionCount) * 10000) / 100;
  const masteryLevel = masteryLevelFor(correctCount);
  const weakOutcomes = questionResults
    .filter((result) => !result.isCorrect)
    .map((result) => result.outcomeTitle)
    .filter((value, index, arr) => arr.indexOf(value) === index)
    .slice(0, 8);
  const misconceptions = questionResults
    .filter((result) => !result.isCorrect)
    .map((result) => result.misconception)
    .filter((value, index, arr) => value && arr.indexOf(value) === index)
    .slice(0, 5);
  const teacherSupportRecommended = correctCount < 15;
  const teacherRecommendations = teacherSupportRecommended
    ? await recommendTeachersForBranch(questions[0].branchSlug, studentId)
    : [];
  const first = questions[0];
  const title = `${first.gradeLevel}. sınıf ${first.branchName}: ${first.unitTitle} kazanım testi`;
  const actions = recommendedActions({
    first,
    masteryLevel,
    weakOutcomes,
    misconceptions,
    teacherSupportRecommended,
  });

  const client = await pool.connect();
  try {
    await client.query("begin");
    const attempt = await client.query(
      `insert into student_curriculum_test_attempts (
         student_id, grade_level, branch_slug, branch_name, unit_slug, unit_title,
         question_count, correct_count, score_percent, weak_outcomes_jsonb,
         question_refs_jsonb, answers_jsonb, teacher_support_recommended,
       teacher_recommendations_jsonb, mastery_level, misconceptions_jsonb,
       recommended_actions_jsonb, answered_count
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13, $14::jsonb, $15, $16::jsonb, $17::jsonb, $18)
       returning id, created_at`,
      [
        studentId,
        first.gradeLevel,
        first.branchSlug,
        first.branchName,
        first.unitSlug,
        first.unitTitle,
        questionCount,
        correctCount,
        scorePercent,
        JSON.stringify(weakOutcomes),
        JSON.stringify(questions.map((question) => ({
          id: question.id,
          outcomeCode: question.outcomeCode,
          outcomeTitle: question.outcomeTitle,
        }))),
        JSON.stringify(answers),
        teacherSupportRecommended,
        JSON.stringify(teacherRecommendations),
        masteryLevel,
        JSON.stringify(misconceptions),
        JSON.stringify(actions),
        answerIds.length,
      ],
    );
    await client.query(
      `insert into student_assessment_attempts (
         student_id, module_id, title, score_percent, duration_minutes,
         weak_topics_jsonb, answers_jsonb
       ) values ($1, null, $2, $3, null, $4::jsonb, $5::jsonb)`,
      [studentId, title, scorePercent, JSON.stringify(weakOutcomes), JSON.stringify(answers)],
    );

    const guardians = await client.query<{ guardian_user_id: string }>(
      `select guardian_user_id from student_guardians where student_id = $1`,
      [studentId],
    );
    const notificationTitle = teacherSupportRecommended
      ? "Kazanım testinde destek önerisi"
      : "Kazanım testi tamamlandı";
    const notificationBody = teacherSupportRecommended
      ? `${title} sonucu ${correctCount}/20 (${masteryLabel(masteryLevel)}). ${weakOutcomes.slice(0, 2).join(", ") || first.unitTitle} için tekrar ve branş öğretmeni desteği önerilir. Bugünkü adım: ${actions[0]?.body ?? "Yanlış analizi yapın."}`
      : `${title} sonucu ${correctCount}/20 (${masteryLabel(masteryLevel)}). Öğrenci bu ünite için pekiştirme/sonraki kazanım adımına geçebilir.`;
    for (const row of guardians.rows) {
      await client.query(
        `insert into parent_notifications (
           recipient_user_id, student_id, snapshot_id, channel,
           title, body, payload_jsonb, delivery_status, sent_at
         ) values ($1, $2, null, 'in_app', $3, $4, $5::jsonb, 'sent', now())`,
        [
          row.guardian_user_id,
          studentId,
          notificationTitle,
          notificationBody,
          JSON.stringify({
            kind: "curriculum_test_result_guardian",
            attemptId: attempt.rows[0].id,
            gradeLevel: first.gradeLevel,
            branchSlug: first.branchSlug,
            branchName: first.branchName,
            unitSlug: first.unitSlug,
            unitTitle: first.unitTitle,
            correctCount,
            questionCount,
            scorePercent,
            weakOutcomes,
            misconceptions,
            masteryLevel,
            recommendedActions: actions,
            teacherSupportRecommended,
            teacherRecommendations,
          }),
        ],
      );
    }

    await client.query("commit");
    return c.json(
      {
        attempt: {
          id: attempt.rows[0].id,
          title,
          gradeLevel: first.gradeLevel,
          branchSlug: first.branchSlug,
          branchName: first.branchName,
          unitSlug: first.unitSlug,
          unitTitle: first.unitTitle,
          correctCount,
          questionCount,
          scorePercent,
          masteryLevel,
          masteryLabel: masteryLabel(masteryLevel),
          weakOutcomes,
          misconceptions,
          recommendedActions: actions,
          teacherSupportRecommended,
          teacherRecommendations,
          questionResults,
          createdAt: attempt.rows[0].created_at,
        },
      },
      201,
    );
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
});

learning.post("/study-plan", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "student") return c.json({ error: "forbidden_students_only" }, 403);
  const studentId = await studentIdForUser(userId);
  if (!studentId) return c.json({ error: "student_profile_missing" }, 400);

  const parsed = createPlanSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const recentAttempts = await pool.query(
    `select weak_topics_jsonb
     from student_assessment_attempts
     where student_id = $1
     order by created_at desc
     limit 8`,
    [studentId],
  );
  const recentTopicCounts = new Map<string, number>();
  for (const row of recentAttempts.rows as Array<{ weak_topics_jsonb: unknown }>) {
    const values = Array.isArray(row.weak_topics_jsonb) ? row.weak_topics_jsonb : [];
    for (const value of values) {
      const topic = String(value).trim();
      if (topic) recentTopicCounts.set(topic, (recentTopicCounts.get(topic) ?? 0) + 1);
    }
  }
  const weakTopics = [
    ...parsed.data.weakTopics.map((x) => x.trim()).filter(Boolean),
    ...[...recentTopicCounts.entries()].sort((a, b) => b[1] - a[1]).map(([topic]) => topic),
  ].filter((topic, index, arr) => arr.findIndex((x) => x.toLocaleLowerCase("tr-TR") === topic.toLocaleLowerCase("tr-TR")) === index);
  const weeklyMinutes = parsed.data.weeklyMinutes;
  const perDay = Math.max(20, Math.round(weeklyMinutes / 7));
  const topics = weakTopics.length ? weakTopics : ["Konu tekrarı", "Soru çözümü", "Yanlış analizi"];
  const dayTemplates = [
    "kısa tekrar + 12 hedefli soru",
    "yanlış analizi + not çıkarma",
    "karma test + süre takibi",
    "mini konu anlatımı + örnek çözüm",
    "ödev tamamlama + eksik kapatma",
    "deneme provası + analiz",
    "haftalık özet + yeni hedef",
  ];

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `update student_study_plans set status = 'archived', updated_at = now()
       where student_id = $1 and status = 'active'`,
      [studentId],
    );
    const plan = await client.query(
      `insert into student_study_plans (
         student_id, target_exam, weekly_minutes, weak_topics_jsonb
       ) values ($1, $2, $3, $4::jsonb)
       returning id, target_exam, weekly_minutes, weak_topics_jsonb, status, created_at`,
      [
        studentId,
        parsed.data.targetExam?.trim() || null,
        weeklyMinutes,
        JSON.stringify(weakTopics),
      ],
    );
    const planId = plan.rows[0].id as string;
    for (let day = 1; day <= 7; day++) {
      const topic = topics[(day - 1) % topics.length];
      const template = dayTemplates[day - 1] ?? "hedefli çalışma";
      await client.query(
        `insert into student_study_plan_items (plan_id, day_index, title, minutes)
         values ($1, $2, $3, $4)`,
        [planId, day, `${topic}: ${template}`, perDay],
      );
    }
    await client.query("commit");
    return c.json({ plan: plan.rows[0] }, 201);
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
});

learning.patch("/study-plan-items/:itemId", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "student") return c.json({ error: "forbidden_students_only" }, 403);
  const studentId = await studentIdForUser(userId);
  if (!studentId) return c.json({ error: "student_profile_missing" }, 400);

  const itemId = c.req.param("itemId");
  if (!z.string().uuid().safeParse(itemId).success) return c.json({ error: "invalid_item_id" }, 400);
  const parsed = planItemStatusSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const updated = await pool.query(
    `update student_study_plan_items i
     set status = $3
     from student_study_plans p
     where i.plan_id = p.id
       and i.id = $1
       and p.student_id = $2
       and p.status = 'active'
     returning i.id, i.day_index, i.title, i.minutes, i.status`,
    [itemId, studentId, parsed.data.status],
  );
  if (!updated.rowCount) return c.json({ error: "not_found_or_inactive_plan" }, 404);
  return c.json({ item: updated.rows[0] });
});

learning.post("/exam-attempts", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "student") return c.json({ error: "forbidden_students_only" }, 403);
  const studentId = await studentIdForUser(userId);
  if (!studentId) return c.json({ error: "student_profile_missing" }, 400);

  const parsed = attemptSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const ins = await pool.query(
    `insert into student_assessment_attempts (
       student_id, module_id, title, score_percent, duration_minutes,
       weak_topics_jsonb, answers_jsonb
     ) values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
     returning id, title, score_percent, weak_topics_jsonb, created_at`,
    [
      studentId,
      parsed.data.moduleId ?? null,
      parsed.data.title.trim(),
      parsed.data.scorePercent ?? null,
      parsed.data.durationMinutes ?? null,
      JSON.stringify(parsed.data.weakTopics ?? []),
      JSON.stringify(parsed.data.answers ?? {}),
    ],
  );
  return c.json({ attempt: ins.rows[0] }, 201);
});
