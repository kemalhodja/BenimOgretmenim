import type { PoolClient } from "pg";
import { pool } from "../db.js";
import { applyWalletDelta } from "./wallet.js";

export async function settleCourseSessionTeacherPayout(sessionId: string, client?: PoolClient) {
  const run = async (c: PoolClient) => {
    const session = await c.query<{
      session_id: string;
      cohort_id: string;
      course_id: string;
      teacher_id: string | null;
      teacher_user_id: string | null;
      teacher_hourly_rate_minor: number | null;
      duration_minutes: number | null;
      currency: string;
      scheduled_start: string | null;
    }>(
      `select cs.id as session_id,
              cs.cohort_id,
              cc.course_id,
              c.teacher_id,
              t.user_id as teacher_user_id,
              c.teacher_hourly_rate_minor,
              coalesce(cs.duration_minutes, 60) as duration_minutes,
              c.currency,
              cs.scheduled_start
       from course_sessions cs
       join course_cohorts cc on cc.id = cs.cohort_id
       join courses c on c.id = cc.course_id
       left join teachers t on t.id = c.teacher_id
       where cs.id = $1
       for update of cs`,
      [sessionId],
    );
    const row = session.rows[0];
    if (!row) return { ok: false as const, error: "not_found" as const };
    if (row.scheduled_start && new Date(row.scheduled_start).getTime() > Date.now()) {
      return { ok: true as const, skipped: true as const, reason: "session_not_started" as const };
    }
    if (!row.teacher_id || !row.teacher_user_id) {
      return { ok: true as const, skipped: true as const, reason: "teacher_missing" as const };
    }
    const hourlyRate = Number(row.teacher_hourly_rate_minor ?? 0);
    if (hourlyRate <= 0) {
      return { ok: true as const, skipped: true as const, reason: "hourly_rate_missing" as const };
    }
    if (row.currency !== "TRY") {
      return { ok: true as const, skipped: true as const, reason: "currency_not_supported" as const };
    }

    const duration = Math.max(1, Number(row.duration_minutes ?? 60));
    const amountMinor = Math.round((hourlyRate * duration) / 60);
    const inserted = await c.query<{ id: string }>(
      `insert into course_teacher_payouts (
         course_id, cohort_id, session_id, teacher_id, teacher_user_id,
         hourly_rate_minor, duration_minutes, amount_minor, currency, status, metadata_jsonb
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10::jsonb)
       on conflict (session_id) do nothing
       returning id`,
      [
        row.course_id,
        row.cohort_id,
        row.session_id,
        row.teacher_id,
        row.teacher_user_id,
        hourlyRate,
        duration,
        amountMinor,
        row.currency,
        JSON.stringify({ source: "course_session_started" }),
      ],
    );
    if (!inserted.rowCount) {
      return { ok: true as const, alreadyPaid: true as const };
    }

    await applyWalletDelta({
      userId: row.teacher_user_id,
      deltaMinor: amountMinor,
      kind: "course_teacher_hourly_payout",
      refType: "course_session",
      refId: row.session_id,
      metadata: {
        courseId: row.course_id,
        cohortId: row.cohort_id,
        teacherId: row.teacher_id,
        hourlyRateMinor: hourlyRate,
        durationMinutes: duration,
        noTeacherCommission: true,
      },
      client: c,
    });
    await c.query(
      `update course_teacher_payouts
       set status = 'wallet_paid', paid_at = now(), updated_at = now()
       where id = $1`,
      [inserted.rows[0].id],
    );

    await c.query(
      `insert into user_notifications (
         recipient_user_id, channel, title, body, payload_jsonb, delivery_status, sent_at
       )
       values ($1, 'in_app', $2, $3, $4::jsonb, 'sent', now())`,
      [
        row.teacher_user_id,
        "Kurs ders hakedişi yatırıldı",
        `${(amountMinor / 100).toFixed(2)} ${row.currency} ders saat ücreti öğretmen cüzdanınıza yatırıldı.`,
        JSON.stringify({
          kind: "course_teacher_hourly_payout",
          courseId: row.course_id,
          cohortId: row.cohort_id,
          courseSessionId: row.session_id,
          amountMinor,
          currency: row.currency,
          href: "/teacher/cuzdan",
        }),
      ],
    );

    return { ok: true as const, paid: true as const, amountMinor };
  };

  if (client) return run(client);
  const c = await pool.connect();
  try {
    await c.query("begin");
    const result = await run(c);
    await c.query("commit");
    return result;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
