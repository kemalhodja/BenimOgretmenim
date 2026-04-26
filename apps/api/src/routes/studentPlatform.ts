import { randomBytes } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import { pool } from "../db.js";
import type { AppVariables } from "../types.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { applyWalletDelta, teacherPayoutFromGross } from "../lib/wallet.js";
import { getActiveStudentSubscription, getStudentSubPriceConfig } from "../lib/studentSub.js";

export const studentPlatform = new Hono<{ Variables: AppVariables }>();

const purchaseSubSchema = z.object({
  months: z.number().int().min(1).max(60),
});

studentPlatform.get("/subscription/me", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "student") return c.json({ error: "forbidden_students_only" }, 403);
  const sub = await getActiveStudentSubscription(userId);
  const pricePerMonthMinor = getStudentSubPriceConfig().pricePerMonthMinor;
  if (!sub) {
    return c.json({ active: false, subscription: null, pricePerMonthMinor });
  }
  return c.json({ active: true, subscription: sub, pricePerMonthMinor });
});

/** Aylık 1000 TL (varsayılan) × ay; PayTR ile — ödeme onayı sonrası aktif */
studentPlatform.post("/subscription/purchase", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "student") return c.json({ error: "forbidden_students_only" }, 403);

  const parsed = purchaseSubSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const { pricePerMonthMinor } = getStudentSubPriceConfig();
  const total = pricePerMonthMinor * parsed.data.months;
  const merchantOid = `STU-${Date.now()}-${randomBytes(5).toString("hex")}`;

  const sub = await pool.query(
    `insert into student_subscriptions (
       user_id, months_count, price_per_month_minor, price_total_minor, lifecycle
     ) values ($1, $2, $3, $4, 'awaiting_payment')
     returning id, months_count, price_total_minor, currency`,
    [userId, parsed.data.months, pricePerMonthMinor, total],
  );

  const sid = sub.rows[0].id as string;

  const pay = await pool.query(
    `insert into student_sub_payments (
       subscription_id, user_id, amount_minor, currency, method, state, merchant_oid
     ) values ($1, $2, $3, 'TRY', 'paytr_iframe', 'pending', $4)
     returning id, merchant_oid`,
    [sid, userId, total, merchantOid],
  );

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
  imageUrls: z.array(z.string().min(1).max(2000)).max(8).optional().default([]),
  audioUrl: z.string().min(1).max(2000).optional().nullable(),
});

/** Branş havuzuna: foto + açıklama; aktif abonelik gerekir */
studentPlatform.post("/homework-posts", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "student") return c.json({ error: "forbidden_students_only" }, 403);

  const act = await getActiveStudentSubscription(userId);
  if (!act) {
    return c.json(
      {
        error: "student_platform_subscription_required",
        hint: "Ders konusu soruları ve ilanlar için aylık platform aboneliği gerekir.",
      },
      403,
    );
  }

  const parsed = createHomeworkSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const sr = await pool.query(`select id from students where user_id = $1`, [userId]);
  if (!sr.rowCount) return c.json({ error: "student_profile_missing" }, 400);
  const studentId = sr.rows[0].id as string;

  const ins = await pool.query(
    `insert into student_homework_posts (
       student_id, branch_id, topic, help_text, image_urls_jsonb, audio_url
     ) values ($1, $2, $3, $4, $5::jsonb, $6)
     returning id, status, created_at`,
    [
      studentId,
      parsed.data.branchId,
      parsed.data.topic.trim(),
      parsed.data.helpText.trim(),
      JSON.stringify(parsed.data.imageUrls ?? []),
      parsed.data.audioUrl?.trim() || null,
    ],
  );

  return c.json({ post: ins.rows[0] }, 201);
});

studentPlatform.get("/homework-posts/mine", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "student") return c.json({ error: "forbidden_students_only" }, 403);

  const sr = await pool.query(`select id from students where user_id = $1`, [userId]);
  if (!sr.rowCount) return c.json({ posts: [] });
  const r = await pool.query(
    `select h.id, h.branch_id, b.name as branch_name, h.topic, h.status, h.created_at
     from student_homework_posts h
     left join branches b on b.id = h.branch_id
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
      `select b.id, b.agreed_amount_minor, b.status, b.student_id
       from direct_lesson_bookings b
       where b.id = $1
       for update`,
      [bookingId],
    );
    if (!bq.rowCount) {
      await cpool.query("rollback");
      return c.json({ error: "not_found" }, 404);
    }
    const b = bq.rows[0] as { id: string; agreed_amount_minor: number; status: string; student_id: string };
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
      `select b.id, b.agreed_amount_minor, b.status, b.teacher_id
       from direct_lesson_bookings b
       where b.id = $1
       for update`,
      [bookingId],
    );
    if (!bq.rowCount) {
      await cpool.query("rollback");
      return c.json({ error: "not_found" }, 404);
    }
    const b = bq.rows[0] as { id: string; agreed_amount_minor: number; status: string; teacher_id: string };
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
    await cpool.query("commit");
    return c.json({ ok: true, status: "completed" });
  } catch (e) {
    await cpool.query("rollback").catch(() => {});
    throw e;
  } finally {
    cpool.release();
  }
});

/** Öğretmen: branş havuzundaki açık ödev/soru gönderileri */
studentPlatform.get("/homework-posts/teacher/feed", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "teacher") {
    return c.json({ error: "forbidden_teachers_only" }, 403);
  }

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

  const r = await pool.query(
    `select h.id, h.topic, h.status, h.created_at, h.image_urls_jsonb, h.audio_url,
            u.display_name as student_display_name
     from student_homework_posts h
     join students s on s.id = h.student_id
     join users u on u.id = s.user_id
     where h.branch_id = $1 and h.status = 'open'
     order by h.created_at desc
     limit 50`,
    [bid],
  );
  return c.json({ posts: r.rows });
});

studentPlatform.post("/homework-posts/:postId/claim", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "teacher") {
    return c.json({ error: "forbidden_teachers_only" }, 403);
  }

  const postId = c.req.param("postId");
  if (!z.string().uuid().safeParse(postId).success) return c.json({ error: "invalid_post_id" }, 400);

  const tr = await pool.query(`select id from teachers where user_id = $1`, [userId]);
  if (!tr.rowCount) return c.json({ error: "teacher_profile_missing" }, 400);
  const teacherId = tr.rows[0].id as string;

  const r = await pool.query(
    `update student_homework_posts
     set status = 'claimed',
         claimed_by_teacher_id = $1,
         claimed_at = now(),
         updated_at = now()
     where id = $2
       and status = 'open'
     returning id, status`,
    [teacherId, postId],
  );
  if (!r.rowCount) {
    return c.json({ error: "not_open_or_taken" }, 409);
  }
  return c.json({ post: r.rows[0] });
});
