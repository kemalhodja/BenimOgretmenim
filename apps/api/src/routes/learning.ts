import { Hono } from "hono";
import { z } from "zod";
import { pool } from "../db.js";
import type { AppVariables } from "../types.js";
import { requireAuth } from "../middleware/requireAuth.js";

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

async function studentIdForUser(userId: string): Promise<string | null> {
  const r = await pool.query(`select id from students where user_id = $1`, [userId]);
  return (r.rows[0]?.id as string | undefined) ?? null;
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
    if (!sid) return c.json({ plans: [], attempts: [], modules: [] });
    studentIds = [sid];
  } else {
    const gr = await pool.query(
      `select student_id from student_guardians where guardian_user_id = $1`,
      [userId],
    );
    studentIds = gr.rows.map((r) => r.student_id as string);
  }

  if (studentIds.length === 0) return c.json({ plans: [], attempts: [], modules: [] });

  const [plans, attempts, modules] = await Promise.all([
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
  ]);

  return c.json({
    plans: plans.rows,
    attempts: attempts.rows,
    modules: modules.rows,
  });
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
