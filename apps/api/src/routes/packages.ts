import { Hono } from "hono";
import { z } from "zod";
import { pool } from "../db.js";
import type { AppVariables } from "../types.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const packages = new Hono<{ Variables: AppVariables }>();

function meetingBase(): string {
  return (process.env.MEETING_BASE_URL ?? "https://meet.jit.si").replace(/\/$/, "");
}

/** Öğretmen: aktif paketler + öğrenciler */
packages.get("/teacher/mine", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "teacher") return c.json({ error: "forbidden_teachers_only" }, 403);

  const tr = await pool.query(`select id from teachers where user_id = $1`, [userId]);
  if (!tr.rowCount) return c.json({ error: "teacher_profile_missing" }, 400);
  const teacherId = tr.rows[0].id as string;

  const r = await pool.query(
    `select lp.id,
            lp.status,
            lp.payment_status,
            lp.total_lessons,
            lp.completed_lessons,
            lp.created_at,
            s.id as student_id,
            u.display_name as student_display_name
     from lesson_packages lp
     join students s on s.id = lp.student_id
     join users u on u.id = s.user_id
     where lp.teacher_id = $1
     order by lp.created_at desc
     limit 50`,
    [teacherId],
  );
  return c.json({ packages: r.rows });
});

/** Öğrenci: paketlerim + öğretmen bilgisi */
packages.get("/student/mine", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "student") return c.json({ error: "forbidden_students_only" }, 403);

  const sr = await pool.query(`select id from students where user_id = $1`, [userId]);
  if (!sr.rowCount) return c.json({ error: "student_profile_missing" }, 400);
  const studentId = sr.rows[0].id as string;

  const r = await pool.query(
    `select lp.id,
            lp.status,
            lp.payment_status,
            lp.total_lessons,
            lp.completed_lessons,
            lp.created_at,
            t.id as teacher_id,
            u.display_name as teacher_display_name
     from lesson_packages lp
     join teachers t on t.id = lp.teacher_id
     join users u on u.id = t.user_id
     where lp.student_id = $1
     order by lp.created_at desc
     limit 50`,
    [studentId],
  );
  return c.json({ packages: r.rows });
});

/** Paket oturumları (teacher veya student) */
packages.get("/:packageId/sessions", requireAuth, async (c) => {
  const userId = c.get("userId");
  const packageId = c.req.param("packageId");
  if (!z.string().uuid().safeParse(packageId).success) {
    return c.json({ error: "invalid_package_id" }, 400);
  }

  const access = await pool.query(
    `select lp.id,
            st.user_id as student_user_id,
            tt.user_id as teacher_user_id
     from lesson_packages lp
     join students st on st.id = lp.student_id
     join teachers t on t.id = lp.teacher_id
     join users tt on tt.id = t.user_id
     where lp.id = $1`,
    [packageId],
  );
  if (!access.rowCount) return c.json({ error: "not_found" }, 404);

  const a = access.rows[0] as { student_user_id: string; teacher_user_id: string };
  if (userId !== a.student_user_id && userId !== a.teacher_user_id) {
    return c.json({ error: "forbidden" }, 403);
  }

  const r = await pool.query(
    `select id, session_index, scheduled_start, scheduled_end, duration_minutes,
            delivery_mode, meeting_url, status, created_at, updated_at
     from lesson_sessions
     where package_id = $1
     order by session_index asc`,
    [packageId],
  );
  return c.json({ sessions: r.rows });
});

const scheduleSchema = z.object({
  scheduledStart: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(240).optional().default(60),
});

/** Öğretmen: oturumu planla + meeting_url üret */
packages.post("/:packageId/sessions/:sessionId/schedule", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "teacher") return c.json({ error: "forbidden_teachers_only" }, 403);

  const packageId = c.req.param("packageId");
  const sessionId = c.req.param("sessionId");
  if (!z.string().uuid().safeParse(packageId).success) {
    return c.json({ error: "invalid_package_id" }, 400);
  }
  if (!z.string().uuid().safeParse(sessionId).success) {
    return c.json({ error: "invalid_session_id" }, 400);
  }

  const parsed = scheduleSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const tr = await pool.query(`select id from teachers where user_id = $1`, [userId]);
  if (!tr.rowCount) return c.json({ error: "teacher_profile_missing" }, 400);
  const teacherId = tr.rows[0].id as string;

  const start = new Date(parsed.data.scheduledStart);
  const duration = parsed.data.durationMinutes;
  const end = new Date(start.getTime() + duration * 60_000);
  const meet = `${meetingBase()}/bm-${sessionId}`;

  const r = await pool.query(
    `update lesson_sessions ls
     set scheduled_start = $4,
         scheduled_end = $5,
         duration_minutes = $6,
         meeting_url = $7,
         updated_at = now()
     from lesson_packages lp
     where ls.id = $1
       and ls.package_id = $2
       and lp.id = $2
       and lp.teacher_id = $3
     returning ls.id, ls.scheduled_start, ls.scheduled_end, ls.duration_minutes, ls.meeting_url`,
    [sessionId, packageId, teacherId, start, end, duration, meet],
  );
  if (!r.rowCount) return c.json({ error: "not_found_or_forbidden" }, 404);

  return c.json({ session: r.rows[0] });
});

