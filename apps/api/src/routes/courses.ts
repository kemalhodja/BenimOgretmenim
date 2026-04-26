import { randomBytes } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import { pool } from "../db.js";
import type { AppVariables } from "../types.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { applyWalletDelta } from "../lib/wallet.js";
import { getWalletAvailableMinor } from "../lib/walletHolds.js";

export const courses = new Hono<{ Variables: AppVariables }>();

function meetingBase(): string {
  return (process.env.MEETING_BASE_URL ?? "https://meet.jit.si").replace(/\/$/, "");
}

const createCourseSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(10000).optional().nullable(),
  branchId: z.number().int().positive().optional().nullable(),
  deliveryMode: z.enum(["online", "in_person", "hybrid"]).optional(),
  languageCode: z.string().min(2).max(10).optional(),
  priceMinor: z.number().int().min(0).optional(),
  currency: z.string().length(3).optional(),
});

/** Öğretmen: kurs oluştur */
courses.post("/", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "teacher") return c.json({ error: "forbidden_teachers_only" }, 403);

  const parsed = createCourseSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const tr = await pool.query(`select id from teachers where user_id = $1`, [userId]);
  if (!tr.rowCount) return c.json({ error: "teacher_profile_missing" }, 400);
  const teacherId = tr.rows[0].id as string;

  const body = parsed.data;
  const ins = await pool.query(
    `insert into courses (
       teacher_id, branch_id, title, description,
       delivery_mode, language_code, price_minor, currency, status
     ) values ($1, $2, $3, $4, $5::lesson_delivery_mode, $6, $7, $8, 'draft')
     returning id, title, status, created_at`,
    [
      teacherId,
      body.branchId ?? null,
      body.title.trim(),
      body.description?.trim() || null,
      body.deliveryMode ?? "online",
      body.languageCode ?? "tr",
      body.priceMinor ?? 0,
      (body.currency ?? "TRY").toUpperCase(),
    ],
  );
  return c.json({ course: ins.rows[0] }, 201);
});

/** Öğretmen: kurslarım */
courses.get("/mine", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "teacher") return c.json({ error: "forbidden_teachers_only" }, 403);

  const tr = await pool.query(`select id from teachers where user_id = $1`, [userId]);
  if (!tr.rowCount) return c.json({ courses: [] });
  const teacherId = tr.rows[0].id as string;

  const r = await pool.query(
    `select c.id, c.title, c.status, c.delivery_mode, c.language_code, c.price_minor, c.currency,
            c.branch_id, b.name as branch_name,
            c.created_at, c.updated_at
     from courses c
     left join branches b on b.id = c.branch_id
     where c.teacher_id = $1
     order by c.created_at desc
     limit 50`,
    [teacherId],
  );
  return c.json({ courses: r.rows });
});

/** Öğrenci: kayıtlı kurslar (cohort) + sıradaki planlı oturum özeti */
courses.get("/student/mine", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "student") return c.json({ error: "forbidden_students_only" }, 403);

  const sr = await pool.query(`select id from students where user_id = $1`, [userId]);
  if (!sr.rowCount) return c.json({ enrollments: [] });
  const studentId = sr.rows[0].id as string;

  const r = await pool.query(
    `select e.id as enrollment_id,
            e.enrolled_at,
            c.id as course_id,
            c.title as course_title,
            c.status as course_status,
            cc.id as cohort_id,
            cc.title as cohort_title,
            cc.status as cohort_status,
            u.display_name as teacher_display_name,
            ns.id as next_session_id,
            ns.session_index as next_session_index,
            ns.title as next_session_title,
            ns.scheduled_start as next_scheduled_start,
            ns.meeting_url as next_meeting_url
     from course_enrollments e
     join course_cohorts cc on cc.id = e.cohort_id
     join courses c on c.id = cc.course_id
     join teachers t on t.id = c.teacher_id
     join users u on u.id = t.user_id
     left join lateral (
       select s.id, s.session_index, s.title, s.scheduled_start, s.meeting_url
       from course_sessions s
       where s.cohort_id = cc.id
         and s.status = 'scheduled'::course_session_status
       order by (s.scheduled_start is null) asc,
                s.scheduled_start asc nulls last,
                s.session_index asc
       limit 1
     ) ns on true
     where e.student_id = $1
     order by e.enrolled_at desc
     limit 50`,
    [studentId],
  );
  return c.json({ enrollments: r.rows });
});

const publishSchema = z.object({ status: z.enum(["draft", "published", "archived"]) });

/** Öğretmen: kurs statüsü */
courses.patch("/:courseId/status", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "teacher") return c.json({ error: "forbidden_teachers_only" }, 403);

  const courseId = c.req.param("courseId");
  if (!z.string().uuid().safeParse(courseId).success) return c.json({ error: "invalid_course_id" }, 400);
  const parsed = publishSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const tr = await pool.query(`select id from teachers where user_id = $1`, [userId]);
  if (!tr.rowCount) return c.json({ error: "teacher_profile_missing" }, 400);
  const teacherId = tr.rows[0].id as string;

  const r = await pool.query(
    `update courses
     set status = $3::course_status, updated_at = now()
     where id = $1 and teacher_id = $2
     returning id, status`,
    [courseId, teacherId, parsed.data.status],
  );
  if (!r.rowCount) return c.json({ error: "not_found_or_forbidden" }, 404);
  return c.json({ course: r.rows[0] });
});

const createCohortSchema = z.object({
  title: z.string().min(3).max(120),
  capacity: z.number().int().min(1).max(500).optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  schedule: z.record(z.string(), z.any()).optional(),
});

/** Öğretmen: cohort aç */
courses.post("/:courseId/cohorts", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "teacher") return c.json({ error: "forbidden_teachers_only" }, 403);

  const courseId = c.req.param("courseId");
  if (!z.string().uuid().safeParse(courseId).success) return c.json({ error: "invalid_course_id" }, 400);
  const parsed = createCohortSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const tr = await pool.query(`select id from teachers where user_id = $1`, [userId]);
  if (!tr.rowCount) return c.json({ error: "teacher_profile_missing" }, 400);
  const teacherId = tr.rows[0].id as string;

  const own = await pool.query(`select 1 from courses where id = $1 and teacher_id = $2`, [courseId, teacherId]);
  if (!own.rowCount) return c.json({ error: "not_found_or_forbidden" }, 404);

  const body = parsed.data;
  const ins = await pool.query(
    `insert into course_cohorts (
       course_id, title, capacity, starts_at, ends_at, schedule_jsonb, status
     ) values ($1, $2, $3, $4, $5, $6::jsonb, 'planned')
     returning id, title, status, starts_at, capacity, created_at`,
    [
      courseId,
      body.title.trim(),
      body.capacity ?? null,
      body.startsAt ? new Date(body.startsAt) : null,
      body.endsAt ? new Date(body.endsAt) : null,
      JSON.stringify(body.schedule ?? {}),
    ],
  );
  return c.json({ cohort: ins.rows[0] }, 201);
});

const patchCohortSchema = z.object({
  status: z.enum(["planned", "active", "completed", "cancelled"]).optional(),
  title: z.string().min(3).max(120).optional(),
  capacity: z.number().int().min(1).max(500).nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

/** Öğretmen: cohort güncelle */
courses.patch("/:courseId/cohorts/:cohortId", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "teacher") return c.json({ error: "forbidden_teachers_only" }, 403);

  const courseId = c.req.param("courseId");
  const cohortId = c.req.param("cohortId");
  if (!z.string().uuid().safeParse(courseId).success) return c.json({ error: "invalid_course_id" }, 400);
  if (!z.string().uuid().safeParse(cohortId).success) return c.json({ error: "invalid_cohort_id" }, 400);

  const parsed = patchCohortSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const tr = await pool.query(`select id from teachers where user_id = $1`, [userId]);
  if (!tr.rowCount) return c.json({ error: "teacher_profile_missing" }, 400);
  const teacherId = tr.rows[0].id as string;

  const sets: string[] = [];
  const vals: unknown[] = [];
  let p = 1;
  const b = parsed.data;
  if (b.status !== undefined) {
    sets.push(`status = $${p}::cohort_status`);
    vals.push(b.status);
    p++;
  }
  if (b.title !== undefined) {
    sets.push(`title = $${p}`);
    vals.push(b.title.trim());
    p++;
  }
  if (b.capacity !== undefined) {
    sets.push(`capacity = $${p}`);
    vals.push(b.capacity);
    p++;
  }
  if (b.startsAt !== undefined) {
    sets.push(`starts_at = $${p}`);
    vals.push(b.startsAt ? new Date(b.startsAt) : null);
    p++;
  }
  if (b.endsAt !== undefined) {
    sets.push(`ends_at = $${p}`);
    vals.push(b.endsAt ? new Date(b.endsAt) : null);
    p++;
  }
  if (!sets.length) return c.json({ error: "no_updates" }, 400);

  sets.push("updated_at = now()");
  const w1 = p;
  const w2 = p + 1;
  const w3 = p + 2;
  vals.push(cohortId, courseId, teacherId);

  const r = await pool.query(
    `update course_cohorts cc
     set ${sets.join(", ")}
     from courses c
     where cc.id = $${w1}
       and cc.course_id = $${w2}
       and c.id = cc.course_id
       and c.teacher_id = $${w3}
     returning cc.id, cc.title, cc.status, cc.capacity, cc.starts_at, cc.ends_at`,
    vals,
  );
  if (!r.rowCount) return c.json({ error: "not_found_or_forbidden" }, 404);
  return c.json({ cohort: r.rows[0] });
});

/** Öğretmen: kurs + tüm cohortlar (taslak dahil) */
courses.get("/:courseId/manage", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "teacher") return c.json({ error: "forbidden_teachers_only" }, 403);

  const courseId = c.req.param("courseId");
  if (!z.string().uuid().safeParse(courseId).success) return c.json({ error: "invalid_course_id" }, 400);

  const tr = await pool.query(`select id from teachers where user_id = $1`, [userId]);
  if (!tr.rowCount) return c.json({ error: "teacher_profile_missing" }, 400);
  const teacherId = tr.rows[0].id as string;

  const cr = await pool.query(
    `select c.id, c.title, c.description, c.status, c.delivery_mode, c.language_code, c.price_minor, c.currency,
            c.branch_id, b.name as branch_name, c.created_at, c.updated_at
     from courses c
     left join branches b on b.id = c.branch_id
     where c.id = $1 and c.teacher_id = $2`,
    [courseId, teacherId],
  );
  if (!cr.rowCount) return c.json({ error: "not_found_or_forbidden" }, 404);

  const coh = await pool.query(
    `select cc.id, cc.title, cc.status, cc.capacity, cc.starts_at, cc.ends_at, cc.created_at,
            (select count(*)::int from course_enrollments e where e.cohort_id = cc.id) as enrolled_count,
            (select count(*)::int from course_sessions s where s.cohort_id = cc.id) as session_count
     from course_cohorts cc
     where cc.course_id = $1
     order by cc.starts_at nulls last, cc.created_at desc
     limit 100`,
    [courseId],
  );

  return c.json({ course: cr.rows[0], cohorts: coh.rows });
});

/** Öğretmen veya kayıtlı öğrenci: cohort özeti + kayıtlar */
courses.get("/:courseId/cohorts/:cohortId", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  const courseId = c.req.param("courseId");
  const cohortId = c.req.param("cohortId");
  if (!z.string().uuid().safeParse(courseId).success) return c.json({ error: "invalid_course_id" }, 400);
  if (!z.string().uuid().safeParse(cohortId).success) return c.json({ error: "invalid_cohort_id" }, 400);

  const base = await pool.query(
    `select cc.id, cc.title, cc.status, cc.capacity, cc.starts_at, cc.ends_at, cc.created_at,
            c.id as course_id, c.title as course_title, c.teacher_id
     from course_cohorts cc
     join courses c on c.id = cc.course_id
     where cc.id = $1 and cc.course_id = $2`,
    [cohortId, courseId],
  );
  if (!base.rowCount) return c.json({ error: "not_found" }, 404);
  let isTeacher = false;
  let isEnrolledStudent = false;
  if (role === "teacher") {
    const tr = await pool.query(`select id from teachers where user_id = $1`, [userId]);
    if (tr.rowCount) {
      const tid = tr.rows[0].id as string;
      const own = await pool.query(`select 1 from courses where id = $1 and teacher_id = $2`, [courseId, tid]);
      isTeacher = !!own.rowCount;
    }
  } else if (role === "student") {
    const sr = await pool.query(`select id from students where user_id = $1`, [userId]);
    if (sr.rowCount) {
      const sid = sr.rows[0].id as string;
      const en = await pool.query(
        `select 1 from course_enrollments where cohort_id = $1 and student_id = $2`,
        [cohortId, sid],
      );
      isEnrolledStudent = !!en.rowCount;
    }
  }

  if (!isTeacher && !isEnrolledStudent) return c.json({ error: "forbidden" }, 403);

  const enrollments = isTeacher
    ? await pool.query(
        `select e.id, e.enrolled_at, s.id as student_id, u.display_name as student_display_name
         from course_enrollments e
         join students s on s.id = e.student_id
         join users u on u.id = s.user_id
         where e.cohort_id = $1
         order by e.enrolled_at desc
         limit 200`,
        [cohortId],
      )
    : { rows: [] as unknown[] };

  return c.json({
    cohort: base.rows[0],
    enrollments: enrollments.rows,
    viewer: { role: isTeacher ? "teacher" : "student" },
  });
});

const createCourseSessionSchema = z.object({
  title: z.string().max(200).optional().nullable(),
});

/** Öğretmen: cohort için yeni ders oturumu */
courses.post("/:courseId/cohorts/:cohortId/sessions", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "teacher") return c.json({ error: "forbidden_teachers_only" }, 403);

  const courseId = c.req.param("courseId");
  const cohortId = c.req.param("cohortId");
  if (!z.string().uuid().safeParse(courseId).success) return c.json({ error: "invalid_course_id" }, 400);
  if (!z.string().uuid().safeParse(cohortId).success) return c.json({ error: "invalid_cohort_id" }, 400);

  const parsed = createCourseSessionSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const tr = await pool.query(`select id from teachers where user_id = $1`, [userId]);
  if (!tr.rowCount) return c.json({ error: "teacher_profile_missing" }, 400);
  const teacherId = tr.rows[0].id as string;

  const own = await pool.query(
    `select 1 from course_cohorts cc
     join courses c on c.id = cc.course_id
     where cc.id = $1 and cc.course_id = $2 and c.teacher_id = $3`,
    [cohortId, courseId, teacherId],
  );
  if (!own.rowCount) return c.json({ error: "not_found_or_forbidden" }, 404);

  const title = parsed.data.title?.trim() || null;
  const ins = await pool.query(
    `insert into course_sessions (cohort_id, session_index, title, status)
     select $1::uuid,
            coalesce((select max(session_index) from course_sessions where cohort_id = $1::uuid), 0) + 1,
            $2,
            'scheduled'::course_session_status
     returning id, session_index, title, status, scheduled_start, duration_minutes, meeting_url, created_at`,
    [cohortId, title],
  );
  return c.json({ session: ins.rows[0] }, 201);
});

/** Öğretmen veya kayıtlı öğrenci: cohort oturumları */
courses.get("/:courseId/cohorts/:cohortId/sessions", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  const courseId = c.req.param("courseId");
  const cohortId = c.req.param("cohortId");
  if (!z.string().uuid().safeParse(courseId).success) return c.json({ error: "invalid_course_id" }, 400);
  if (!z.string().uuid().safeParse(cohortId).success) return c.json({ error: "invalid_cohort_id" }, 400);

  const base = await pool.query(
    `select cc.id, c.teacher_id,
            tt.user_id as teacher_user_id
     from course_cohorts cc
     join courses c on c.id = cc.course_id
     join teachers t on t.id = c.teacher_id
     join users tt on tt.id = t.user_id
     where cc.id = $1 and cc.course_id = $2`,
    [cohortId, courseId],
  );
  if (!base.rowCount) return c.json({ error: "not_found" }, 404);
  const teacherUserId = base.rows[0].teacher_user_id as string;

  let allowed = userId === teacherUserId;
  if (!allowed && role === "teacher") {
    const tr = await pool.query(`select id from teachers where user_id = $1`, [userId]);
    if (tr.rowCount && tr.rows[0].id === base.rows[0].teacher_id) allowed = true;
  }
  if (!allowed && role === "student") {
    const sr = await pool.query(`select id from students where user_id = $1`, [userId]);
    if (sr.rowCount) {
      const en = await pool.query(
        `select 1 from course_enrollments where cohort_id = $1 and student_id = $2`,
        [cohortId, sr.rows[0].id],
      );
      allowed = !!en.rowCount;
    }
  }
  if (!allowed) return c.json({ error: "forbidden" }, 403);

  const r = await pool.query(
    `select id, session_index, title, scheduled_start, scheduled_end, duration_minutes,
            delivery_mode, meeting_url, status, created_at, updated_at
     from course_sessions
     where cohort_id = $1
     order by session_index asc`,
    [cohortId],
  );
  return c.json({ sessions: r.rows });
});

const scheduleCourseSessionSchema = z.object({
  scheduledStart: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(240).optional().default(60),
});

/** Öğretmen: kurs oturumunu planla */
courses.post("/:courseId/cohorts/:cohortId/sessions/:sessionId/schedule", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "teacher") return c.json({ error: "forbidden_teachers_only" }, 403);

  const courseId = c.req.param("courseId");
  const cohortId = c.req.param("cohortId");
  const sessionId = c.req.param("sessionId");
  if (!z.string().uuid().safeParse(courseId).success) return c.json({ error: "invalid_course_id" }, 400);
  if (!z.string().uuid().safeParse(cohortId).success) return c.json({ error: "invalid_cohort_id" }, 400);
  if (!z.string().uuid().safeParse(sessionId).success) return c.json({ error: "invalid_session_id" }, 400);

  const parsed = scheduleCourseSessionSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const tr = await pool.query(`select id from teachers where user_id = $1`, [userId]);
  if (!tr.rowCount) return c.json({ error: "teacher_profile_missing" }, 400);
  const teacherId = tr.rows[0].id as string;

  const start = new Date(parsed.data.scheduledStart);
  const duration = parsed.data.durationMinutes;
  const end = new Date(start.getTime() + duration * 60_000);
  const meet = `${meetingBase()}/bm-course-${sessionId}`;

  const r = await pool.query(
    `update course_sessions cs
     set scheduled_start = $5,
         scheduled_end = $6,
         duration_minutes = $7,
         meeting_url = $8,
         updated_at = now()
     from course_cohorts cc
     join courses c on c.id = cc.course_id
     where cs.id = $1
       and cs.cohort_id = $2::uuid
       and cc.id = $2::uuid
       and cc.course_id = $3::uuid
       and c.teacher_id = $4
     returning cs.id, cs.session_index, cs.scheduled_start, cs.scheduled_end, cs.duration_minutes, cs.meeting_url`,
    [sessionId, cohortId, courseId, teacherId, start, end, duration, meet],
  );
  if (!r.rowCount) return c.json({ error: "not_found_or_forbidden" }, 404);
  return c.json({ session: r.rows[0] });
});

/** Public: yayınlı kurslar listesi */
courses.get("/", async (c) => {
  const limit = Math.min(50, Math.max(1, Number(c.req.query("limit") ?? "20") || 20));
  const offset = Math.max(0, Number(c.req.query("offset") ?? "0") || 0);
  const r = await pool.query(
    `select c.id, c.title, c.delivery_mode, c.language_code, c.price_minor, c.currency,
            c.branch_id, b.name as branch_name,
            t.id as teacher_id, u.display_name as teacher_display_name,
            c.created_at
     from courses c
     join teachers t on t.id = c.teacher_id
     join users u on u.id = t.user_id
     left join branches b on b.id = c.branch_id
     where c.status = 'published'
     order by c.created_at desc
     limit $1 offset $2`,
    [limit, offset],
  );
  return c.json({ courses: r.rows, limit, offset });
});

/** Öğrenci: cohort'a kayıt */
courses.post("/:courseId/cohorts/:cohortId/enroll", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "student") return c.json({ error: "forbidden_students_only" }, 403);

  const courseId = c.req.param("courseId");
  const cohortId = c.req.param("cohortId");
  if (!z.string().uuid().safeParse(courseId).success) return c.json({ error: "invalid_course_id" }, 400);
  if (!z.string().uuid().safeParse(cohortId).success) return c.json({ error: "invalid_cohort_id" }, 400);

  const sr = await pool.query(`select id from students where user_id = $1`, [userId]);
  if (!sr.rowCount) return c.json({ error: "student_profile_missing" }, 400);
  const studentId = sr.rows[0].id as string;

  const row = await pool.query(
    `select cc.id, cc.capacity,
            c.price_minor, c.currency,
            (select count(*)::int from course_enrollments e where e.cohort_id = cc.id) as enrolled_count
     from course_cohorts cc
     join courses c on c.id = cc.course_id
     where c.id = $1 and c.status = 'published'
       and cc.id = $2 and cc.course_id = $1
       and cc.status in ('planned', 'active')`,
    [courseId, cohortId],
  );
  if (!row.rowCount) return c.json({ error: "not_found" }, 404);

  const cap = row.rows[0].capacity as number | null;
  const enrolled = row.rows[0].enrolled_count as number;
  const priceMinor = row.rows[0].price_minor as number;
  const currency = row.rows[0].currency as string;
  if (cap != null && enrolled >= cap) return c.json({ error: "cohort_full" }, 409);

  const already = await pool.query(
    `select 1 from course_enrollments where cohort_id = $1 and student_id = $2`,
    [cohortId, studentId],
  );
  if (already.rowCount) return c.json({ error: "already_enrolled" }, 409);

  if (priceMinor <= 0) {
    const ins = await pool.query(
      `insert into course_enrollments (cohort_id, student_id) values ($1, $2)
       returning id, enrolled_at`,
      [cohortId, studentId],
    );
    return c.json({ enrollment: ins.rows[0], free: true }, 201);
  }

  if (currency !== "TRY") return c.json({ error: "currency_not_supported" }, 409);

  const client = await pool.connect();
  try {
    await client.query("begin");
    const available = await getWalletAvailableMinor(userId, client);
    if (available < BigInt(priceMinor)) {
      await client.query("rollback");
      return c.json({ error: "insufficient_balance", neededMinor: priceMinor }, 409);
    }

    await applyWalletDelta({
      userId,
      deltaMinor: -priceMinor,
      kind: "course_enroll_charge",
      refType: "course_cohort",
      refId: cohortId,
      metadata: { courseId, cohortId, amountMinor: priceMinor, currency },
      client,
    });

    const ins = await client.query(
      `insert into course_enrollments (cohort_id, student_id) values ($1, $2)
       returning id, enrolled_at`,
      [cohortId, studentId],
    );
    await client.query("commit");
    return c.json({ enrollment: ins.rows[0] }, 201);
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
});

/** Public: kurs detayı + cohortlar (yalnızca published) — en sonda: /:courseId diğer GET'lerden sonra */
courses.get("/:courseId", async (c) => {
  const courseId = c.req.param("courseId");
  if (!z.string().uuid().safeParse(courseId).success) return c.json({ error: "invalid_course_id" }, 400);

  const cr = await pool.query(
    `select c.id, c.title, c.description, c.delivery_mode, c.language_code, c.price_minor, c.currency,
            c.branch_id, b.name as branch_name,
            t.id as teacher_id, u.display_name as teacher_display_name
     from courses c
     join teachers t on t.id = c.teacher_id
     join users u on u.id = t.user_id
     left join branches b on b.id = c.branch_id
     where c.id = $1 and c.status = 'published'`,
    [courseId],
  );
  if (!cr.rowCount) return c.json({ error: "not_found" }, 404);

  const coh = await pool.query(
    `select cc.id, cc.title, cc.status, cc.capacity, cc.starts_at, cc.ends_at, cc.created_at,
            (select count(*)::int from course_enrollments e where e.cohort_id = cc.id) as enrolled_count
     from course_cohorts cc
     where cc.course_id = $1 and cc.status in ('planned', 'active')
     order by cc.starts_at nulls last, cc.created_at desc
     limit 50`,
    [courseId],
  );

  return c.json({ course: cr.rows[0], cohorts: coh.rows });
});
