import { randomBytes } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import { pool } from "../db.js";
import type { AppVariables } from "../types.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { getWalletAvailableMinor } from "../lib/walletHolds.js";
import { holdCourseEnrollmentPayment } from "../lib/courseEnrollmentWallet.js";

export const courses = new Hono<{ Variables: AppVariables }>();

function meetingBase(): string {
  return (process.env.MEETING_BASE_URL ?? "https://meet.jit.si").replace(/\/$/, "");
}

async function notifyCourseSessionRecipients({
  courseId,
  cohortId,
  sessionId,
  courseTitle,
  cohortTitle,
  sessionIndex,
  scheduledStart,
}: {
  courseId: string;
  cohortId: string;
  sessionId: string;
  courseTitle: string;
  cohortTitle: string;
  sessionIndex: number;
  scheduledStart: Date;
}) {
  await pool.query(
    `insert into parent_notifications (
       recipient_user_id, student_id, snapshot_id, channel,
       title, body, payload_jsonb, delivery_status, sent_at
     )
     select recipient_user_id,
            student_id,
            null,
            'in_app',
            'Kurs dersi planlandı',
            concat($4::text, ' / ', $5::text, ' dersi #', $6::int, ' ',
                   to_char($7::timestamptz, 'DD.MM.YYYY HH24:MI'),
                   ' için planlandı. Sınıf linki kurs panelinizde hazır.'),
            jsonb_build_object(
              'kind', 'course_session_scheduled',
              'courseId', $1::uuid,
              'cohortId', $2::uuid,
              'courseSessionId', $3::uuid,
              'scheduledStart', $7::timestamptz,
              'classroomHref', concat('/classroom/course/', $3::uuid)
            ),
            'sent',
            now()
     from (
       select st.user_id as recipient_user_id,
              st.id as student_id
       from course_enrollments ce
       join students st on st.id = ce.student_id
       where ce.cohort_id = $2::uuid
       union
       select sg.guardian_user_id as recipient_user_id,
              st.id as student_id
       from course_enrollments ce
       join students st on st.id = ce.student_id
       join student_guardians sg on sg.student_id = st.id
       where ce.cohort_id = $2::uuid
     ) recipients`,
    [courseId, cohortId, sessionId, courseTitle, cohortTitle, sessionIndex, scheduledStart],
  );
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

const applicationNoteSchema = z.object({
  message: z.string().max(2000).optional().nullable(),
  experienceNote: z.string().max(2000).optional().nullable(),
  goalNote: z.string().max(2000).optional().nullable(),
  guardianNote: z.string().max(2000).optional().nullable(),
  cohortId: z.string().uuid().optional().nullable(),
});

function scheduleLabel(row: Record<string, unknown>): string {
  const start = row.scheduled_start ? new Date(String(row.scheduled_start)) : null;
  const end = row.scheduled_end ? new Date(String(row.scheduled_end)) : null;
  if (!start) return "Ders saati admin tarafından netleştirilecek";
  const day = new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "2-digit", month: "long" }).format(start);
  const startTime = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" }).format(start);
  const endTime = end ? new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" }).format(end) : null;
  return endTime ? `${day} ${startTime}-${endTime}` : `${day} ${startTime}`;
}

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
            c.created_at, c.updated_at,
            (
              select count(*)::int
              from course_cohorts cc
              where cc.course_id = c.id
            ) as cohort_count,
            (
              select count(*)::int
              from course_cohorts cc
              where cc.course_id = c.id and cc.status = 'active'
            ) as active_cohort_count,
            (
              select count(*)::int
              from course_enrollments ce
              join course_cohorts cc on cc.id = ce.cohort_id
              where cc.course_id = c.id
            ) as enrollment_count,
            ns.id as next_session_id,
            ns.session_index as next_session_index,
            ns.title as next_session_title,
            ns.scheduled_start as next_scheduled_start,
            ns.meeting_url as next_meeting_url,
            ns.cohort_title as next_cohort_title
     from courses c
     left join branches b on b.id = c.branch_id
     left join lateral (
       select s.id, s.session_index, s.title, s.scheduled_start, s.meeting_url, cc.title as cohort_title
       from course_cohorts cc
       join course_sessions s on s.cohort_id = cc.id
       where cc.course_id = c.id
         and s.status = 'scheduled'
       order by (s.scheduled_start is null) asc,
                s.scheduled_start asc nulls last,
                s.session_index asc
       limit 1
     ) ns on true
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
            coalesce(u.display_name, 'Öğretmen seçilecek') as teacher_display_name,
            ns.id as next_session_id,
            ns.session_index as next_session_index,
            ns.title as next_session_title,
            ns.scheduled_start as next_scheduled_start,
            ns.meeting_url as next_meeting_url,
            e.price_minor as enrollment_price_minor,
            e.currency as enrollment_currency,
            e.payment_status as enrollment_payment_status,
            e.charged_at as enrollment_charged_at
     from course_enrollments e
     join course_cohorts cc on cc.id = e.cohort_id
     join courses c on c.id = cc.course_id
     left join teachers t on t.id = c.teacher_id
     left join users u on u.id = t.user_id
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

/** Öğretmen: adminin açtığı kurs kampanyaları */
courses.get("/teacher/admin-campaigns", requireAuth, async (c) => {
  const role = c.get("userRole");
  const userId = c.get("userId");
  if (role !== "teacher") return c.json({ error: "forbidden_teachers_only" }, 403);

  const tr = await pool.query(`select id from teachers where user_id = $1`, [userId]);
  if (!tr.rowCount) return c.json({ campaigns: [] });
  const teacherId = tr.rows[0].id as string;

  const r = await pool.query(
    `select c.id, c.title, c.description, c.status::text as status, c.delivery_mode::text as delivery_mode,
            c.language_code, c.teacher_hourly_rate_minor, c.currency, c.branch_id, b.name as branch_name,
            c.campaign_details_jsonb, c.application_status, c.created_at,
            ta.id as teacher_application_id, ta.status as teacher_application_status,
            co.id as cohort_id, co.title as cohort_title, co.capacity, co.starts_at, co.ends_at,
            (
              select jsonb_agg(jsonb_build_object(
                'id', cs.id,
                'title', cs.title,
                'sessionIndex', cs.session_index,
                'scheduledStart', cs.scheduled_start,
                'scheduledEnd', cs.scheduled_end,
                'durationMinutes', cs.duration_minutes,
                'label', to_char(cs.scheduled_start, 'DD.MM.YYYY HH24:MI')
              ) order by cs.session_index)
              from course_sessions cs
              where cs.cohort_id = co.id
            ) as sessions_jsonb
     from courses c
     left join branches b on b.id = c.branch_id
     left join course_teacher_applications ta on ta.course_id = c.id and ta.teacher_id = $1
     left join lateral (
       select cc.id, cc.title, cc.capacity, cc.starts_at, cc.ends_at
       from course_cohorts cc
       where cc.course_id = c.id
       order by cc.starts_at nulls last, cc.created_at asc
       limit 1
     ) co on true
     where c.origin = 'admin_campaign'
       and c.status = 'published'
       and c.application_status = 'open'
     order by c.created_at desc
     limit 50`,
    [teacherId],
  );
  return c.json({ campaigns: r.rows });
});

/** Öğretmen: admin kurs kampanyasına eğitmenlik başvurusu */
courses.post("/:courseId/teacher-applications", requireAuth, async (c) => {
  const role = c.get("userRole");
  const userId = c.get("userId");
  if (role !== "teacher") return c.json({ error: "forbidden_teachers_only" }, 403);
  const courseId = c.req.param("courseId");
  if (!z.string().uuid().safeParse(courseId).success) return c.json({ error: "invalid_course_id" }, 400);
  const parsed = applicationNoteSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const tr = await pool.query(`select id from teachers where user_id = $1`, [userId]);
  if (!tr.rowCount) return c.json({ error: "teacher_profile_missing" }, 400);
  const teacherId = tr.rows[0].id as string;

  const course = await pool.query(
    `select 1 from courses
     where id = $1 and origin = 'admin_campaign' and status = 'published' and application_status = 'open'`,
    [courseId],
  );
  if (!course.rowCount) return c.json({ error: "campaign_not_open" }, 404);

  const ins = await pool.query(
    `insert into course_teacher_applications (course_id, teacher_id, message, experience_note)
     values ($1, $2, $3, $4)
     on conflict (course_id, teacher_id) do nothing
     returning id, course_id, teacher_id, status, created_at, updated_at`,
    [
      courseId,
      teacherId,
      parsed.data.message?.trim() || null,
      parsed.data.experienceNote?.trim() || null,
    ],
  );
  if (!ins.rowCount) return c.json({ error: "already_applied" }, 409);
  return c.json({ application: ins.rows[0] }, 201);
});

/** Öğrenci: admin kurs kampanyası ön kayıt başvurusu */
courses.post("/:courseId/student-applications", requireAuth, async (c) => {
  const role = c.get("userRole");
  const userId = c.get("userId");
  if (role !== "student") return c.json({ error: "forbidden_students_only" }, 403);
  const courseId = c.req.param("courseId");
  if (!z.string().uuid().safeParse(courseId).success) return c.json({ error: "invalid_course_id" }, 400);
  const parsed = applicationNoteSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const sr = await pool.query(`select id from students where user_id = $1`, [userId]);
  if (!sr.rowCount) return c.json({ error: "student_profile_missing" }, 400);
  const studentId = sr.rows[0].id as string;

  const campaign = await pool.query(
    `select c.id, cc.id as default_cohort_id
     from courses c
     left join lateral (
       select id from course_cohorts
       where course_id = c.id and status in ('planned', 'active')
       order by starts_at nulls last, created_at asc
       limit 1
     ) cc on true
     where c.id = $1 and c.origin = 'admin_campaign' and c.status = 'published' and c.application_status = 'open'`,
    [courseId],
  );
  if (!campaign.rowCount) return c.json({ error: "campaign_not_open" }, 404);
  let cohortId = parsed.data.cohortId ?? (campaign.rows[0].default_cohort_id as string | null);
  if (cohortId) {
    const cohort = await pool.query(
      `select 1 from course_cohorts
       where id = $1 and course_id = $2 and status in ('planned', 'active')`,
      [cohortId, courseId],
    );
    if (!cohort.rowCount) return c.json({ error: "invalid_campaign_cohort" }, 400);
  } else {
    cohortId = null;
  }

  const ins = await pool.query(
    `insert into course_student_applications (course_id, cohort_id, student_id, goal_note, guardian_note)
     values ($1, $2, $3, $4, $5)
     on conflict (course_id, student_id) do nothing
     returning id, course_id, cohort_id, student_id, status, created_at, updated_at`,
    [
      courseId,
      cohortId,
      studentId,
      parsed.data.goalNote?.trim() || null,
      parsed.data.guardianNote?.trim() || null,
    ],
  );
  if (!ins.rowCount) return c.json({ error: "already_applied" }, 409);
  return c.json({ application: ins.rows[0] }, 201);
});

/** Öğrenci: kurs kampanyası ön kayıt başvurularım */
courses.get("/student/applications", requireAuth, async (c) => {
  const role = c.get("userRole");
  const userId = c.get("userId");
  if (role !== "student") return c.json({ error: "forbidden_students_only" }, 403);
  const sr = await pool.query(`select id from students where user_id = $1`, [userId]);
  if (!sr.rowCount) return c.json({ applications: [] });
  const r = await pool.query(
    `select sa.id, sa.status, sa.created_at, sa.updated_at,
            c.id as course_id, c.title as course_title, c.price_minor, c.currency,
            cc.title as cohort_title, cc.starts_at
     from course_student_applications sa
     join courses c on c.id = sa.course_id
     left join course_cohorts cc on cc.id = sa.cohort_id
     where sa.student_id = $1
     order by sa.created_at desc
     limit 50`,
    [sr.rows[0].id],
  );
  return c.json({ applications: r.rows });
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
            (select count(*)::int from course_enrollments e where e.cohort_id = cc.id and e.payment_status not in ('cancelled', 'refunded')) as enrolled_count,
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
        `select 1 from course_enrollments where cohort_id = $1 and student_id = $2 and payment_status not in ('cancelled', 'refunded')`,
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
        `select 1 from course_enrollments where cohort_id = $1 and student_id = $2 and payment_status not in ('cancelled', 'refunded')`,
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
     returning cs.id, cs.session_index, cs.scheduled_start, cs.scheduled_end, cs.duration_minutes, cs.meeting_url,
               c.title as course_title, cc.title as cohort_title`,
    [sessionId, cohortId, courseId, teacherId, start, end, duration, meet],
  );
  if (!r.rowCount) return c.json({ error: "not_found_or_forbidden" }, 404);
  const row = r.rows[0] as {
    id: string;
    session_index: number;
    course_title: string;
    cohort_title: string;
  };
  await notifyCourseSessionRecipients({
    courseId,
    cohortId,
    sessionId: row.id,
    courseTitle: row.course_title,
    cohortTitle: row.cohort_title,
    sessionIndex: row.session_index,
    scheduledStart: start,
  });
  return c.json({ session: r.rows[0] });
});

/** Public: yayınlı kurslar listesi */
courses.get("/", async (c) => {
  const limit = Math.min(50, Math.max(1, Number(c.req.query("limit") ?? "20") || 20));
  const offset = Math.max(0, Number(c.req.query("offset") ?? "0") || 0);
  const r = await pool.query(
    `select c.id, c.title, c.delivery_mode, c.language_code, c.price_minor, c.currency,
            c.origin, c.application_status, c.branch_id, b.name as branch_name,
            t.id as teacher_id, coalesce(u.display_name, 'Öğretmen seçilecek') as teacher_display_name,
            c.created_at
     from courses c
     left join teachers t on t.id = c.teacher_id
     left join users u on u.id = t.user_id
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
            c.price_minor, c.currency, c.origin,
            (select count(*)::int from course_enrollments e where e.cohort_id = cc.id and e.payment_status not in ('cancelled', 'refunded')) as enrolled_count
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
  if (row.rows[0].origin === "admin_campaign") {
    return c.json({ error: "admin_campaign_requires_application" }, 409);
  }
  if (cap != null && enrolled >= cap) return c.json({ error: "cohort_full" }, 409);

  const already = await pool.query(
    `select 1 from course_enrollments where cohort_id = $1 and student_id = $2 and payment_status not in ('cancelled', 'refunded')`,
    [cohortId, studentId],
  );
  if (already.rowCount) return c.json({ error: "already_enrolled" }, 409);

  if (priceMinor <= 0) {
    const ins = await pool.query(
      `insert into course_enrollments (cohort_id, student_id, price_minor, currency, payment_status, metadata_jsonb)
       values ($1, $2, 0, $3, 'free', $4::jsonb)
       on conflict (cohort_id, student_id) do update
       set price_minor = 0,
           currency = excluded.currency,
           payment_status = 'free',
           enrolled_at = now(),
           wallet_hold_id = null,
           charged_at = null,
           released_at = null,
           cancelled_at = null,
           refunded_at = null,
           refund_amount_minor = 0,
           cancellation_reason = null,
           metadata_jsonb = course_enrollments.metadata_jsonb || excluded.metadata_jsonb
       where course_enrollments.payment_status in ('cancelled', 'refunded')
       returning id, enrolled_at`,
      [cohortId, studentId, currency, JSON.stringify({ source: "student_direct_course_reenrollment", courseId, cohortId })],
    );
    if (!ins.rowCount) return c.json({ error: "already_enrolled" }, 409);
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

    const ins = await client.query<{ id: string; enrolled_at: string }>(
      `insert into course_enrollments (cohort_id, student_id, price_minor, currency, payment_status, metadata_jsonb)
       values ($1, $2, $3, $4, 'manual', $5::jsonb)
       on conflict (cohort_id, student_id) do update
       set price_minor = excluded.price_minor,
           currency = excluded.currency,
           payment_status = 'manual',
           enrolled_at = now(),
           wallet_hold_id = null,
           charged_at = null,
           released_at = null,
           cancelled_at = null,
           refunded_at = null,
           refund_amount_minor = 0,
           cancellation_reason = null,
           metadata_jsonb = course_enrollments.metadata_jsonb || excluded.metadata_jsonb
       where course_enrollments.payment_status in ('cancelled', 'refunded')
       returning id, enrolled_at`,
      [cohortId, studentId, priceMinor, currency, JSON.stringify({ source: "student_direct_course_enrollment", courseId, cohortId })],
    );
    if (!ins.rowCount) {
      await client.query("rollback");
      return c.json({ error: "already_enrolled" }, 409);
    }
    const hold = await holdCourseEnrollmentPayment(
      {
        enrollmentId: ins.rows[0].id,
        userId,
        studentId,
        courseId,
        cohortId,
        amountMinor: priceMinor,
        currency,
        source: "student_direct_course_enrollment",
      },
      client,
    );
    await client.query("commit");
    return c.json({ enrollment: ins.rows[0], walletHold: hold }, 201);
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
            c.origin, c.application_status, c.campaign_details_jsonb,
            c.branch_id, b.name as branch_name,
            t.id as teacher_id, coalesce(u.display_name, 'Öğretmen seçilecek') as teacher_display_name
     from courses c
     left join teachers t on t.id = c.teacher_id
     left join users u on u.id = t.user_id
     left join branches b on b.id = c.branch_id
     where c.id = $1 and c.status = 'published'`,
    [courseId],
  );
  if (!cr.rowCount) return c.json({ error: "not_found" }, 404);

  const coh = await pool.query(
    `select cc.id, cc.title, cc.status, cc.capacity, cc.starts_at, cc.ends_at, cc.schedule_jsonb, cc.created_at,
            (select count(*)::int from course_enrollments e where e.cohort_id = cc.id and e.payment_status not in ('cancelled', 'refunded')) as enrolled_count,
            (select count(*)::int from course_student_applications sa where sa.cohort_id = cc.id) as application_count
     from course_cohorts cc
     where cc.course_id = $1 and cc.status in ('planned', 'active')
     order by cc.starts_at nulls last, cc.created_at desc
     limit 50`,
    [courseId],
  );

  const sessions = await pool.query(
    `select cs.id, cs.cohort_id, cs.session_index, cs.title, cs.scheduled_start, cs.scheduled_end,
            cs.duration_minutes, cs.delivery_mode::text as delivery_mode, cs.status::text as status
     from course_sessions cs
     join course_cohorts cc on cc.id = cs.cohort_id
     where cc.course_id = $1
     order by cc.starts_at nulls last, cs.session_index asc`,
    [courseId],
  );

  const lessonSchedule = sessions.rows.map((row) => ({
    ...row,
    label: scheduleLabel(row as Record<string, unknown>),
  }));

  return c.json({ course: cr.rows[0], cohorts: coh.rows, sessions: sessions.rows, lessonSchedule });
});
