import { randomBytes } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import { pool } from "../db.js";
import type { AppVariables } from "../types.js";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  classifyHomeworkPost,
  homeworkResolveMinutes,
  homeworkSatisfactionRewardMinor,
  homeworkTargetMinutesForUrgency,
  releaseExpiredHomeworkClaims,
  scoreHomeworkAnswer,
} from "../lib/homeworkPosts.js";
import { resolvePlatformHomeworkWalletUserId } from "../lib/platformHomeworkWallet.js";
import { applyWalletDelta, teacherPayoutFromGross } from "../lib/wallet.js";
import {
  ensureUserWalletRow,
  getActiveStudentSubscription,
  getStudentDailyUsage,
  getStudentSubPriceConfig,
  lockStudentDailyUsage,
  studentUsagePolicyForSubscription,
} from "../lib/studentSub.js";
import {
  consumeUsageCredit,
  listUsageCreditPacks,
  purchaseUsageCreditPackFromWallet,
} from "../lib/usageCredits.js";

export const studentPlatform = new Hono<{ Variables: AppVariables }>();

const purchaseSubSchema = z.object({
  months: z.number().int().min(1).max(60).optional(),
});

studentPlatform.get("/subscription/me", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "student") return c.json({ error: "forbidden_students_only" }, 403);
  const sub = await getActiveStudentSubscription(userId);
  const price = getStudentSubPriceConfig();
  const policy = studentUsagePolicyForSubscription(sub);
  const sr = await pool.query(`select id from students where user_id = $1`, [userId]);
  const usage = sr.rowCount ? await getStudentDailyUsage(sr.rows[0].id as string, policy, pool, userId) : null;
  if (!sub) {
    return c.json({ active: false, subscription: null, ...price, policy, usage });
  }
  return c.json({ active: true, subscription: sub, ...price, policy, usage });
});

studentPlatform.get("/usage-packs", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "student") return c.json({ error: "forbidden_students_only" }, 403);
  const packs = await listUsageCreditPacks("student");
  return c.json({ packs });
});

studentPlatform.post("/usage-packs/:packCode/purchase", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "student") return c.json({ error: "forbidden_students_only" }, 403);

  const packCode = c.req.param("packCode");
  const client = await pool.connect();
  try {
    await client.query("begin");
    const purchased = await purchaseUsageCreditPackFromWallet({
      userId,
      audienceRole: "student",
      packCode,
      client,
    });
    await client.query("commit");
    return c.json(purchased, 201);
  } catch (e) {
    await client.query("rollback").catch(() => {});
    const err = e as Error & { neededMinor?: number };
    if (err.message === "usage_credit_pack_not_found") return c.json({ error: "pack_not_found" }, 404);
    if (err.message === "insufficient_balance") {
      return c.json({ error: "insufficient_balance", neededMinor: err.neededMinor ?? null }, 409);
    }
    throw e;
  } finally {
    client.release();
  }
});

/** Öğrenci yıllık aboneliği: varsayılan 12 ay / 1500 TL; PayTR ile ödeme sonrası aktif. */
studentPlatform.post("/subscription/purchase", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "student") return c.json({ error: "forbidden_students_only" }, 403);

  const parsed = purchaseSubSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const { annualMonths, annualPriceMinor, pricePerMonthMinor } = getStudentSubPriceConfig();
  const months = parsed.data.months ?? annualMonths;
  if (months !== annualMonths) {
    return c.json({ error: "annual_subscription_only", annualMonths, annualPriceMinor }, 400);
  }
  const total = annualPriceMinor;
  const merchantOid = `STU-${Date.now()}-${randomBytes(5).toString("hex")}`;

  const client = await pool.connect();
  let pay: { rows: Array<{ id: string; merchant_oid: string }> };
  try {
    await client.query("begin");
    const sub = await client.query(
      `insert into student_subscriptions (
         user_id, months_count, price_per_month_minor, price_total_minor, lifecycle
       ) values ($1, $2, $3, $4, 'awaiting_payment')
       returning id, months_count, price_total_minor, currency`,
      [userId, months, pricePerMonthMinor, total],
    );

    const sid = sub.rows[0].id as string;

    pay = await client.query(
      `insert into student_sub_payments (
         subscription_id, user_id, amount_minor, currency, method, state, merchant_oid
       ) values ($1, $2, $3, 'TRY', 'paytr_iframe', 'pending', $4)
       returning id, merchant_oid`,
      [sid, userId, total, merchantOid],
    );
    await client.query("commit");
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  return c.json(
    {
      payment: pay.rows[0],
      next: { checkout: `/v1/paytr/student-sub-checkout?paymentId=${pay.rows[0].id}` },
    },
    201,
  );
});

const createHomeworkSchema = z.object({
  branchId: z.number().int().positive(),
  topic: z.string().min(2).max(200),
  helpText: z.string().min(5).max(8000),
  gradeLevelText: z.string().max(80).optional().nullable(),
  targetExam: z.string().max(80).optional().nullable(),
  learningObjective: z.string().max(180).optional().nullable(),
  urgencyLevel: z.enum(["normal", "priority", "urgent"]).optional().default("normal"),
  imageUrls: z.array(z.string().min(1).max(450_000)).max(4).optional().default([]),
  audioUrl: z.string().min(1).max(2000).optional().nullable(),
});

function isAllowedHomeworkImageUrl(u: string): boolean {
  if (u.length > 400_000) return false;
  if (/^https:\/\//i.test(u)) return true;
  return /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(u);
}

/** Branş havuzuna: foto + açıklama; ücretsiz/yıllık abonelik günlük kotasına tabidir. */
studentPlatform.post("/homework-posts", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "student") return c.json({ error: "forbidden_students_only" }, 403);

  const parsed = createHomeworkSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  for (const u of parsed.data.imageUrls ?? []) {
    if (!isAllowedHomeworkImageUrl(u)) {
      return c.json(
        { error: "invalid_image_url", hint: "Görsel: https URL veya data:image/jpeg|png|webp;base64,..." },
        400,
      );
    }
  }

  const sr = await pool.query(`select id from students where user_id = $1`, [userId]);
  if (!sr.rowCount) return c.json({ error: "student_profile_missing" }, 400);
  const studentId = sr.rows[0].id as string;
  const targetMinutes = homeworkTargetMinutesForUrgency(parsed.data.urgencyLevel);
  const homeworkAi = await classifyHomeworkPost({
    branchId: parsed.data.branchId,
    topic: parsed.data.topic.trim(),
    helpText: parsed.data.helpText.trim(),
    gradeLevelText: parsed.data.gradeLevelText?.trim() || null,
    targetExam: parsed.data.targetExam?.trim() || null,
    learningObjective: parsed.data.learningObjective?.trim() || null,
    urgencyLevel: parsed.data.urgencyLevel,
    imageUrls: parsed.data.imageUrls ?? [],
  });

  const client = await pool.connect();
  let ins: { rows: Array<{ id: string; status: string; created_at: Date }> };
  try {
    await client.query("begin");
    await lockStudentDailyUsage(studentId, client);
    const act = await getActiveStudentSubscription(userId, client);
    const policy = studentUsagePolicyForSubscription(act);
    const usage = await getStudentDailyUsage(studentId, policy, client, userId);
    if (usage.homeworkPostsToday >= policy.dailyHomeworkPostLimit) {
      const usedExtra = await consumeUsageCredit(userId, "student_homework", client);
      if (!usedExtra) {
        const packs = await listUsageCreditPacks("student", client);
        await client.query("rollback");
        return c.json(
          {
            error: "daily_homework_quota_exceeded",
            limit: policy.dailyHomeworkPostLimit,
            used: usage.homeworkPostsToday,
            tier: policy.tier,
            packs,
          },
          429,
        );
      }
    }

    ins = await client.query(
      `insert into student_homework_posts (
         student_id, branch_id, topic, help_text, image_urls_jsonb, audio_url,
         grade_level_text, target_exam, learning_objective, urgency_level,
         target_answer_minutes, resolution_sla_due_at, ai_metadata_jsonb, storage_backend
       ) values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, now() + ($11::int * interval '1 minute'), $12::jsonb, $13)
       returning id, status, created_at`,
      [
        studentId,
        parsed.data.branchId,
        parsed.data.topic.trim(),
        parsed.data.helpText.trim(),
        JSON.stringify(parsed.data.imageUrls ?? []),
        parsed.data.audioUrl?.trim() || null,
        parsed.data.gradeLevelText?.trim() || null,
        parsed.data.targetExam?.trim() || null,
        parsed.data.learningObjective?.trim() || null,
        parsed.data.urgencyLevel,
        targetMinutes,
        JSON.stringify(homeworkAi.aiMetadata),
        homeworkAi.storageBackend,
      ],
    );
    await client.query("commit");
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  // Aynı branştaki öğretmenlere bildirim (in-app). Not: öğretmen profiline bu branş ekli olanlar.
  const created = ins.rows[0] as { id: string };
  const topicShort =
    parsed.data.topic.trim().length > 120
      ? `${parsed.data.topic.trim().slice(0, 117)}…`
      : parsed.data.topic.trim();
  await pool.query(
    `insert into parent_notifications (
       recipient_user_id, student_id, snapshot_id, channel,
       title, body, payload_jsonb, delivery_status, sent_at
     )
     select u.id, $2::uuid, null, 'in_app',
            $3, $4, $5::jsonb, 'sent', now()
     from teacher_branches tb
     join teachers t on t.id = tb.teacher_id
     join users u on u.id = t.user_id
     where tb.branch_id = $1
       and u.role = 'teacher'
     order by tb.created_at desc nulls last
     limit 200`,
    [
      parsed.data.branchId,
      studentId,
      "Yeni soru/ödev",
      `"${topicShort}" için branş havuzunda yeni bir soru var. İlk üstlenen 20 dk boyunca çözebilir.`,
      JSON.stringify({
        kind: "homework_new_post",
        homeworkPostId: created.id,
        branchId: parsed.data.branchId,
        urgencyLevel: parsed.data.urgencyLevel,
        targetAnswerMinutes: targetMinutes,
      }),
    ],
  );

  const stuUidRow = await pool.query(`select user_id from students where id = $1`, [studentId]);
  const studentUserIdForGuard = stuUidRow.rowCount ? (stuUidRow.rows[0].user_id as string) : null;
  const gNewRows = await pool.query(
    `select guardian_user_id from student_guardians where student_id = $1`,
    [studentId],
  );
  const gNewPayload = JSON.stringify({
    kind: "homework_new_post_guardian",
    homeworkPostId: created.id,
    branchId: parsed.data.branchId,
    urgencyLevel: parsed.data.urgencyLevel,
    targetAnswerMinutes: targetMinutes,
  });
  for (const g of gNewRows.rows) {
    const gid = g.guardian_user_id as string;
    if (studentUserIdForGuard && gid === studentUserIdForGuard) continue;
    await pool.query(
      `insert into parent_notifications (
         recipient_user_id, student_id, snapshot_id, channel,
         title, body, payload_jsonb, delivery_status, sent_at
       ) values ($1, $2, null, 'in_app', $3, $4, $5::jsonb, 'sent', now())`,
      [
        gid,
        studentId,
        "Öğrenci ödev gönderdi",
        `"${topicShort}" konusunda branş havuzuna soru/ödev eklendi.`,
        gNewPayload,
      ],
    );
  }

  return c.json({ post: ins.rows[0] }, 201);
});

studentPlatform.get("/homework-posts/mine", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "student") return c.json({ error: "forbidden_students_only" }, 403);

  await releaseExpiredHomeworkClaims(pool);

  const sr = await pool.query(`select id from students where user_id = $1`, [userId]);
  if (!sr.rowCount) return c.json({ posts: [] });
  const r = await pool.query(
    `select h.id, h.branch_id, b.name as branch_name, h.topic, h.status, h.created_at,
            h.help_text, h.image_urls_jsonb, h.audio_url,
            h.grade_level_text, h.target_exam, h.learning_objective, h.urgency_level,
            h.claimed_at, h.resolve_deadline_at, h.answered_at, h.answer_text, h.answer_image_urls_jsonb,
            h.answer_video_url, h.target_answer_minutes, h.quality_status, h.quality_score,
            h.ai_metadata_jsonb, h.storage_backend, h.answer_quality_jsonb,
            h.revision_requested_at, h.accepted_quality_at, h.moderator_note, h.resolution_sla_due_at,
            h.student_satisfied_at, h.homework_reward_minor, h.homework_reward_applied_at,
            h.last_answer_rejected_at,
            tu.display_name as teacher_display_name
     from student_homework_posts h
     left join branches b on b.id = h.branch_id
     left join teachers t on t.id = h.claimed_by_teacher_id
     left join users tu on tu.id = t.user_id
     where h.student_id = $1
     order by h.created_at desc
     limit 100`,
    [sr.rows[0].id as string],
  );
  return c.json({ posts: r.rows });
});

const createDirectSchema = z.object({
  teacherId: z.string().uuid(),
  agreedAmountMinor: z.number().int().min(1000), // 10,00 TL minimum
});

function moneyTl(minor: number): string {
  return `${(minor / 100).toFixed(2)} TL`;
}

/** Yönlendirme / havuz: öğretmen havuzu için ilan; ödeme aşaması: cüzdan/ödeme ayrıca tamamlanacak */
studentPlatform.post("/direct-bookings", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "student") return c.json({ error: "forbidden_students_only" }, 403);

  const act = await getActiveStudentSubscription(userId);
  if (!act) {
    return c.json(
      { error: "student_platform_subscription_required" },
      403,
    );
  }

  const parsed = createDirectSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const sr = await pool.query(`select id from students where user_id = $1`, [userId]);
  if (!sr.rowCount) return c.json({ error: "student_profile_missing" }, 400);
  const studentId = sr.rows[0].id as string;

  const tr = await pool.query(
    `select 1 from teachers t join users u on u.id = t.user_id where t.id = $1 and u.role = 'teacher'`,
    [parsed.data.teacherId],
  );
  if (!tr.rowCount) return c.json({ error: "teacher_not_found" }, 404);

  const ins = await pool.query(
    `insert into direct_lesson_bookings (
       student_id, teacher_id, agreed_amount_minor, status
     ) values ($1, $2, $3, 'pending_funding')
     returning id, status, created_at, agreed_amount_minor, currency`,
    [studentId, parsed.data.teacherId, parsed.data.agreedAmountMinor],
  );
  await pool.query(
    `insert into parent_notifications (
       recipient_user_id, student_id, snapshot_id, channel,
       title, body, payload_jsonb, delivery_status, sent_at
     )
     select u.id, $2::uuid, null, 'in_app', $3, $4, $5::jsonb, 'sent', now()
     from teachers t
     join users u on u.id = t.user_id
     where t.id = $1`,
    [
      parsed.data.teacherId,
      studentId,
      "Yeni doğrudan ders anlaşması",
      `${moneyTl(parsed.data.agreedAmountMinor)} tutarında doğrudan ders anlaşması oluşturuldu. Öğrenci ödemeyi tamamlayınca aksiyon alabilirsiniz.`,
      JSON.stringify({
        kind: "direct_booking_created",
        directBookingId: (ins.rows[0] as { id: string }).id,
      }),
    ],
  );
  return c.json(
    {
      booking: ins.rows[0],
      next: {
        fundFromWallet: `POST /v1/student-platform/direct-bookings/${(ins.rows[0] as { id: string }).id}/fund-from-wallet`,
        walletTopup: "POST /v1/wallet/topup",
      },
    },
    201,
  );
});

/** Öğrenci: doğrudan ders anlaşmalarım */
studentPlatform.get("/direct-bookings/mine", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "student") return c.json({ error: "forbidden_students_only" }, 403);
  const sr = await pool.query(`select id from students where user_id = $1`, [userId]);
  if (!sr.rowCount) return c.json({ bookings: [] });
  const r = await pool.query(
    `select b.id, b.teacher_id, b.agreed_amount_minor, b.status, b.funded_at, b.completed_at, b.created_at,
            u.display_name as teacher_display_name
     from direct_lesson_bookings b
     join teachers t on t.id = b.teacher_id
     join users u on u.id = t.user_id
     where b.student_id = $1
     order by b.created_at desc
     limit 100`,
    [sr.rows[0].id as string],
  );
  return c.json({ bookings: r.rows });
});

/** Öğretmen: bana açılan doğrudan ders anlaşmaları */
studentPlatform.get("/direct-bookings/teacher-mine", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "teacher") return c.json({ error: "forbidden_teachers_only" }, 403);
  const tr = await pool.query(`select id from teachers where user_id = $1`, [userId]);
  if (!tr.rowCount) return c.json({ bookings: [] });
  const r = await pool.query(
    `select b.id, b.student_id, b.agreed_amount_minor, b.status, b.funded_at, b.completed_at, b.teacher_payout_minor, b.created_at,
            u.display_name as student_display_name
     from direct_lesson_bookings b
     join students s on s.id = b.student_id
     join users u on u.id = s.user_id
     where b.teacher_id = $1
     order by b.created_at desc
     limit 100`,
    [tr.rows[0].id as string],
  );
  return c.json({ bookings: r.rows });
});

studentPlatform.post("/direct-bookings/:bookingId/fund-from-wallet", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "student") return c.json({ error: "forbidden_students_only" }, 403);
  const bookingId = c.req.param("bookingId");
  if (!z.string().uuid().safeParse(bookingId).success) return c.json({ error: "invalid_booking_id" }, 400);

  const sr = await pool.query(`select id from students where user_id = $1`, [userId]);
  if (!sr.rowCount) return c.json({ error: "student_profile_missing" }, 400);
  const studentId = sr.rows[0].id as string;

  const cpool = await pool.connect();
  try {
    await cpool.query("begin");
    const bq = await cpool.query(
      `select b.id, b.agreed_amount_minor, b.status, b.student_id, b.teacher_id
       from direct_lesson_bookings b
       where b.id = $1
       for update`,
      [bookingId],
    );
    if (!bq.rowCount) {
      await cpool.query("rollback");
      return c.json({ error: "not_found" }, 404);
    }
    const b = bq.rows[0] as {
      id: string;
      agreed_amount_minor: number;
      status: string;
      student_id: string;
      teacher_id: string;
    };
    if (b.student_id !== studentId) {
      await cpool.query("rollback");
      return c.json({ error: "forbidden" }, 403);
    }
    if (b.status !== "pending_funding") {
      await cpool.query("rollback");
      return c.json({ error: "not_pending_funding" }, 409);
    }
    const amt = b.agreed_amount_minor;
    try {
      await applyWalletDelta({
        userId,
        deltaMinor: -amt,
        kind: "direct_booking_hold",
        refType: "direct_lesson_bookings",
        refId: b.id,
        client: cpool,
        metadata: { note: "Rezervasyon (havuz)" },
      });
    } catch (e) {
      await cpool.query("rollback").catch(() => {});
      const err = e as { message?: string };
      if (err?.message === "insufficient_balance") {
        return c.json({ error: "insufficient_balance" }, 409);
      }
      throw e;
    }
    await cpool.query(
      `update direct_lesson_bookings
       set status = 'funded', funded_at = now(), updated_at = now()
       where id = $1`,
      [b.id],
    );
    await cpool.query(
      `insert into parent_notifications (
         recipient_user_id, student_id, snapshot_id, channel,
         title, body, payload_jsonb, delivery_status, sent_at
       )
       select u.id, $2::uuid, null, 'in_app', $3, $4, $5::jsonb, 'sent', now()
       from teachers t
       join users u on u.id = t.user_id
       where t.id = $1`,
      [
        b.teacher_id,
        studentId,
        "Doğrudan ders ödemesi tamamlandı",
        `${moneyTl(Number(b.agreed_amount_minor))} tutarındaki doğrudan ders ödemesi alındı. Dersi verdikten sonra tamamlayarak hak edişi cüzdanınıza aktarabilirsiniz.`,
        JSON.stringify({ kind: "direct_booking_funded", directBookingId: b.id }),
      ],
    );
    await cpool.query("commit");
    return c.json({ ok: true, status: "funded" });
  } catch (e) {
    await cpool.query("rollback").catch(() => {});
    throw e;
  } finally {
    cpool.release();
  }
});

studentPlatform.post("/direct-bookings/:bookingId/complete", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "teacher") return c.json({ error: "forbidden_teachers_only" }, 403);
  const bookingId = c.req.param("bookingId");
  if (!z.string().uuid().safeParse(bookingId).success) return c.json({ error: "invalid_booking_id" }, 400);

  const tr = await pool.query(
    `select t.id, t.user_id
     from teachers t
     where t.user_id = $1`,
    [userId],
  );
  if (!tr.rowCount) return c.json({ error: "teacher_profile_missing" }, 400);
  const teacherRowId = tr.rows[0].id as string;
  const teacherUserId = tr.rows[0].user_id as string;

  const cpool = await pool.connect();
  try {
    await cpool.query("begin");
    const bq = await cpool.query(
      `select b.id, b.agreed_amount_minor, b.status, b.teacher_id, b.student_id
       from direct_lesson_bookings b
       where b.id = $1
       for update`,
      [bookingId],
    );
    if (!bq.rowCount) {
      await cpool.query("rollback");
      return c.json({ error: "not_found" }, 404);
    }
    const b = bq.rows[0] as {
      id: string;
      agreed_amount_minor: number;
      status: string;
      teacher_id: string;
      student_id: string;
    };
    if (b.teacher_id !== teacherRowId) {
      await cpool.query("rollback");
      return c.json({ error: "forbidden" }, 403);
    }
    if (b.status !== "funded") {
      await cpool.query("rollback");
      return c.json({ error: "not_funded" }, 409);
    }
    const { payout, fee } = teacherPayoutFromGross(b.agreed_amount_minor);
    if (payout > 0) {
      await applyWalletDelta({
        userId: teacherUserId,
        deltaMinor: payout,
        kind: "direct_booking_payout",
        refType: "direct_lesson_bookings",
        refId: b.id,
        client: cpool,
        metadata: { platform_fee_minor: fee },
      });
    }
    await cpool.query(
      `update direct_lesson_bookings
       set status = 'completed',
           completed_at = now(),
           teacher_payout_minor = $2,
           updated_at = now()
       where id = $1`,
      [b.id, payout],
    );
    await cpool.query(
      `insert into parent_notifications (
         recipient_user_id, student_id, snapshot_id, channel,
         title, body, payload_jsonb, delivery_status, sent_at
       )
       select recipient_user_id, $1::uuid, null, 'in_app', $2, $3, $4::jsonb, 'sent', now()
       from (
         select st.user_id as recipient_user_id
         from students st
         where st.id = $1
         union
         select sg.guardian_user_id as recipient_user_id
         from student_guardians sg
         where sg.student_id = $1
       ) recipients`,
      [
        b.student_id,
        "Doğrudan ders tamamlandı",
        "Öğretmen doğrudan dersi tamamlandı olarak işaretledi. Ders anlaşmaları ekranından süreci görebilirsiniz.",
        JSON.stringify({ kind: "direct_booking_completed", directBookingId: b.id }),
      ],
    );
    await cpool.query("commit");
    return c.json({ ok: true, status: "completed" });
  } catch (e) {
    await cpool.query("rollback").catch(() => {});
    throw e;
  } finally {
    cpool.release();
  }
});

/** Öğretmen: branş havuzundaki açık ödev/soru gönderileri (üstlenilmiş süre dolana kadar havuzda görünmez) */
studentPlatform.get("/homework-posts/teacher/feed", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "teacher") {
    return c.json({ error: "forbidden_teachers_only" }, 403);
  }

  await releaseExpiredHomeworkClaims(pool);

  const tr = await pool.query(`select id from teachers where user_id = $1`, [userId]);
  if (!tr.rowCount) return c.json({ error: "teacher_profile_missing" }, 400);
  const teacherId = tr.rows[0].id as string;

  const branchId = c.req.query("branchId");
  if (!branchId) return c.json({ error: "branchId_required" }, 400);
  const bid = Number(branchId);
  if (!Number.isFinite(bid) || bid <= 0) return c.json({ error: "invalid_branch_id" }, 400);

  const own = await pool.query(
    `select 1 from teacher_branches where teacher_id = $1 and branch_id = $2`,
    [teacherId, bid],
  );
  if (!own.rowCount) {
    return c.json({ error: "forbidden_not_your_branch" }, 403);
  }

  const resolveMin = homeworkResolveMinutes();
  const r = await pool.query(
    `select h.id, h.topic, h.status, h.created_at, h.help_text, h.image_urls_jsonb, h.audio_url,
            h.grade_level_text, h.target_exam, h.learning_objective, h.urgency_level,
            h.target_answer_minutes, h.quality_status, h.resolution_sla_due_at,
            h.ai_metadata_jsonb, h.storage_backend,
            u.display_name as student_display_name
     from student_homework_posts h
     join students s on s.id = h.student_id
     join users u on u.id = s.user_id
     where h.branch_id = $1 and h.status = 'open'
     order by
       case h.urgency_level when 'urgent' then 0 when 'priority' then 1 else 2 end,
       h.resolution_sla_due_at asc nulls last,
       h.created_at desc
     limit 50`,
    [bid],
  );
  return c.json({
    posts: r.rows,
    resolveMinutes: resolveMin,
    satisfactionRewardMinor: homeworkSatisfactionRewardMinor(),
  });
});

/** Öğretmen: üstlendiğim / cevapladığım gönderiler */
studentPlatform.get("/homework-posts/teacher/claims", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "teacher") {
    return c.json({ error: "forbidden_teachers_only" }, 403);
  }

  await releaseExpiredHomeworkClaims(pool);

  const tr = await pool.query(`select id from teachers where user_id = $1`, [userId]);
  if (!tr.rowCount) return c.json({ error: "teacher_profile_missing" }, 400);
  const teacherId = tr.rows[0].id as string;

  const resolveMin = homeworkResolveMinutes();
  const r = await pool.query(
    `select h.id, h.branch_id, h.topic, h.status, h.created_at, h.help_text, h.image_urls_jsonb, h.audio_url,
            h.grade_level_text, h.target_exam, h.learning_objective, h.urgency_level,
            h.claimed_at, h.resolve_deadline_at, h.answered_at, h.answer_text, h.answer_image_urls_jsonb,
            h.answer_video_url, h.target_answer_minutes, h.quality_status, h.quality_score,
            h.ai_metadata_jsonb, h.storage_backend, h.answer_quality_jsonb,
            h.revision_requested_at, h.accepted_quality_at, h.moderator_note, h.resolution_sla_due_at,
            u.display_name as student_display_name
     from student_homework_posts h
     join students s on s.id = h.student_id
     join users u on u.id = s.user_id
     where h.claimed_by_teacher_id = $1
       and h.status in ('claimed', 'answered')
     order by h.updated_at desc
     limit 50`,
    [teacherId],
  );
  return c.json({
    posts: r.rows,
    resolveMinutes: resolveMin,
    satisfactionRewardMinor: homeworkSatisfactionRewardMinor(),
  });
});

/** Öğrenci (sahip) veya üstlenen öğretmen: tek kayıt */
studentPlatform.get("/homework-posts/view/:postId", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  const postId = c.req.param("postId");
  if (!z.string().uuid().safeParse(postId).success) return c.json({ error: "invalid_post_id" }, 400);

  await releaseExpiredHomeworkClaims(pool);

  const r = await pool.query(
    `select h.*, b.name as branch_name,
            su.display_name as student_display_name,
            tu.display_name as teacher_display_name
     from student_homework_posts h
     left join branches b on b.id = h.branch_id
     join students s on s.id = h.student_id
     join users su on su.id = s.user_id
     left join teachers t on t.id = h.claimed_by_teacher_id
     left join users tu on tu.id = t.user_id
     where h.id = $1`,
    [postId],
  );
  if (!r.rowCount) return c.json({ error: "not_found" }, 404);
  const row = r.rows[0] as { student_id: string; claimed_by_teacher_id: string | null };
  const sr = await pool.query(`select id from students where user_id = $1`, [userId]);
  const tr = await pool.query(`select id from teachers where user_id = $1`, [userId]);
  const studentRowId = sr.rowCount ? (sr.rows[0].id as string) : null;
  const teacherRowId = tr.rowCount ? (tr.rows[0].id as string) : null;

  const isStudentOwner = role === "student" && studentRowId === row.student_id;
  const isClaimingTeacher =
    role === "teacher" && teacherRowId && row.claimed_by_teacher_id === teacherRowId;
  if (!isStudentOwner && !isClaimingTeacher) {
    return c.json({ error: "forbidden" }, 403);
  }

  return c.json({
    post: r.rows[0],
    resolveMinutes: homeworkResolveMinutes(),
    satisfactionRewardMinor: homeworkSatisfactionRewardMinor(),
  });
});

const answerHomeworkSchema = z.object({
  answerText: z.string().min(10).max(16_000),
  answerImageUrls: z.array(z.string().min(1).max(450_000)).max(4).optional().default([]),
  answerVideoUrl: z
    .union([z.string().url().max(2000), z.literal(""), z.null()])
    .optional()
    .nullable(),
});

function qualityScoreFivePoint(scorePercent: number): number {
  return Math.max(1, Math.min(5, Math.ceil(scorePercent / 20)));
}

studentPlatform.post("/homework-posts/:postId/claim", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "teacher") {
    return c.json({ error: "forbidden_teachers_only" }, 403);
  }

  const postId = c.req.param("postId");
  if (!z.string().uuid().safeParse(postId).success) return c.json({ error: "invalid_post_id" }, 400);

  await releaseExpiredHomeworkClaims(pool);

  const tr = await pool.query(`select id from teachers where user_id = $1`, [userId]);
  if (!tr.rowCount) return c.json({ error: "teacher_profile_missing" }, 400);
  const teacherId = tr.rows[0].id as string;

  const resolveMin = homeworkResolveMinutes();
  const r = await pool.query(
    `update student_homework_posts
     set status = 'claimed',
         claimed_by_teacher_id = $1,
         claimed_at = now(),
        resolve_deadline_at = now() + (coalesce(nullif(target_answer_minutes, 0), $3)::int * interval '1 minute'),
        target_answer_minutes = coalesce(nullif(target_answer_minutes, 0), $3),
        resolution_sla_due_at = now() + (coalesce(nullif(target_answer_minutes, 0), $3)::int * interval '1 minute'),
         quality_status = 'not_reviewed',
         last_answer_rejected_at = null,
         updated_at = now()
     where id = $2
       and status = 'open'
     returning id, status, claimed_at, resolve_deadline_at, student_id, topic`,
    [teacherId, postId, resolveMin],
  );
  if (!r.rowCount) {
    return c.json({ error: "not_open_or_taken" }, 409);
  }
  const claimed = r.rows[0] as {
    student_id: string;
    topic: string;
  };
  const tn = await pool.query(
    `select u.display_name from teachers t join users u on u.id = t.user_id where t.id = $1`,
    [teacherId],
  );
  const teacherName = tn.rowCount ? String(tn.rows[0].display_name ?? "Öğretmen") : "Öğretmen";
  const topicShort =
    claimed.topic.length > 100 ? `${claimed.topic.slice(0, 97)}…` : claimed.topic;

  const su = await pool.query(`select user_id from students where id = $1`, [claimed.student_id]);
  if (su.rowCount) {
    const studentUserId = su.rows[0].user_id as string;
    await pool.query(
      `insert into parent_notifications (
         recipient_user_id, student_id, snapshot_id, channel,
         title, body, payload_jsonb, delivery_status, sent_at
       ) values ($1, $2, null, 'in_app', $3, $4, $5::jsonb, 'sent', now())`,
      [
        studentUserId,
        claimed.student_id,
        "Ödev sorunuz üstlenildi",
        `${teacherName} "${topicShort}" sorunuzu üstlendi; yaklaşık ${resolveMin} dakika içinde cevap beklenir.`,
        JSON.stringify({
          kind: "homework_claimed",
          homeworkPostId: postId,
          resolveMinutes: resolveMin,
        }),
      ],
    );

    const guardians = await pool.query(
      `select guardian_user_id from student_guardians where student_id = $1`,
      [claimed.student_id],
    );
    for (const g of guardians.rows) {
      const gid = g.guardian_user_id as string;
      if (gid === studentUserId) continue;
      await pool.query(
        `insert into parent_notifications (
           recipient_user_id, student_id, snapshot_id, channel,
           title, body, payload_jsonb, delivery_status, sent_at
         ) values ($1, $2, null, 'in_app', $3, $4, $5::jsonb, 'sent', now())`,
        [
          gid,
          claimed.student_id,
          "Öğrencinizin ödevi üstlenildi",
          `${teacherName}, bağlı öğrencinizin "${topicShort}" sorusunu üstlendi (yaklaşık ${resolveMin} dk içinde cevap beklenir).`,
          JSON.stringify({
            kind: "homework_claimed_guardian",
            homeworkPostId: postId,
            resolveMinutes: resolveMin,
          }),
        ],
      );
    }
  }

  return c.json({ post: r.rows[0], resolveMinutes: resolveMin });
});

/** Öğretmen: üstlendiğim soruyu iade et (havuz açılır; ödeme yok) */
studentPlatform.post("/homework-posts/:postId/teacher-return", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "teacher") return c.json({ error: "forbidden_teachers_only" }, 403);

  const postId = c.req.param("postId");
  if (!z.string().uuid().safeParse(postId).success) return c.json({ error: "invalid_post_id" }, 400);

  await releaseExpiredHomeworkClaims(pool);

  const tr = await pool.query(`select id from teachers where user_id = $1`, [userId]);
  if (!tr.rowCount) return c.json({ error: "teacher_profile_missing" }, 400);
  const teacherId = tr.rows[0].id as string;

  const r = await pool.query(
    `update student_homework_posts
     set status = 'open',
         claimed_by_teacher_id = null,
         claimed_at = null,
         resolve_deadline_at = null,
         resolution_sla_due_at = null,
         last_answer_rejected_at = null,
         updated_at = now()
     where id = $1
       and status = 'claimed'
       and claimed_by_teacher_id = $2
       and answered_at is null
     returning id, student_id, topic, branch_id`,
    [postId, teacherId],
  );
  if (!r.rowCount) return c.json({ error: "not_claimed_by_you_or_not_claimed" }, 409);

  const row = r.rows[0] as { student_id: string; topic: string; branch_id: number };
  const topicShort = row.topic.length > 120 ? `${row.topic.slice(0, 117)}…` : row.topic;

  const su = await pool.query(`select user_id from students where id = $1`, [row.student_id]);
  if (su.rowCount) {
    const studentUserId = su.rows[0].user_id as string;
    await pool.query(
      `insert into parent_notifications (
         recipient_user_id, student_id, snapshot_id, channel,
         title, body, payload_jsonb, delivery_status, sent_at
       ) values ($1, $2, null, 'in_app', $3, $4, $5::jsonb, 'sent', now())`,
      [
        studentUserId,
        row.student_id,
        "Ödev sorusu iade edildi",
        `"${topicShort}" için öğretmen soruyu iade etti; soru tekrar branş havuzunda.`,
        JSON.stringify({ kind: "homework_teacher_returned", homeworkPostId: postId, branchId: row.branch_id }),
      ],
    );

    const guardians = await pool.query(
      `select guardian_user_id from student_guardians where student_id = $1`,
      [row.student_id],
    );
    for (const g of guardians.rows) {
      const gid = g.guardian_user_id as string;
      if (gid === studentUserId) continue;
      await pool.query(
        `insert into parent_notifications (
           recipient_user_id, student_id, snapshot_id, channel,
           title, body, payload_jsonb, delivery_status, sent_at
         ) values ($1, $2, null, 'in_app', $3, $4, $5::jsonb, 'sent', now())`,
        [
          gid,
          row.student_id,
          "Öğrencinizin ödevi iade edildi",
          `Bağlı öğrencinizin "${topicShort}" sorusu öğretmen tarafından iade edildi; soru tekrar havuzda.`,
          JSON.stringify({
            kind: "homework_teacher_returned_guardian",
            homeworkPostId: postId,
            branchId: row.branch_id,
          }),
        ],
      );
    }
  }

  return c.json({ ok: true, status: "open" });
});

studentPlatform.post("/homework-posts/:postId/answer", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "teacher") {
    return c.json({ error: "forbidden_teachers_only" }, 403);
  }

  const postId = c.req.param("postId");
  if (!z.string().uuid().safeParse(postId).success) return c.json({ error: "invalid_post_id" }, 400);

  const parsed = answerHomeworkSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  for (const u of parsed.data.answerImageUrls ?? []) {
    if (!isAllowedHomeworkImageUrl(u)) {
      return c.json(
        { error: "invalid_image_url", hint: "Görsel: https URL veya data:image/jpeg|png|webp;base64,..." },
        400,
      );
    }
  }

  await releaseExpiredHomeworkClaims(pool);

  const tr = await pool.query(`select id from teachers where user_id = $1`, [userId]);
  if (!tr.rowCount) return c.json({ error: "teacher_profile_missing" }, 400);
  const teacherId = tr.rows[0].id as string;
  const answerQuality = await scoreHomeworkAnswer({
    answerText: parsed.data.answerText.trim(),
    answerImageUrls: parsed.data.answerImageUrls ?? [],
    answerVideoUrl: parsed.data.answerVideoUrl?.trim() || null,
  });

  const r = await pool.query(
    `update student_homework_posts
     set status = 'answered',
         answer_text = $2,
         answer_image_urls_jsonb = $3::jsonb,
         answer_video_url = $5,
         answered_at = now(),
         quality_status = 'pending_review',
         quality_score = $6,
         answer_quality_jsonb = $7::jsonb,
         last_answer_rejected_at = null,
         updated_at = now()
     where id = $1
       and claimed_by_teacher_id = $4
       and status = 'claimed'
       and (resolve_deadline_at is null or resolve_deadline_at > now())
     returning id, status, answered_at, student_id, topic, quality_score, answer_quality_jsonb`,
    [
      postId,
      parsed.data.answerText.trim(),
      JSON.stringify(parsed.data.answerImageUrls ?? []),
      teacherId,
      parsed.data.answerVideoUrl?.trim() || null,
      qualityScoreFivePoint(answerQuality.qualityScore),
      JSON.stringify(answerQuality.quality),
    ],
  );
  if (!r.rowCount) {
    return c.json({ error: "not_claimed_by_you_or_expired_or_not_claimed" }, 409);
  }
  const answered = r.rows[0] as { student_id: string; topic: string };
  const su = await pool.query(`select user_id from students where id = $1`, [answered.student_id]);
  if (su.rowCount) {
    const recipientUserId = su.rows[0].user_id as string;
    const topicShort =
      answered.topic.length > 120 ? `${answered.topic.slice(0, 117)}…` : answered.topic;
    await pool.query(
      `insert into parent_notifications (
         recipient_user_id, student_id, snapshot_id, channel,
         title, body, payload_jsonb, delivery_status, sent_at
       ) values ($1, $2, null, 'in_app', $3, $4, $5::jsonb, 'sent', now())`,
      [
        recipientUserId,
        answered.student_id,
        "Ödev sorunuza cevap geldi",
        `"${topicShort}" konusunda öğretmen cevabını gönderdi. Gönderilerim sayfasından inceleyip onaylayabilirsiniz.`,
        JSON.stringify({ kind: "homework_answered", homeworkPostId: postId }),
      ],
    );

    const guardians = await pool.query(
      `select guardian_user_id from student_guardians where student_id = $1`,
      [answered.student_id],
    );
    for (const g of guardians.rows) {
      const gid = g.guardian_user_id as string;
      if (gid === recipientUserId) continue;
      await pool.query(
        `insert into parent_notifications (
           recipient_user_id, student_id, snapshot_id, channel,
           title, body, payload_jsonb, delivery_status, sent_at
         ) values ($1, $2, null, 'in_app', $3, $4, $5::jsonb, 'sent', now())`,
        [
          gid,
          answered.student_id,
          "Öğrencinizin ödev sorusuna cevap",
          `Bağlı öğrencinizin "${topicShort}" sorusuna öğretmen cevap gönderdi. Öğrenci onayladığında ödeme platform havuzundan öğretmene aktarılır.`,
          JSON.stringify({
            kind: "homework_answered_guardian",
            homeworkPostId: postId,
            studentId: answered.student_id,
          }),
        ],
      );
    }
  }
  return c.json({ post: r.rows[0] });
});

studentPlatform.post("/homework-posts/:postId/mark-satisfied", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "student") return c.json({ error: "forbidden_students_only" }, 403);

  const postId = c.req.param("postId");
  if (!z.string().uuid().safeParse(postId).success) return c.json({ error: "invalid_post_id" }, 400);

  await releaseExpiredHomeworkClaims(pool);

  const rewardMinor = homeworkSatisfactionRewardMinor();
  const platformWalletUserId = await resolvePlatformHomeworkWalletUserId();
  if (!platformWalletUserId) {
    return c.json(
      {
        error: "platform_homework_wallet_not_configured",
        hint: "PLATFORM_HOMEWORK_WALLET_USER_ID ile havuz kullanıcısı tanımlayın; admin bu kullanıcıya wallet grant ile bakiye yükler.",
      },
      503,
    );
  }

  const sr = await pool.query(`select id from students where user_id = $1`, [userId]);
  if (!sr.rowCount) return c.json({ error: "student_profile_missing" }, 400);
  const studentRowId = sr.rows[0].id as string;

  const cpool = await pool.connect();
  try {
    await cpool.query("begin");
    const pq = await cpool.query(
      `select h.id, h.claimed_by_teacher_id, h.topic, t.user_id as teacher_user_id
       from student_homework_posts h
       join teachers t on t.id = h.claimed_by_teacher_id
       where h.id = $1
         and h.student_id = $2
         and h.status = 'answered'
         and h.homework_reward_applied_at is null
       for update`,
      [postId, studentRowId],
    );
    if (!pq.rowCount) {
      await cpool.query("rollback");
      return c.json({ error: "not_answered_or_already_rewarded_or_not_owner" }, 409);
    }
    const row = pq.rows[0] as { teacher_user_id: string; topic: string };

    if (platformWalletUserId === row.teacher_user_id) {
      await cpool.query("rollback");
      return c.json({ error: "platform_wallet_teacher_conflict" }, 409);
    }

    await ensureUserWalletRow(platformWalletUserId, cpool);
    const wq = await cpool.query(
      `select balance_minor::text from user_wallets where user_id = $1 for update`,
      [platformWalletUserId],
    );
    const poolBal = wq.rowCount ? BigInt(String(wq.rows[0].balance_minor)) : 0n;
    if (poolBal < BigInt(rewardMinor)) {
      await cpool.query("rollback");
      return c.json(
        {
          error: "insufficient_platform_pool_balance",
          requiredMinor: rewardMinor,
          balanceMinor: Number(poolBal),
          hint: "Ödev ödeme havuzunda yeterli bakiye yok. Yönetim platform cüzdanına yükleme yapmalı.",
        },
        409,
      );
    }

    await applyWalletDelta({
      userId: platformWalletUserId,
      deltaMinor: -rewardMinor,
      kind: "homework_platform_pool_debit",
      refType: "student_homework_posts",
      refId: postId,
      client: cpool,
      metadata: { teacher_user_id: row.teacher_user_id, student_user_id: userId },
    });
    await applyWalletDelta({
      userId: row.teacher_user_id,
      deltaMinor: rewardMinor,
      kind: "homework_satisfaction_reward",
      refType: "student_homework_posts",
      refId: postId,
      client: cpool,
      metadata: { student_user_id: userId },
    });

    await cpool.query(
      `update student_homework_posts
       set status = 'closed',
           student_satisfied_at = now(),
           homework_reward_minor = $2,
           homework_reward_applied_at = now(),
           quality_status = 'accepted',
           quality_score = 5,
           accepted_quality_at = now(),
           updated_at = now()
       where id = $1`,
      [postId, rewardMinor],
    );

    const tl = (rewardMinor / 100).toFixed(2);
    const topicShort = row.topic.length > 100 ? `${row.topic.slice(0, 97)}…` : row.topic;
    await cpool.query(
      `insert into parent_notifications (
         recipient_user_id, student_id, snapshot_id, channel,
         title, body, payload_jsonb, delivery_status, sent_at
       ) values ($1, $2, null, 'in_app', $3, $4, $5::jsonb, 'sent', now())`,
      [
        row.teacher_user_id,
        studentRowId,
        "Ödev cevabınız onaylandı",
        `Öğrenci "${topicShort}" sorusunda cevabınızı yeterli buldu. ${tl} TL cüzdanınıza aktarıldı.`,
        JSON.stringify({ kind: "homework_rewarded", homeworkPostId: postId, rewardMinor }),
      ],
    );

    const gRows = await cpool.query(
      `select guardian_user_id from student_guardians where student_id = $1`,
      [studentRowId],
    );
    const studentUid = await cpool.query(`select user_id from students where id = $1`, [studentRowId]);
    const stuUid = studentUid.rowCount ? (studentUid.rows[0].user_id as string) : null;
    for (const g of gRows.rows) {
      const gid = g.guardian_user_id as string;
      if (stuUid && gid === stuUid) continue;
      await cpool.query(
        `insert into parent_notifications (
           recipient_user_id, student_id, snapshot_id, channel,
           title, body, payload_jsonb, delivery_status, sent_at
         ) values ($1, $2, null, 'in_app', $3, $4, $5::jsonb, 'sent', now())`,
        [
          gid,
          studentRowId,
          "Öğrenci ödev ödemesini onayladı",
          `Bağlı öğrenciniz "${topicShort}" ödev cevabını onayladı; öğretmene ${tl} TL platform havuzundan aktarıldı.`,
          JSON.stringify({
            kind: "homework_rewarded_guardian",
            homeworkPostId: postId,
            rewardMinor,
          }),
        ],
      );
    }

    if (stuUid) {
      await cpool.query(
        `insert into parent_notifications (
           recipient_user_id, student_id, snapshot_id, channel,
           title, body, payload_jsonb, delivery_status, sent_at
         ) values ($1, $2, null, 'in_app', $3, $4, $5::jsonb, 'sent', now())`,
        [
          stuUid,
          studentRowId,
          "Ödev ödemesi tamamlandı",
          `"${topicShort}" için öğretmene ${tl} TL platform havuzundan aktarıldı; işlem tamam.`,
          JSON.stringify({ kind: "homework_rewarded_student", homeworkPostId: postId, rewardMinor }),
        ],
      );
    }

    await cpool.query("commit");
    return c.json({ ok: true, rewardMinor, status: "closed" });
  } catch (e) {
    await cpool.query("rollback").catch(() => {});
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("insufficient_balance")) {
      return c.json({ error: "insufficient_platform_pool_balance", requiredMinor: rewardMinor }, 409);
    }
    throw e;
  } finally {
    cpool.release();
  }
});

const rejectHomeworkAnswerSchema = z.object({
  note: z.string().max(500).optional(),
});

/** Öğrenci: ödeme öncesi cevabı yeterli bulmazsa soruyu tekrar havuza açar (cevap temizlenir). */
studentPlatform.post("/homework-posts/:postId/reject-answer", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "student") return c.json({ error: "forbidden_students_only" }, 403);

  const postId = c.req.param("postId");
  if (!z.string().uuid().safeParse(postId).success) return c.json({ error: "invalid_post_id" }, 400);

  let raw: unknown = {};
  try {
    raw = await c.req.json();
  } catch {
    /* empty body */
  }
  const parsed = rejectHomeworkAnswerSchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  await releaseExpiredHomeworkClaims(pool);

  const sr = await pool.query(`select id from students where user_id = $1`, [userId]);
  if (!sr.rowCount) return c.json({ error: "student_profile_missing" }, 400);
  const studentRowId = sr.rows[0].id as string;

  const noteTrim = parsed.data.note?.trim() ?? "";
  const noteForNotif = noteTrim.length > 280 ? `${noteTrim.slice(0, 277)}…` : noteTrim;

  const cpool = await pool.connect();
  try {
    await cpool.query("begin");
    const pq = await cpool.query(
      `select h.id, h.topic, h.claimed_by_teacher_id, t.user_id as teacher_user_id
       from student_homework_posts h
       left join teachers t on t.id = h.claimed_by_teacher_id
       where h.id = $1
         and h.student_id = $2
         and h.status = 'answered'
         and h.homework_reward_applied_at is null
       for update`,
      [postId, studentRowId],
    );
    if (!pq.rowCount) {
      await cpool.query("rollback");
      return c.json(
        {
          error: "not_rejectable",
          hint: "Yalnızca cevaplanmış ve henüz ödeme onayı verilmemiş gönderiler iade edilebilir.",
        },
        409,
      );
    }
    const row = pq.rows[0] as { topic: string; teacher_user_id: string | null };
    const topicShort = row.topic.length > 100 ? `${row.topic.slice(0, 97)}…` : row.topic;

    await cpool.query(
      `update student_homework_posts
       set status = 'open',
           claimed_by_teacher_id = null,
           claimed_at = null,
           resolve_deadline_at = null,
           answer_text = null,
           answer_image_urls_jsonb = '[]'::jsonb,
           answer_video_url = null,
           answered_at = null,
           last_answer_rejected_at = now(),
           quality_status = 'revision_requested',
           revision_requested_at = now(),
           moderator_note = nullif($2, ''),
           updated_at = now()
       where id = $1`,
      [postId, noteTrim],
    );

    if (row.teacher_user_id) {
      const teacherBody = noteForNotif
        ? `Öğrenci "${topicShort}" için cevabınızı yeterli bulmadı; soru tekrar havuza düştü. Öğrenci notu: ${noteForNotif}`
        : `Öğrenci "${topicShort}" için cevabınızı yeterli bulmadı; soru tekrar havuza düştü.`;

      await cpool.query(
        `insert into parent_notifications (
           recipient_user_id, student_id, snapshot_id, channel,
           title, body, payload_jsonb, delivery_status, sent_at
         ) values ($1, $2, null, 'in_app', $3, $4, $5::jsonb, 'sent', now())`,
        [
          row.teacher_user_id,
          studentRowId,
          "Ödev cevabı iade edildi",
          teacherBody,
          JSON.stringify({ kind: "homework_answer_rejected", homeworkPostId: postId }),
        ],
      );
    }

    const gRows = await cpool.query(
      `select guardian_user_id from student_guardians where student_id = $1`,
      [studentRowId],
    );
    const stuUidRow = await cpool.query(`select user_id from students where id = $1`, [studentRowId]);
    const stuUid = stuUidRow.rowCount ? (stuUidRow.rows[0].user_id as string) : null;
    const guardianBody = noteForNotif
      ? `Bağlı öğrenciniz "${topicShort}" ödev cevabını yeterli bulmadı; soru tekrar öğretmen havuzuna düştü. Not: ${noteForNotif}`
      : `Bağlı öğrenciniz "${topicShort}" ödev cevabını yeterli bulmadı; soru tekrar öğretmen havuzuna düştü.`;

    for (const g of gRows.rows) {
      const gid = g.guardian_user_id as string;
      if (stuUid && gid === stuUid) continue;
      await cpool.query(
        `insert into parent_notifications (
           recipient_user_id, student_id, snapshot_id, channel,
           title, body, payload_jsonb, delivery_status, sent_at
         ) values ($1, $2, null, 'in_app', $3, $4, $5::jsonb, 'sent', now())`,
        [
          gid,
          studentRowId,
          "Öğrenci ödev cevabını iade etti",
          guardianBody,
          JSON.stringify({ kind: "homework_answer_rejected_guardian", homeworkPostId: postId }),
        ],
      );
    }

    await cpool.query("commit");
    return c.json({ ok: true, status: "open" });
  } catch (e) {
    await cpool.query("rollback").catch(() => {});
    throw e;
  } finally {
    cpool.release();
  }
});

/** Öğrenci: yalnızca havuzda (open) iken gönderiyi iptal eder; öğretmen üstlenmişse kullanılamaz. */
studentPlatform.post("/homework-posts/:postId/cancel", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "student") return c.json({ error: "forbidden_students_only" }, 403);

  const postId = c.req.param("postId");
  if (!z.string().uuid().safeParse(postId).success) return c.json({ error: "invalid_post_id" }, 400);

  await releaseExpiredHomeworkClaims(pool);

  const sr = await pool.query(`select id from students where user_id = $1`, [userId]);
  if (!sr.rowCount) return c.json({ error: "student_profile_missing" }, 400);
  const studentRowId = sr.rows[0].id as string;

  const r = await pool.query(
    `update student_homework_posts
     set status = 'cancelled',
         claimed_by_teacher_id = null,
         claimed_at = null,
         resolve_deadline_at = null,
         last_answer_rejected_at = null,
         updated_at = now()
     where id = $1
       and student_id = $2
       and status = 'open'
     returning id`,
    [postId, studentRowId],
  );
  if (!r.rowCount) {
    return c.json(
      {
        error: "not_cancellable",
        hint: "Yalnızca havuzda bekleyen (henüz öğretmen üstlenmemiş) gönderiler iptal edilir.",
      },
      409,
    );
  }
  return c.json({ ok: true, status: "cancelled" });
});
