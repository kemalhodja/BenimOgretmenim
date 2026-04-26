import bcrypt from "bcryptjs";
import { pool } from "../db.js";
import { formatDbConnectError } from "../lib/dbErrors.js";

const PASS = "DevParola1";

async function main() {
  try {
    const marker = await pool.query(
      `select id from users where email_normalized = 'seed_dev@benimogretmenim.local'`,
    );
    if (marker.rowCount) {
      console.log("seed already applied (seed_dev@benimogretmenim.local exists)");
      await pool.end();
      return;
    }

    const hash = await bcrypt.hash(PASS, 10);

    const client = await pool.connect();
    try {
      await client.query("begin");

      const tUser = await client.query(
        `insert into users (email, password_hash, display_name, role)
         values ('teacher_dev@benimogretmenim.local', $1, 'Seed Öğretmen', 'teacher'::user_role)
         returning id`,
        [hash],
      );
      const teacherUserId = tUser.rows[0].id as string;

      const sUser = await client.query(
        `insert into users (email, password_hash, display_name, role)
         values ('student_dev@benimogretmenim.local', $1, 'Seed Öğrenci', 'student'::user_role)
         returning id`,
        [hash],
      );
      const studentUserId = sUser.rows[0].id as string;

      const gUser = await client.query(
        `insert into users (email, password_hash, display_name, role)
         values ('guardian_dev@benimogretmenim.local', $1, 'Seed Veli', 'guardian'::user_role)
         returning id`,
        [hash],
      );
      const guardianUserId = gUser.rows[0].id as string;

      await client.query(
        `insert into users (email, password_hash, display_name, role)
         values ('seed_dev@benimogretmenim.local', $1, 'Seed Marker', 'admin'::user_role)`,
        [hash],
      );

      const teacherRow = await client.query(
        `insert into teachers (user_id) values ($1) returning id`,
        [teacherUserId],
      );
      const teacherId = teacherRow.rows[0].id as string;

      const mat = await client.query(
        `select id from branches where slug = 'matematik' limit 1`,
      );
      if (mat.rowCount) {
        await client.query(
          `insert into teacher_branches (teacher_id, branch_id, is_primary, hourly_rate_range)
           values ($1, $2, true, int4range(800, 1200, '[]'))`,
          [teacherId, mat.rows[0].id],
        );
      }

      const ist = await client.query(
        `select id from cities where slug = 'istanbul' limit 1`,
      );
      if (ist.rowCount) {
        await client.query(
          `update teachers set city_id = $1 where id = $2`,
          [ist.rows[0].id, teacherId],
        );
      }

      const studentRow = await client.query(
        `insert into students (user_id) values ($1) returning id`,
        [studentUserId],
      );
      const studentId = studentRow.rows[0].id as string;

      await client.query(
        `insert into student_guardians (student_id, guardian_user_id, relationship, is_primary)
         values ($1, $2, 'veli', true)`,
        [studentId, guardianUserId],
      );

      const pkg = await client.query(
        `insert into lesson_packages (
           teacher_id, student_id, total_lessons, completed_lessons,
           status, payment_status, currency, total_amount_minor, escrow_release_policy_jsonb
         ) values ($1, $2, 4, 0, 'active', 'pending', 'TRY', 0, '{}'::jsonb)
         returning id`,
        [teacherId, studentId],
      );
      const packageId = pkg.rows[0].id as string;

      const ls = await client.query(
        `insert into lesson_sessions (
           package_id, session_index, scheduled_start, duration_minutes,
           delivery_mode, status
         ) values ($1, 1, now(), 60, 'online', 'completed')
         returning id`,
        [packageId],
      );
      const lessonSessionId = ls.rows[0].id as string;

      // Ders talebi demo: öğrenci → açık talep (öğretmen inbox için)
      if (mat.rowCount) {
        const req = await client.query(
          `insert into lesson_requests (student_id, branch_id, city_id, delivery_mode, note)
           values ($1, $2, $3, 'online', $4)
           returning id`,
          [
            studentId,
            mat.rows[0].id,
            ist.rowCount ? ist.rows[0].id : null,
            "Seed: TYT matematik talebi (demo)",
          ],
        );
        console.log("lessonRequestId (demo):", req.rows[0].id);
      }

      await client.query("commit");

      console.log("Seed tamam.");
      console.log("Parola (tümü):", PASS);
      console.log("Öğretmen:", "teacher_dev@benimogretmenim.local", "userId:", teacherUserId);
      console.log("Öğrenci:", "student_dev@benimogretmenim.local", "userId:", studentUserId);
      console.log("Veli:", "guardian_dev@benimogretmenim.local", "userId:", guardianUserId);
      console.log("teacherId (tablo):", teacherId);
      console.log("lessonSessionId (değerlendirme testi):", lessonSessionId);
    } catch (e) {
      await client.query("rollback").catch(() => {});
      throw e;
    } finally {
      client.release();
    }

    await pool.end();
  } catch (e) {
    console.error(formatDbConnectError(e));
    await pool.end().catch(() => {});
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(formatDbConnectError(err));
  process.exit(1);
});
