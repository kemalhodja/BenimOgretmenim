/**
 * Google Play inceleme hesapları (production).
 * Şifreler yalnızca Play Console "App access" notuna yazılır; repoya commit edilmez.
 *
 *   PLAY_REVIEW_PASSWORD='GucluParola2026!' npm run db:seed:play-review --prefix apps/api
 */
import bcrypt from "bcryptjs";
import { pool } from "../db.js";
import { formatDbConnectError } from "../lib/dbErrors.js";

const STUDENT_EMAIL = "play.review.student@benimogretmenim.com.tr";
const TEACHER_EMAIL = "play.review.teacher@benimogretmenim.com.tr";

async function upsertUser(
  email: string,
  passwordHash: string,
  displayName: string,
  role: "student" | "teacher",
): Promise<string> {
  const existing = await pool.query<{ id: string }>(
    `select id from users where email_normalized = lower(trim($1))`,
    [email],
  );
  if (existing.rowCount) {
    const userId = existing.rows[0]!.id;
    await pool.query(
      `update users
       set password_hash = $2, display_name = $3, role = $4::user_role,
           account_status = 'active'::user_account_status
       where id = $1`,
      [userId, passwordHash, displayName, role],
    );
    console.log("[play-review] Guncellendi:", email);
    return userId;
  }
  const inserted = await pool.query<{ id: string }>(
    `insert into users (email, password_hash, display_name, role, account_status)
     values ($1, $2, $3, $4::user_role, 'active'::user_account_status)
     returning id`,
    [email, passwordHash, displayName, role],
  );
  console.log("[play-review] Olusturuldu:", email);
  return inserted.rows[0]!.id;
}

async function ensureTeacherProfile(userId: string): Promise<void> {
  const row = await pool.query<{ id: string }>(
    `select id from teachers where user_id = $1`,
    [userId],
  );
  if (row.rowCount) return;
  await pool.query(`insert into teachers (user_id) values ($1)`, [userId]);
}

async function ensureStudentProfile(userId: string): Promise<void> {
  const row = await pool.query<{ id: string }>(
    `select id from students where user_id = $1`,
    [userId],
  );
  if (row.rowCount) return;
  await pool.query(`insert into students (user_id) values ($1)`, [userId]);
}

async function main() {
  const passwordRaw = process.env.PLAY_REVIEW_PASSWORD?.trim();
  if (!passwordRaw || passwordRaw.length < 10) {
    console.error("PLAY_REVIEW_PASSWORD zorunludur (en az 10 karakter).");
    process.exit(1);
  }
  const hash = await bcrypt.hash(passwordRaw, 10);
  try {
    const studentUserId = await upsertUser(STUDENT_EMAIL, hash, "Play Review Öğrenci", "student");
    const teacherUserId = await upsertUser(TEACHER_EMAIL, hash, "Play Review Öğretmen", "teacher");
    await ensureStudentProfile(studentUserId);
    await ensureTeacherProfile(teacherUserId);
    console.log("\nPlay Console inceleme notuna ekleyin:");
    console.log(`  Student: ${STUDENT_EMAIL} / [PLAY_REVIEW_PASSWORD]`);
    console.log(`  Teacher: ${TEACHER_EMAIL} / [PLAY_REVIEW_PASSWORD]`);
  } catch (err) {
    console.error(formatDbConnectError(err));
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
