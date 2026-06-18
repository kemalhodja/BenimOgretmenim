import { createHash, randomBytes } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import { pool } from "../db.js";
import type { AppVariables } from "../types.js";
import { requireAuth } from "../middleware/requireAuth.js";

const linkSchema = z.object({
  guardianUserId: z.string().uuid(),
});

const acceptInviteSchema = z.object({
  code: z.string().min(6).max(32),
});

function normalizeInviteCode(raw: string): string {
  return raw.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function hashInviteCode(code: string): string {
  return createHash("sha256").update(`guardian:${code}`).digest("hex");
}

async function createUniqueInviteCode(): Promise<{ code: string; hash: string }> {
  for (let i = 0; i < 8; i++) {
    const code = randomBytes(4).toString("hex").toUpperCase();
    const hash = hashInviteCode(code);
    const existing = await pool.query(`select 1 from guardian_invite_codes where code_hash = $1`, [hash]);
    if (!existing.rowCount) return { code, hash };
  }
  throw new Error("guardian_invite_code_generate_failed");
}

function isMissingRelation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "42P01";
}

async function queryCurriculumAttemptsForGuardian(userId: string) {
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
       where exists (
         select 1 from student_guardians sg
         where sg.student_id = a.student_id
           and sg.guardian_user_id = $1
       )
       order by a.created_at desc
       limit 20`,
      [userId],
    );
    return r.rows;
  } catch (e) {
    if (isMissingRelation(e)) return [];
    throw e;
  }
}

export const guardians = new Hono<{ Variables: AppVariables }>();

guardians.get("/invites/mine", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "student") return c.json({ error: "forbidden_students_only" }, 403);

  const st = await pool.query(`select id from students where user_id = $1`, [userId]);
  if (!st.rowCount) return c.json({ invites: [] });
  const studentId = st.rows[0].id as string;

  const r = await pool.query(
    `select i.id, i.expires_at, i.accepted_at, i.created_at,
            u.display_name as accepted_guardian_display_name
     from guardian_invite_codes i
     left join users u on u.id = i.accepted_guardian_user_id
     where i.student_id = $1
     order by i.created_at desc
     limit 10`,
    [studentId],
  );
  return c.json({ invites: r.rows });
});

guardians.post("/invites", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "student") return c.json({ error: "forbidden_students_only" }, 403);

  const st = await pool.query(`select id from students where user_id = $1`, [userId]);
  if (!st.rowCount) return c.json({ error: "student_profile_missing" }, 400);
  const studentId = st.rows[0].id as string;
  const { code, hash } = await createUniqueInviteCode();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  const ins = await pool.query(
    `insert into guardian_invite_codes (student_id, code_hash, expires_at)
     values ($1, $2, $3)
     returning id, expires_at, created_at`,
    [studentId, hash, expiresAt],
  );
  return c.json({ invite: { ...ins.rows[0], code } }, 201);
});

guardians.post("/accept-invite", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "guardian") return c.json({ error: "forbidden_guardians_only" }, 403);

  const parsed = acceptInviteSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const code = normalizeInviteCode(parsed.data.code);
  if (code.length < 6) return c.json({ error: "invalid_invite_code" }, 400);
  const codeHash = hashInviteCode(code);

  const client = await pool.connect();
  try {
    await client.query("begin");
    const invite = await client.query(
      `select id, student_id, expires_at, accepted_at
       from guardian_invite_codes
       where code_hash = $1
       for update`,
      [codeHash],
    );
    if (!invite.rowCount) {
      await client.query("rollback");
      return c.json({ error: "invite_not_found" }, 404);
    }
    const row = invite.rows[0] as { id: string; student_id: string; expires_at: string; accepted_at: string | null };
    if (row.accepted_at) {
      await client.query("rollback");
      return c.json({ error: "invite_already_used" }, 409);
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await client.query("rollback");
      return c.json({ error: "invite_expired" }, 409);
    }

    await client.query(
      `insert into student_guardians (student_id, guardian_user_id, relationship, is_primary)
       values ($1, $2, 'veli', false)
       on conflict (student_id, guardian_user_id) do nothing`,
      [row.student_id, userId],
    );
    const studentUser = await client.query(
      `select u.id as user_id, u.display_name
       from students s
       join users u on u.id = s.user_id
       where s.id = $1`,
      [row.student_id],
    );
    const studentUserId = studentUser.rows[0]?.user_id as string | undefined;
    const studentName = (studentUser.rows[0]?.display_name as string | undefined) ?? "Öğrenci";
    await client.query(
      `insert into parent_notifications (
         recipient_user_id, student_id, snapshot_id, channel,
         title, body, payload_jsonb, delivery_status, sent_at
       ) values ($1, $2, null, 'in_app', $3, $4, $5::jsonb, 'sent', now())`,
      [
        userId,
        row.student_id,
        "Öğrenci hesabı bağlandı",
        `${studentName} hesabı veli panelinize eklendi.`,
        JSON.stringify({ kind: "guardian_invite_accepted", studentId: row.student_id, inviteId: row.id }),
      ],
    );
    if (studentUserId && studentUserId !== userId) {
      await client.query(
        `insert into parent_notifications (
           recipient_user_id, student_id, snapshot_id, channel,
           title, body, payload_jsonb, delivery_status, sent_at
         ) values ($1, $2, null, 'in_app', $3, $4, $5::jsonb, 'sent', now())`,
        [
          studentUserId,
          row.student_id,
          "Veli bağlantısı tamamlandı",
          "Davet kodunuz kullanıldı ve veli hesabı öğrencinize bağlandı.",
          JSON.stringify({ kind: "guardian_invite_accepted", studentId: row.student_id, guardianUserId: userId }),
        ],
      );
    }
    await client.query(
      `update guardian_invite_codes
       set accepted_at = now(), accepted_guardian_user_id = $2
       where id = $1`,
      [row.id, userId],
    );
    await client.query("commit");
    return c.json({ ok: true, studentId: row.student_id });
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
});

/** Veli: bağlı öğrenciler + son ders gelişim özetleri (ai_progress_snapshots) */
guardians.get("/overview", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "guardian") {
    return c.json({ error: "forbidden_guardians_only" }, 403);
  }

  const students = await pool.query(
    `select s.id as student_id,
            su.display_name as student_display_name
     from student_guardians sg
     join students s on s.id = sg.student_id
     join users su on su.id = s.user_id
     where sg.guardian_user_id = $1
     order by su.display_name`,
    [userId],
  );

  const progress = await pool.query(
    `select aps.id as snapshot_id,
            aps.student_id,
            su.display_name as student_display_name,
            aps.narrative_tr,
            aps.metrics_jsonb,
            aps.created_at,
            tu.display_name as teacher_display_name
     from ai_progress_snapshots aps
     join students s on s.id = aps.student_id
     join users su on su.id = s.user_id
     join teachers t on t.id = aps.teacher_id
     join users tu on tu.id = t.user_id
     where exists (
       select 1 from student_guardians sg
       where sg.student_id = aps.student_id
         and sg.guardian_user_id = $1
     )
     order by aps.created_at desc
     limit 40`,
    [userId],
  );

  const masteryGraph = await pool.query(
    `select aps.student_id,
            su.display_name as student_display_name,
            coalesce(nullif(topic->>'label', ''), nullif(topic->>'code', ''), 'Konu') as topic_label,
            avg(
              case
                when (topic->>'mastery_estimate') ~ '^[0-9]+(\\.[0-9]+)?$'
                then (topic->>'mastery_estimate')::numeric
                else null
              end
            ) as mastery_estimate,
            count(*)::int as evidence_count,
            max(aps.created_at) as last_seen_at
     from ai_progress_snapshots aps
     join students s on s.id = aps.student_id
     join users su on su.id = s.user_id
     cross join lateral jsonb_array_elements(coalesce(aps.metrics_jsonb->'topics', '[]'::jsonb)) topic
     where exists (
       select 1 from student_guardians sg
       where sg.student_id = aps.student_id
         and sg.guardian_user_id = $1
     )
     group by aps.student_id, su.display_name, topic_label
     order by mastery_estimate asc nulls last, evidence_count desc, last_seen_at desc
     limit 24`,
    [userId],
  );

  const studyPlans = await pool.query(
    `select p.id,
            p.student_id,
            su.display_name as student_display_name,
            p.target_exam,
            p.weekly_minutes,
            p.weak_topics_jsonb,
            p.created_at,
            coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'dayIndex', i.day_index,
                  'title', i.title,
                  'minutes', i.minutes,
                  'status', i.status
                )
                order by i.day_index
              ) filter (where i.id is not null),
              '[]'::jsonb
            ) as items
     from student_study_plans p
     join students s on s.id = p.student_id
     join users su on su.id = s.user_id
     left join student_study_plan_items i on i.plan_id = p.id
     where p.status = 'active'
       and exists (
         select 1 from student_guardians sg
         where sg.student_id = p.student_id
           and sg.guardian_user_id = $1
       )
     group by p.id, su.display_name
     order by p.created_at desc
     limit 10`,
    [userId],
  );

  const attempts = await pool.query(
    `select a.id,
            a.student_id,
            su.display_name as student_display_name,
            a.title,
            a.score_percent,
            a.weak_topics_jsonb,
            a.created_at
     from student_assessment_attempts a
     join students s on s.id = a.student_id
     join users su on su.id = s.user_id
     where exists (
       select 1 from student_guardians sg
       where sg.student_id = a.student_id
         and sg.guardian_user_id = $1
     )
     order by a.created_at desc
     limit 20`,
    [userId],
  );

  const curriculumAttempts = await queryCurriculumAttemptsForGuardian(userId);

  return c.json({
    students: students.rows,
    progress: progress.rows,
    masteryGraph: masteryGraph.rows,
    studyPlans: studyPlans.rows,
    attempts: attempts.rows,
    curriculumAttempts,
  });
});

/** Öğrenci hesabı: veli kullanıcısını kendi profiline bağlar */
guardians.post("/link", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "student") {
    return c.json({ error: "forbidden_students_only" }, 403);
  }

  const parsed = linkSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const gUser = await pool.query(
    `select id, role from users where id = $1`,
    [parsed.data.guardianUserId],
  );
  const gu = gUser.rows[0] as { id: string; role: string } | undefined;
  if (!gu || gu.role !== "guardian") {
    return c.json({ error: "invalid_guardian_user" }, 400);
  }

  const st = await pool.query(`select id from students where user_id = $1`, [
    userId,
  ]);
  if (!st.rowCount) {
    return c.json({ error: "student_profile_missing" }, 400);
  }
  const studentId = st.rows[0].id as string;

  try {
    const ins = await pool.query(
      `insert into student_guardians (student_id, guardian_user_id, relationship, is_primary)
       values ($1, $2, 'veli', false)
       on conflict (student_id, guardian_user_id) do nothing
       returning id`,
      [studentId, gu.id],
    );
    return c.json(
      {
        linked: (ins.rowCount ?? 0) > 0,
        studentId,
        guardianUserId: gu.id,
      },
      (ins.rowCount ?? 0) > 0 ? 201 : 200,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "link_failed";
    return c.json({ error: msg }, 400);
  }
});

const guardianEmailPrefsSchema = z.object({
  homeworkEnabled: z.boolean().optional(),
  lessonEnabled: z.boolean().optional(),
  paymentEnabled: z.boolean().optional(),
});

guardians.get("/email-preferences", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "guardian") return c.json({ error: "forbidden_guardians_only" }, 403);

  const r = await pool.query(
    `select homework_enabled, lesson_enabled, payment_enabled, updated_at
     from guardian_email_preferences
     where guardian_user_id = $1`,
    [userId],
  ).catch(() => ({ rows: [] }));

  const row = r.rows[0] as
    | { homework_enabled: boolean; lesson_enabled: boolean; payment_enabled: boolean; updated_at: string }
    | undefined;
  return c.json({
    preferences: {
      homeworkEnabled: row?.homework_enabled ?? true,
      lessonEnabled: row?.lesson_enabled ?? true,
      paymentEnabled: row?.payment_enabled ?? true,
      updatedAt: row?.updated_at ?? null,
    },
  });
});

guardians.patch("/email-preferences", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "guardian") return c.json({ error: "forbidden_guardians_only" }, 403);

  const parsed = guardianEmailPrefsSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const current = await pool.query(
    `select homework_enabled, lesson_enabled, payment_enabled
     from guardian_email_preferences where guardian_user_id = $1`,
    [userId],
  ).catch(() => ({ rows: [] }));

  const cur = current.rows[0] as
    | { homework_enabled: boolean; lesson_enabled: boolean; payment_enabled: boolean }
    | undefined;

  const homeworkEnabled = parsed.data.homeworkEnabled ?? cur?.homework_enabled ?? true;
  const lessonEnabled = parsed.data.lessonEnabled ?? cur?.lesson_enabled ?? true;
  const paymentEnabled = parsed.data.paymentEnabled ?? cur?.payment_enabled ?? true;

  await pool.query(
    `insert into guardian_email_preferences (guardian_user_id, homework_enabled, lesson_enabled, payment_enabled, updated_at)
     values ($1, $2, $3, $4, now())
     on conflict (guardian_user_id) do update
     set homework_enabled = excluded.homework_enabled,
         lesson_enabled = excluded.lesson_enabled,
         payment_enabled = excluded.payment_enabled,
         updated_at = now()`,
    [userId, homeworkEnabled, lessonEnabled, paymentEnabled],
  );

  return c.json({
    preferences: { homeworkEnabled, lessonEnabled, paymentEnabled },
  });
});
