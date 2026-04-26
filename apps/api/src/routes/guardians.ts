import { Hono } from "hono";
import { z } from "zod";
import { pool } from "../db.js";
import type { AppVariables } from "../types.js";
import { requireAuth } from "../middleware/requireAuth.js";

const linkSchema = z.object({
  guardianUserId: z.string().uuid(),
});

export const guardians = new Hono<{ Variables: AppVariables }>();

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

  return c.json({
    students: students.rows,
    progress: progress.rows,
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
