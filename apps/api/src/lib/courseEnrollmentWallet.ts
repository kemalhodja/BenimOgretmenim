import type { PoolClient } from "pg";
import { pool } from "../db.js";
import { applyWalletDelta } from "./wallet.js";
import { chargeWalletHold, createWalletHold, getWalletAvailableMinor, releaseWalletHold } from "./walletHolds.js";
import { settleCourseSessionTeacherPayout, voidPendingCoursePayoutsForEnrollmentRefund } from "./courseTeacherPayout.js";
import { notifyStudentAndGuardians } from "./parentNotifyRecipients.js";

export async function holdCourseEnrollmentPayment(
  opts: {
    enrollmentId: string;
    userId: string;
    studentId: string;
    courseId: string;
    cohortId: string;
    amountMinor: number;
    currency: string;
    source: string;
  },
  client: PoolClient,
): Promise<{ holdId: string } | null> {
  if (opts.amountMinor <= 0) {
    await client.query(
      `update course_enrollments
       set price_minor = 0, currency = $2, payment_status = 'free'
       where id = $1`,
      [opts.enrollmentId, opts.currency],
    );
    return null;
  }
  if (opts.currency !== "TRY") throw new Error("currency_not_supported");

  const existing = await client.query<{ payment_status: string; wallet_hold_id: string | null }>(
    `select payment_status, wallet_hold_id
     from course_enrollments
     where id = $1
     for update`,
    [opts.enrollmentId],
  );
  const row = existing.rows[0];
  if (!row) throw new Error("enrollment_not_found");
  if (row.payment_status === "wallet_held" && row.wallet_hold_id) return { holdId: row.wallet_hold_id };
  if (["wallet_charged", "external_paid"].includes(row.payment_status)) return null;

  const available = await getWalletAvailableMinor(opts.userId, client);
  if (available < BigInt(opts.amountMinor)) throw new Error("insufficient_balance");

  const hold = await createWalletHold(
    {
      userId: opts.userId,
      amountMinor: opts.amountMinor,
      reason: "course_enrollment",
      refType: "course_enrollment",
      refId: opts.enrollmentId,
    },
    client,
  );
  await client.query(
    `update course_enrollments
     set wallet_hold_id = $2,
         price_minor = $3,
         currency = $4,
         payment_status = 'wallet_held',
         metadata_jsonb = metadata_jsonb || $5::jsonb
     where id = $1`,
    [
      opts.enrollmentId,
      hold.holdId,
      opts.amountMinor,
      opts.currency,
      JSON.stringify({
        paymentSource: opts.source,
        walletHoldId: hold.holdId,
        heldAmountMinor: opts.amountMinor,
        heldAt: new Date().toISOString(),
      }),
    ],
  );
  return hold;
}

export async function releaseCourseEnrollmentHold(enrollmentId: string, client: PoolClient): Promise<void> {
  const r = await client.query<{ wallet_hold_id: string | null }>(
    `select wallet_hold_id
     from course_enrollments
     where id = $1 and payment_status = 'wallet_held'
     for update`,
    [enrollmentId],
  );
  const holdId = r.rows[0]?.wallet_hold_id;
  if (!holdId) return;
  await releaseWalletHold({ holdId }, client);
  await client.query(
    `update course_enrollments
     set payment_status = 'manual', released_at = now()
     where id = $1 and payment_status = 'wallet_held'`,
    [enrollmentId],
  );
}

async function notifyCourseEnrollmentCancelled(
  opts: {
    enrollmentId: string;
    courseId: string;
    cohortId: string;
    studentId: string;
    refundAmountMinor: number;
    currency: string;
    status: "cancelled" | "refunded";
  },
  client: PoolClient,
) {
  const details = await client.query<{ course_title: string; cohort_title: string }>(
    `select c.title as course_title, cc.title as cohort_title
     from courses c
     join course_cohorts cc on cc.course_id = c.id
     where c.id = $1 and cc.id = $2`,
    [opts.courseId, opts.cohortId],
  );
  const courseTitle = details.rows[0]?.course_title ?? "Kurs";
  const cohortTitle = details.rows[0]?.cohort_title ?? "Grup";
  const amountLabel = `${(opts.refundAmountMinor / 100).toFixed(2)} ${opts.currency}`;
  const refunded = opts.status === "refunded" && opts.refundAmountMinor > 0;

  await notifyStudentAndGuardians(
    client,
    opts.studentId,
    refunded ? "Kurs kaydı iptal edildi ve iade yapıldı" : "Kurs kaydı iptal edildi",
    refunded
      ? `${courseTitle} / ${cohortTitle} kaydınız iptal edildi. ${amountLabel} öğrenci cüzdanınıza iade edildi.`
      : `${courseTitle} / ${cohortTitle} kaydınız iptal edildi. Tahsilat yapılmadığı için iade tutarı oluşmadı.`,
    {
      kind: "course_enrollment_cancelled",
      enrollmentId: opts.enrollmentId,
      courseId: opts.courseId,
      cohortId: opts.cohortId,
      studentId: opts.studentId,
      refundAmountMinor: opts.refundAmountMinor,
      currency: opts.currency,
    },
  );
}

export async function cancelCourseEnrollmentPayment(
  enrollmentId: string,
  opts: { reason?: string | null; actorUserId?: string | null } = {},
  client?: PoolClient,
) {
  const run = async (c: PoolClient) => {
    const r = await c.query<{
      id: string;
      cohort_id: string;
      student_id: string;
      wallet_hold_id: string | null;
      price_minor: number;
      refund_amount_minor: number;
      currency: string;
      payment_status: string;
      refund_eligibility_status: string;
      user_id: string;
      course_id: string;
    }>(
      `select ce.id, ce.cohort_id, ce.student_id, ce.wallet_hold_id, ce.price_minor,
              ce.refund_amount_minor, ce.currency, ce.payment_status, ce.refund_eligibility_status,
              st.user_id, cc.course_id
       from course_enrollments ce
       join students st on st.id = ce.student_id
       join course_cohorts cc on cc.id = ce.cohort_id
       where ce.id = $1
       for update of ce`,
      [enrollmentId],
    );
    const row = r.rows[0];
    if (!row) return { ok: false as const, error: "not_found" as const };
    if (row.payment_status === "cancelled" || row.payment_status === "refunded") {
      return {
        ok: true as const,
        alreadyFinalized: true as const,
        paymentStatus: row.payment_status,
        refundAmountMinor: Number(row.refund_amount_minor ?? 0),
      };
    }
    if (row.refund_eligibility_status === "locked_after_second") {
      return { ok: false as const, error: "refund_not_allowed_after_second_lesson" as const };
    }

    const beforeStatus = row.payment_status;
    let nextStatus: "cancelled" | "refunded" = "cancelled";
    let refundAmountMinor = 0;

    if (row.payment_status === "wallet_held" && row.wallet_hold_id) {
      await releaseWalletHold({ holdId: row.wallet_hold_id }, c);
    } else if (row.payment_status === "wallet_charged" || row.payment_status === "external_paid") {
      refundAmountMinor = Math.max(0, Number(row.price_minor ?? 0));
      if (refundAmountMinor > 0) {
        await applyWalletDelta({
          userId: row.user_id,
          deltaMinor: refundAmountMinor,
          kind: "course_enrollment_refund",
          refType: "course_enrollment",
          refId: row.id,
          metadata: {
            courseId: row.course_id,
            cohortId: row.cohort_id,
            studentId: row.student_id,
            originalPaymentStatus: row.payment_status,
            reason: opts.reason ?? null,
            actorUserId: opts.actorUserId ?? null,
          },
          client: c,
        });
        nextStatus = "refunded";
        await voidPendingCoursePayoutsForEnrollmentRefund(row.id, c);
      }
    }

    await c.query(
      `update course_enrollments
       set payment_status = $2,
           cancelled_at = now(),
           refunded_at = case when $2 = 'refunded' then now() else refunded_at end,
           released_at = case when $3::int = 1 then now() else released_at end,
           refund_amount_minor = $4,
           cancellation_reason = $5,
           refund_eligibility_status = case
             when $2 = 'refunded' then 'refunded'
             else refund_eligibility_status
           end,
           refund_decided_at = now(),
           refund_decided_by_user_id = $7,
           metadata_jsonb = metadata_jsonb || $6::jsonb
       where id = $1`,
      [
        row.id,
        nextStatus,
        beforeStatus === "wallet_held" ? 1 : 0,
        refundAmountMinor,
        opts.reason ?? null,
        JSON.stringify({
          cancelledAt: new Date().toISOString(),
          cancelledByUserId: opts.actorUserId ?? null,
          cancellationReason: opts.reason ?? null,
          originalPaymentStatus: beforeStatus,
          refundAmountMinor,
        }),
        opts.actorUserId ?? null,
      ],
    );

    await notifyCourseEnrollmentCancelled(
      {
        enrollmentId: row.id,
        courseId: row.course_id,
        cohortId: row.cohort_id,
        studentId: row.student_id,
        refundAmountMinor,
        currency: row.currency,
        status: nextStatus,
      },
      c,
    );

    return { ok: true as const, paymentStatus: nextStatus, refundAmountMinor };
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

async function notifyCourseEnrollmentCharged(
  opts: {
    enrollmentId: string;
    courseId: string;
    cohortId: string;
    studentId: string;
    amountMinor: number;
    currency: string;
  },
  client: PoolClient,
) {
  const details = await client.query<{ course_title: string; cohort_title: string }>(
    `select c.title as course_title, cc.title as cohort_title
     from courses c
     join course_cohorts cc on cc.course_id = c.id
     where c.id = $1 and cc.id = $2`,
    [opts.courseId, opts.cohortId],
  );
  const courseTitle = details.rows[0]?.course_title ?? "Kurs";
  const cohortTitle = details.rows[0]?.cohort_title ?? "Grup";
  const amountLabel = `${(opts.amountMinor / 100).toFixed(2)} ${opts.currency}`;

  await notifyStudentAndGuardians(
    client,
    opts.studentId,
    "Kurs ücreti tahsil edildi",
    `${courseTitle} / ${cohortTitle} için blokede bekleyen ${amountLabel} kurs başlangıcıyla tahsil edildi.`,
    {
      kind: "course_enrollment_charge",
      enrollmentId: opts.enrollmentId,
      courseId: opts.courseId,
      cohortId: opts.cohortId,
      studentId: opts.studentId,
      amountMinor: opts.amountMinor,
      currency: opts.currency,
      href: "/student/kurslar",
    },
  );
}

export async function settleCourseEnrollmentHold(enrollmentId: string, client?: PoolClient) {
  const run = async (c: PoolClient) => {
    const r = await c.query<{
      id: string;
      cohort_id: string;
      student_id: string;
      wallet_hold_id: string | null;
      price_minor: number;
      currency: string;
      payment_status: string;
      user_id: string;
      course_id: string;
    }>(
      `select ce.id, ce.cohort_id, ce.student_id, ce.wallet_hold_id, ce.price_minor,
              ce.currency, ce.payment_status, st.user_id, cc.course_id
       from course_enrollments ce
       join students st on st.id = ce.student_id
       join course_cohorts cc on cc.id = ce.cohort_id
       where ce.id = $1
       for update`,
      [enrollmentId],
    );
    const row = r.rows[0];
    if (!row) return { ok: false as const, error: "not_found" as const };
    if (row.payment_status === "wallet_charged") return { ok: true as const, alreadyCharged: true as const };
    if (row.payment_status !== "wallet_held" || !row.wallet_hold_id || row.price_minor <= 0) {
      return { ok: true as const, skipped: true as const };
    }

    await applyWalletDelta({
      userId: row.user_id,
      deltaMinor: -Number(row.price_minor),
      kind: "course_enrollment_charge",
      refType: "course_enrollment",
      refId: row.id,
      metadata: {
        courseId: row.course_id,
        cohortId: row.cohort_id,
        studentId: row.student_id,
        holdId: row.wallet_hold_id,
        amountMinor: row.price_minor,
        currency: row.currency,
      },
      client: c,
    });
    await chargeWalletHold({ holdId: row.wallet_hold_id }, c);
    await c.query(
      `update course_enrollments
       set payment_status = 'wallet_charged',
           charged_at = now(),
           refund_eligibility_status = case
             when refund_eligibility_status = 'locked_after_second' then refund_eligibility_status
             else 'eligible_after_first'
           end,
           metadata_jsonb = metadata_jsonb || $2::jsonb
       where id = $1`,
      [
        row.id,
        JSON.stringify({
          chargedAt: new Date().toISOString(),
          chargedAmountMinor: row.price_minor,
          refundEligibilityStatus: "eligible_after_first",
        }),
      ],
    );
    await notifyCourseEnrollmentCharged(
      {
        enrollmentId: row.id,
        courseId: row.course_id,
        cohortId: row.cohort_id,
        studentId: row.student_id,
        amountMinor: Number(row.price_minor),
        currency: row.currency,
      },
      c,
    );
    return { ok: true as const, charged: true as const, amountMinor: Number(row.price_minor) };
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

export async function settleStartedCourseCohort(cohortId: string) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const enrollments = await client.query<{ id: string }>(
      `select ce.id
       from course_enrollments ce
       where ce.cohort_id = $1
         and ce.payment_status = 'wallet_held'
       order by ce.enrolled_at asc
       for update`,
      [cohortId],
    );
    let charged = 0;
    for (const row of enrollments.rows) {
      const result = await settleCourseEnrollmentHold(row.id, client);
      if (result.ok && "charged" in result) charged += 1;
    }
    const sessions = await client.query<{ id: string }>(
      `select id
       from course_sessions
       where cohort_id = $1
         and scheduled_start is not null
         and scheduled_start <= now()
         and status = 'scheduled'
       order by scheduled_start asc, session_index asc`,
      [cohortId],
    );
    let teacherPayouts = 0;
    for (const session of sessions.rows) {
      const payout = await settleCourseSessionTeacherPayout(session.id, client);
      if (payout.ok && "paid" in payout) teacherPayouts += 1;
    }
    await client.query("commit");
    return { ok: true as const, charged, teacherPayouts };
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
