import { describe, expect, it } from "vitest";
import { app } from "./app.js";
import { signAccessToken } from "./auth/jwt.js";
import { pool } from "./db.js";
import { applyWalletDelta } from "./lib/wallet.js";

async function courseWalletColumnsAvailable(): Promise<boolean> {
  const health = await app.request("http://localhost/health");
  if (health.status !== 200) return false;
  const r = await pool.query<{ ok: boolean }>(
    `select to_regclass('public.user_wallet_holds') is not null
        and to_regclass('public.course_teacher_payouts') is not null
        and exists (
          select 1 from information_schema.columns
          where table_schema = 'public'
            and table_name = 'course_enrollments'
            and column_name = 'payment_status'
        )
        and exists (
          select 1 from information_schema.columns
          where table_schema = 'public'
            and table_name = 'course_enrollments'
            and column_name = 'refund_amount_minor'
        ) as ok`,
  );
  return r.rows[0]?.ok === true;
}

async function createUser(role: "admin" | "teacher" | "student", suffix: string) {
  const user = await pool.query<{ id: string }>(
    `insert into users (email, display_name, role) values ($1, $2, $3) returning id`,
    [`course-wallet-${role}-${suffix}@example.test`, `Course Wallet ${role} ${suffix}`, role],
  );
  const userId = user.rows[0].id;
  let profileId = "";
  if (role === "teacher") {
    const teacher = await pool.query<{ id: string }>(`insert into teachers (user_id) values ($1) returning id`, [
      userId,
    ]);
    profileId = teacher.rows[0].id;
  } else if (role === "student") {
    const student = await pool.query<{ id: string }>(`insert into students (user_id) values ($1) returning id`, [
      userId,
    ]);
    profileId = student.rows[0].id;
  }
  const token = await signAccessToken({ userId, role });
  return { userId, profileId, token };
}

describe("course enrollment wallet holds", () => {
  it("holds student balance on direct enrollment and charges when the first class starts", async () => {
    if (!(await courseWalletColumnsAvailable())) return;

    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const createdUserIds: string[] = [];
    let courseId: string | null = null;
    try {
      const admin = await createUser("admin", suffix);
      const teacher = await createUser("teacher", suffix);
      const student = await createUser("student", suffix);
      createdUserIds.push(admin.userId, teacher.userId, student.userId);
      await applyWalletDelta({
        userId: student.userId,
        deltaMinor: 120_000,
        kind: "test_wallet_grant",
        refType: "course_wallet_hold_test",
        refId: suffix,
      });

      const course = await pool.query<{ id: string }>(
        `insert into courses (teacher_id, title, description, price_minor, currency, status)
         values ($1, 'Cüzdan Blokeli Kurs', 'Normal kurs kayıt testi', 120000, 'TRY', 'published')
         returning id`,
        [teacher.profileId],
      );
      courseId = course.rows[0].id;
      const cohort = await pool.query<{ id: string }>(
        `insert into course_cohorts (course_id, title, status, capacity, starts_at)
         values ($1, 'Ana grup', 'planned', 8, now() + interval '1 day')
         returning id`,
        [courseId],
      );
      const session = await pool.query<{ id: string }>(
        `insert into course_sessions (cohort_id, session_index, title, scheduled_start, scheduled_end, duration_minutes, status)
         values ($1, 1, 'İlk ders', now() + interval '1 day', now() + interval '1 day 1 hour', 60, 'scheduled')
         returning id`,
        [cohort.rows[0].id],
      );

      const enroll = await app.request(`http://localhost/v1/courses/${courseId}/cohorts/${cohort.rows[0].id}/enroll`, {
        method: "POST",
        headers: { authorization: `Bearer ${student.token}` },
      });
      expect(enroll.status).toBe(201);
      const enrollBody = (await enroll.json()) as { enrollment: { id: string }; walletHold: { holdId: string } | null };
      expect(enrollBody.walletHold?.holdId).toBeTruthy();

      const walletBeforeStart = await pool.query<{ balance_minor: string }>(
        `select balance_minor from user_wallets where user_id = $1`,
        [student.userId],
      );
      expect(walletBeforeStart.rows[0]?.balance_minor).toBe("120000");
      const held = await pool.query<{ payment_status: string; count: string }>(
        `select ce.payment_status,
                (select count(*)::text from user_wallet_holds h where h.id = ce.wallet_hold_id and h.status = 'active') as count
         from course_enrollments ce
         where ce.id = $1`,
        [enrollBody.enrollment.id],
      );
      expect(held.rows[0]?.payment_status).toBe("wallet_held");
      expect(held.rows[0]?.count).toBe("1");

      await pool.query(`update course_sessions set scheduled_start = now() - interval '1 minute' where id = $1`, [
        session.rows[0].id,
      ]);
      const classroom = await app.request(`http://localhost/v1/classroom/course-sessions/${session.rows[0].id}`, {
        headers: { authorization: `Bearer ${student.token}` },
      });
      expect(classroom.status).toBe(200);

      const walletAfterStart = await pool.query<{ balance_minor: string }>(
        `select balance_minor from user_wallets where user_id = $1`,
        [student.userId],
      );
      expect(walletAfterStart.rows[0]?.balance_minor).toBe("0");
      const charged = await pool.query<{ payment_status: string; count: string }>(
        `select ce.payment_status,
                (select count(*)::text from user_wallet_holds h where h.id = ce.wallet_hold_id and h.status = 'charged') as count
         from course_enrollments ce
         where ce.id = $1`,
        [enrollBody.enrollment.id],
      );
      expect(charged.rows[0]?.payment_status).toBe("wallet_charged");
      expect(charged.rows[0]?.count).toBe("1");

      const notification = await pool.query<{ count: string }>(
        `select count(*)::text as count
         from parent_notifications
         where student_id = $1
           and payload_jsonb->>'kind' = 'course_enrollment_charge'
           and payload_jsonb->>'amountMinor' = '120000'`,
        [student.profileId],
      );
      expect(notification.rows[0]?.count).toBe("1");

      const refund = await app.request(`http://localhost/v1/admin/course-enrollments/${enrollBody.enrollment.id}/cancel`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${admin.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ reason: "Test iptal/iade" }),
      });
      expect(refund.status).toBe(200);
      const refunded = await pool.query<{ payment_status: string; refund_amount_minor: string }>(
        `select payment_status, refund_amount_minor::text as refund_amount_minor
         from course_enrollments
         where id = $1`,
        [enrollBody.enrollment.id],
      );
      expect(refunded.rows[0]?.payment_status).toBe("refunded");
      expect(refunded.rows[0]?.refund_amount_minor).toBe("120000");
      const walletAfterRefund = await pool.query<{ balance_minor: string }>(
        `select balance_minor from user_wallets where user_id = $1`,
        [student.userId],
      );
      expect(walletAfterRefund.rows[0]?.balance_minor).toBe("120000");

      const refundAgain = await app.request(`http://localhost/v1/admin/course-enrollments/${enrollBody.enrollment.id}/cancel`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${admin.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ reason: "Tekrar deneme" }),
      });
      expect(refundAgain.status).toBe(200);
      const refundLedger = await pool.query<{ count: string }>(
        `select count(*)::text as count
         from user_wallet_ledger
         where user_id = $1
           and kind = 'course_enrollment_refund'
           and ref_id = $2`,
        [student.userId, enrollBody.enrollment.id],
      );
      expect(refundLedger.rows[0]?.count).toBe("1");
      const accounting = await app.request("http://localhost/v1/admin/course-accounting", {
        headers: { authorization: `Bearer ${admin.token}` },
      });
      expect(accounting.status).toBe(200);
      const accountingBody = (await accounting.json()) as {
        rows: Array<{
          id: string;
          gross_collected_amount_minor: string | number;
          refunded_amount_minor: string | number;
          net_platform_amount_minor: string | number;
        }>;
      };
      const accountingRow = accountingBody.rows.find((row) => row.id === courseId);
      expect(String(accountingRow?.gross_collected_amount_minor)).toBe("120000");
      expect(String(accountingRow?.refunded_amount_minor)).toBe("120000");
      expect(String(accountingRow?.net_platform_amount_minor)).toBe("0");
    } finally {
      if (courseId) await pool.query(`delete from courses where id = $1`, [courseId]);
      await pool.query(`delete from users where id = any($1::uuid[])`, [createdUserIds]);
    }
  });
});
