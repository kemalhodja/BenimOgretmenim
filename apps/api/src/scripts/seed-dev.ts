import bcrypt from "bcryptjs";
import { pool } from "../db.js";
import { formatDbConnectError } from "../lib/dbErrors.js";

const PASS = "DevParola1";

async function insertSampleLessonVideos(
  client: import("pg").PoolClient,
  teacherId: string,
  branchId: number,
): Promise<boolean> {
  const videoCount = await client.query(
    `select count(*)::int as n from teacher_lesson_videos where teacher_id = $1`,
    [teacherId],
  );
  if ((videoCount.rows[0]?.n ?? 0) > 0) return false;

  await client.query(
    `insert into teacher_lesson_videos (
       teacher_id, grade_level, branch_id, topic_title, outcome_code, outcome_title,
       title, description, video_url, video_kind, duration_minutes, status, moderation_status
     ) values
       ($1, 8, $2, 'Üslü sayılar', 'M.8.1.1', 'Üslü ifadeleri yorumlar',
        'Seed: 8. sınıf üslü sayılar', 'Geliştirme ortamı örnek ders videosu.',
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'lesson', 12, 'published', 'approved'),
       ($1, 8, $2, 'LGS deneme stratejisi', 'M.8.9.1', 'Sınavda zaman yönetimi',
        'Seed: LGS matematik hazırlık', 'Geliştirme ortamı örnek sınav hazırlık videosu.',
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'exam_prep', 18, 'published', 'approved')`,
    [teacherId, branchId],
  );
  return true;
}

async function backfillExistingSeed(client: import("pg").PoolClient): Promise<void> {
  const student = await client.query<{ id: string; grade_level: number | null }>(
    `select s.id, s.grade_level
     from students s
     join users u on u.id = s.user_id
     where u.email_normalized = 'student_dev@benimogretmenim.local'
     limit 1`,
  );
  if (student.rowCount && student.rows[0].grade_level == null) {
    await client.query(`update students set grade_level = 8 where id = $1`, [student.rows[0].id]);
    console.log("seed backfill: öğrenci grade_level → 8");
  }

  const teacher = await client.query<{ id: string }>(
    `select t.id
     from teachers t
     join users u on u.id = t.user_id
     where u.email_normalized = 'teacher_dev@benimogretmenim.local'
     limit 1`,
  );
  const mat = await client.query<{ id: number }>(`select id from branches where slug = 'matematik' limit 1`);
  if (!teacher.rowCount || !mat.rowCount) return;

  try {
    const added = await insertSampleLessonVideos(client, teacher.rows[0].id, mat.rows[0].id);
    if (added) console.log("seed backfill: 2 örnek ders videosu eklendi (8. sınıf matematik)");
  } catch {
    /* migration 063 henüz uygulanmamış olabilir */
  }
}

async function main() {
  try {
    const marker = await pool.query(
      `select id from users where email_normalized = 'seed_dev@benimogretmenim.local'`,
    );
    if (marker.rowCount) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        await backfillExistingSeed(client);
        await client.query("commit");
      } catch (e) {
        await client.query("rollback").catch(() => {});
        throw e;
      } finally {
        client.release();
      }
      console.log("seed already applied (seed_dev@benimogretmenim.local exists) — backfill kontrol edildi");
      console.log("İpucu: ayrı bootstrap admin için kökten `npm run db:seed:admin` çalıştırın.");
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
        `insert into students (user_id, grade_level) values ($1, 8) returning id`,
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

      try {
        const zigoCount = await client.query(
          `select count(*)::int as n from teacher_zigo_content_links`,
        );
        if ((zigoCount.rows[0]?.n ?? 0) === 0) {
          await client.query(
            `insert into teacher_zigo_content_links (teacher_id, title, content_kind, branch_slug, target_exam)
             values
               ($1, 'TYT türev: zincir kuralını hatırla', 'tip', 'matematik', 'TYT'),
               ($1, 'LGS kesirler: paydaları eşitle', 'tip', 'matematik', 'LGS')`,
            [teacherId],
          );
        }
      } catch {
        /* migration 061 henüz uygulanmamış olabilir */
      }

      if (mat.rowCount) {
        try {
          const added = await insertSampleLessonVideos(client, teacherId, mat.rows[0].id);
          if (added) console.log("lesson videos (seed): 2 örnek video eklendi (8. sınıf matematik)");
        } catch {
          /* migration 063 henüz uygulanmamış olabilir */
        }
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
