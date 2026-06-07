import type { PoolClient } from "pg";
import { pool } from "../db.js";
import { applyWalletDelta, splitPlatformSuccessFee } from "./wallet.js";

export async function lockCourseEnrollmentRefundWindowForCohort(
  cohortId: string,
  client: PoolClient,
  opts: { reason?: string } = {},
) {
  await client.query(
    `update course_enrollments
     set refund_eligibility_status = 'locked_after_second',
         refund_decided_at = coalesce(refund_decided_at, now()),
         metadata_jsonb = metadata_jsonb || $2::jsonb
     where cohort_id = $1
       and payment_status in ('wallet_charged', 'external_paid')
       and refund_eligibility_status in ('eligible_after_first', 'refund_requested', 'not_started')`,
    [
      cohortId,
      JSON.stringify({
        refundLockedAt: new Date().toISOString(),
        refundLockReason: opts.reason ?? "second_lesson_started",
      }),
    ],
  );

  await client.query(
    `update course_teacher_payouts
     set refund_lock_status = 'locked_after_second',
         payable_after = coalesce(payable_after, now()),
         updated_at = now()
     where cohort_id = $1
       and status = 'pending'
       and refund_lock_status = 'pending_refund_window'`,
    [cohortId],
  );
}

export async function voidPendingCoursePayoutsForEnrollmentRefund(
  enrollmentId: string,
  client: PoolClient,
) {
  await client.query(
    `update course_teacher_payouts tp
     set status = 'skipped',
         refund_lock_status = 'refunded',
         voided_at = now(),
         updated_at = now(),
         metadata_jsonb = tp.metadata_jsonb || $2::jsonb
     from course_enrollments ce
     where ce.id = $1
       and tp.cohort_id = ce.cohort_id
       and tp.status = 'pending'
       and tp.refund_lock_status = 'pending_refund_window'`,
    [
      enrollmentId,
      JSON.stringify({
        voidReason: "student_refund_approved",
        enrollmentId,
        voidedAt: new Date().toISOString(),
      }),
    ],
  );
}

export async function payEligibleCourseTeacherPayoutsForCohort(cohortId: string, client: PoolClient) {
  const rows = await client.query<{
    id: string;
    course_id: string;
    cohort_id: string;
    session_id: string;
    teacher_id: string;
    teacher_user_id: string;
    amount_minor: number;
    currency: string;
    platform_fee_minor: number;
    teacher_net_amount_minor: number;
    success_fee_bps: number;
  }>(
    `select id, course_id, cohort_id, session_id, teacher_id, teacher_user_id,
            amount_minor, currency, platform_fee_minor, teacher_net_amount_minor, success_fee_bps
     from course_teacher_payouts
     where cohort_id = $1
       and status = 'pending'
       and refund_lock_status = 'locked_after_second'
     order by created_at asc
     for update`,
    [cohortId],
  );

  let paid = 0;
  let paidAmountMinor = 0;
  for (const row of rows.rows) {
    const split = splitPlatformSuccessFee(
      Number(row.amount_minor),
      Number(row.success_fee_bps ?? 1000),
    );
    const net = Number(row.teacher_net_amount_minor || split.teacherNetMinor);
    const fee = Number(row.platform_fee_minor || split.platformFeeMinor);

    if (net > 0) {
      await applyWalletDelta({
        userId: row.teacher_user_id,
        deltaMinor: net,
        kind: "course_teacher_net_payout",
        refType: "course_session",
        refId: row.session_id,
        metadata: {
          courseId: row.course_id,
          cohortId: row.cohort_id,
          teacherId: row.teacher_id,
          grossAmountMinor: Number(row.amount_minor),
          platformFeeMinor: fee,
          teacherNetAmountMinor: net,
          successFeeBps: Number(row.success_fee_bps ?? 1000),
        },
        client,
      });
    }

    await client.query(
      `update course_teacher_payouts
       set status = 'wallet_paid',
           platform_fee_minor = $2,
           teacher_net_amount_minor = $3,
           paid_at = now(),
           updated_at = now(),
           metadata_jsonb = metadata_jsonb || $4::jsonb
       where id = $1 and status = 'pending'`,
      [
        row.id,
        fee,
        net,
        JSON.stringify({
          paidAt: new Date().toISOString(),
          payoutKind: "net_after_platform_success_fee",
        }),
      ],
    );

    await client.query(
      `insert into user_notifications (
         recipient_user_id, channel, title, body, payload_jsonb, delivery_status, sent_at
       )
       values ($1, 'in_app', $2, $3, $4::jsonb, 'sent', now())`,
      [
        row.teacher_user_id,
        "Kurs ders net hakedişi yatırıldı",
        `${(net / 100).toFixed(2)} ${row.currency} net hakediş öğretmen cüzdanınıza yatırıldı. Platform başarı bedeli: ${(fee / 100).toFixed(2)} ${row.currency}.`,
        JSON.stringify({
          kind: "course_teacher_net_payout",
          courseId: row.course_id,
          cohortId: row.cohort_id,
          courseSessionId: row.session_id,
          grossAmountMinor: Number(row.amount_minor),
          platformFeeMinor: fee,
          teacherNetAmountMinor: net,
          currency: row.currency,
          href: "/teacher/cuzdan",
        }),
      ],
    );
    paid += 1;
    paidAmountMinor += net;
  }

  return { paid, paidAmountMinor };
}

export async function settleCourseSessionTeacherPayout(sessionId: string, client?: PoolClient) {
  const run = async (c: PoolClient) => {
    const session = await c.query<{
      session_id: string;
      session_index: number;
      cohort_id: string;
      course_id: string;
      teacher_id: string | null;
      teacher_user_id: string | null;
      teacher_hourly_rate_minor: number | null;
      duration_minutes: number | null;
      currency: string;
      scheduled_start: string | null;
      collected_amount_minor: string | number;
      session_count: number;
    }>(
      `select cs.id as session_id,
              cs.session_index,
              cs.cohort_id,
              cc.course_id,
              c.teacher_id,
              t.user_id as teacher_user_id,
              c.teacher_hourly_rate_minor,
              coalesce(cs.duration_minutes, 60) as duration_minutes,
              c.currency,
              cs.scheduled_start,
              (
                select coalesce(sum(ce.price_minor), 0)::bigint
                from course_enrollments ce
                where ce.cohort_id = cs.cohort_id
                  and ce.payment_status in ('wallet_charged', 'external_paid')
              ) as collected_amount_minor,
              (
                select greatest(count(*)::int, 1)
                from course_sessions session_count_cs
                where session_count_cs.cohort_id = cs.cohort_id
              ) as session_count
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
    if (row.currency !== "TRY") {
      return { ok: true as const, skipped: true as const, reason: "currency_not_supported" as const };
    }

    const duration = Math.max(1, Number(row.duration_minutes ?? 60));
    const hourlyRate = Number(row.teacher_hourly_rate_minor ?? 0);
    const collectedAmountMinor = Number(row.collected_amount_minor ?? 0);
    const sessionCount = Math.max(1, Number(row.session_count ?? 1));
    const amountMinor =
      hourlyRate > 0
        ? Math.round((hourlyRate * duration) / 60)
        : Math.floor(collectedAmountMinor / sessionCount);
    if (amountMinor <= 0) {
      return { ok: true as const, skipped: true as const, reason: "payable_amount_missing" as const };
    }
    const refundLocked = Number(row.session_index ?? 1) >= 2;
    if (refundLocked) {
      await lockCourseEnrollmentRefundWindowForCohort(row.cohort_id, c);
    }
    const split = splitPlatformSuccessFee(amountMinor);
    const inserted = await c.query<{ id: string }>(
      `insert into course_teacher_payouts (
         course_id, cohort_id, session_id, teacher_id, teacher_user_id,
         hourly_rate_minor, duration_minutes, amount_minor, currency, status,
         platform_fee_minor, teacher_net_amount_minor, success_fee_bps, refund_lock_status, payable_after, metadata_jsonb
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending',
               $10, $11, $12, $13, $14, $15::jsonb)
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
        split.platformFeeMinor,
        split.teacherNetMinor,
        split.successFeeBps,
        refundLocked ? "locked_after_second" : "pending_refund_window",
        refundLocked ? new Date() : null,
        JSON.stringify({
          source: "course_session_started",
          payoutBasis: hourlyRate > 0 ? "teacher_hourly_rate" : "collected_course_amount_prorated",
          collectedAmountMinor,
          sessionCount,
          grossAmountMinor: amountMinor,
          platformFeeMinor: split.platformFeeMinor,
          teacherNetAmountMinor: split.teacherNetMinor,
          successFeeBps: split.successFeeBps,
          refundLockStatus: refundLocked ? "locked_after_second" : "pending_refund_window",
        }),
      ],
    );
    if (!inserted.rowCount) {
      if (refundLocked) {
        const paidResult = await payEligibleCourseTeacherPayoutsForCohort(row.cohort_id, c);
        return { ok: true as const, alreadyPaid: true as const, paidCount: paidResult.paid, paidAmountMinor: paidResult.paidAmountMinor };
      }
      return { ok: true as const, alreadyPaid: true as const };
    }

    if (!refundLocked) {
      await c.query(
        `insert into user_notifications (
           recipient_user_id, channel, title, body, payload_jsonb, delivery_status, sent_at
         )
         values ($1, 'in_app', $2, $3, $4::jsonb, 'sent', now())`,
        [
          row.teacher_user_id,
          "Kurs ders hakedişi beklemede",
          `${(split.teacherNetMinor / 100).toFixed(2)} ${row.currency} net hakediş, öğrencinin ilk ders iade hakkı kapanınca cüzdanınıza yatırılacak.`,
          JSON.stringify({
            kind: "course_teacher_payout_pending_refund_window",
            courseId: row.course_id,
            cohortId: row.cohort_id,
            courseSessionId: row.session_id,
            grossAmountMinor: amountMinor,
            platformFeeMinor: split.platformFeeMinor,
            teacherNetAmountMinor: split.teacherNetMinor,
            currency: row.currency,
            href: "/teacher/cuzdan",
          }),
        ],
      );
      return {
        ok: true as const,
        pendingRefundWindow: true as const,
        amountMinor,
        platformFeeMinor: split.platformFeeMinor,
        teacherNetAmountMinor: split.teacherNetMinor,
      };
    }

    const paidResult = await payEligibleCourseTeacherPayoutsForCohort(row.cohort_id, c);

    return {
      ok: true as const,
      paid: true as const,
      amountMinor,
      platformFeeMinor: split.platformFeeMinor,
      teacherNetAmountMinor: split.teacherNetMinor,
      paidCount: paidResult.paid,
      paidAmountMinor: paidResult.paidAmountMinor,
    };
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
