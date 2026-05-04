import type { Hono } from "hono";
import { z } from "zod";
import { pool } from "../db.js";
import type { AppVariables } from "../types.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { assertAdminGate } from "../lib/adminGate.js";

function parseLimitOffset(c: { req: { query: (k: string) => string | undefined } }, defLim: number) {
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? String(defLim)) || defLim));
  const offset = Math.min(10_000, Math.max(0, Number(c.req.query("offset") ?? "0") || 0));
  return { limit, offset };
}

export function registerAdminExtendedRoutes(admin: Hono<{ Variables: AppVariables }>) {
  admin.get("/group-lesson-requests", requireAuth, async (c) => {
    const denied = assertAdminGate(c);
    if (denied) return denied;
    const { limit, offset } = parseLimitOffset(c, 40);
    const rawSt = c.req.query("status")?.trim();
    const args: unknown[] = [];
    let where = "true";
    if (rawSt && z.enum(["open", "teacher_assigned", "scheduled", "completed", "cancelled"]).safeParse(rawSt).success) {
      args.push(rawSt);
      where += ` and g.status = $${args.length}::group_lesson_request_status`;
    }
    const countR = await pool.query(`select count(*)::int as c from group_lesson_requests g where ${where}`, args);
    const total = (countR.rows[0] as { c: number }).c;
    args.push(limit, offset);
    const li = args.length - 1;
    const oi = args.length;
    const list = await pool.query(
      `select g.id, g.status::text as status, g.topic_text, g.planned_start, g.total_price_minor, g.currency,
              g.created_at, u.display_name as creator_display_name, u.email as creator_email
       from group_lesson_requests g
       join students s on s.id = g.created_by_student_id
       join users u on u.id = s.user_id
       where ${where}
       order by g.created_at desc
       limit $${li} offset $${oi}`,
      args,
    );
    return c.json({ requests: list.rows, total, limit, offset });
  });

  admin.get("/lesson-packages", requireAuth, async (c) => {
    const denied = assertAdminGate(c);
    if (denied) return denied;
    const { limit, offset } = parseLimitOffset(c, 40);
    const list = await pool.query(
      `select lp.id, lp.status::text as status, lp.payment_status::text as payment_status,
              lp.total_amount_minor, lp.currency, lp.created_at,
              tu.display_name as teacher_name, tu.email as teacher_email,
              su.display_name as student_name, su.email as student_email
       from lesson_packages lp
       join teachers t on t.id = lp.teacher_id
       join users tu on tu.id = t.user_id
       join students st on st.id = lp.student_id
       join users su on su.id = st.user_id
       order by lp.created_at desc
       limit $1 offset $2`,
      [limit, offset],
    );
    const countR = await pool.query(`select count(*)::int as c from lesson_packages`);
    return c.json({
      packages: list.rows,
      total: (countR.rows[0] as { c: number }).c,
      limit,
      offset,
    });
  });

  admin.get("/wallet-ledger", requireAuth, async (c) => {
    const denied = assertAdminGate(c);
    if (denied) return denied;
    const { limit, offset } = parseLimitOffset(c, 50);
    const userIdRaw = c.req.query("userId")?.trim();
    const args: unknown[] = [];
    let where = "true";
    if (userIdRaw && z.string().uuid().safeParse(userIdRaw).success) {
      args.push(userIdRaw);
      where += ` and l.user_id = $${args.length}::uuid`;
    }
    const countR = await pool.query(
      `select count(*)::int as c from user_wallet_ledger l where ${where}`,
      args,
    );
    const total = (countR.rows[0] as { c: number }).c;
    args.push(limit, offset);
    const li = args.length - 1;
    const oi = args.length;
    const list = await pool.query(
      `select l.id, l.user_id, l.delta_minor::text as delta_minor, l.balance_after::text as balance_after,
              l.kind, l.ref_type, l.ref_id, l.created_at,
              u.email as user_email, u.display_name as user_display_name
       from user_wallet_ledger l
       join users u on u.id = l.user_id
       where ${where}
       order by l.created_at desc, l.id desc
       limit $${li} offset $${oi}`,
      args,
    );
    return c.json({ entries: list.rows, total, limit, offset });
  });

  admin.get("/homework-posts", requireAuth, async (c) => {
    const denied = assertAdminGate(c);
    if (denied) return denied;
    const { limit, offset } = parseLimitOffset(c, 40);
    const rawSt = c.req.query("status")?.trim();
    const args: unknown[] = [];
    let where = "true";
    if (
      rawSt &&
      z
        .enum(["open", "claimed", "answered", "closed", "cancelled"])
        .safeParse(rawSt).success
    ) {
      args.push(rawSt);
      where += ` and h.status = $${args.length}::homework_post_status`;
    }
    const countR = await pool.query(
      `select count(*)::int as c from student_homework_posts h where ${where}`,
      args,
    );
    const total = (countR.rows[0] as { c: number }).c;
    args.push(limit, offset);
    const li = args.length - 1;
    const oi = args.length;
    const list = await pool.query(
      `select h.id, h.status::text as status, h.topic, h.created_at,
              su.display_name as student_name, su.email as student_email,
              h.claimed_by_teacher_id
       from student_homework_posts h
       join students s on s.id = h.student_id
       join users su on su.id = s.user_id
       where ${where}
       order by h.created_at desc
       limit $${li} offset $${oi}`,
      args,
    );
    return c.json({ posts: list.rows, total, limit, offset });
  });

  admin.get("/direct-bookings", requireAuth, async (c) => {
    const denied = assertAdminGate(c);
    if (denied) return denied;
    const { limit, offset } = parseLimitOffset(c, 40);
    const rawSt = c.req.query("status")?.trim();
    const args: unknown[] = [];
    let where = "true";
    if (
      rawSt &&
      z
        .enum(["pending_funding", "funded", "completed", "disputed", "cancelled"])
        .safeParse(rawSt).success
    ) {
      args.push(rawSt);
      where += ` and b.status = $${args.length}::direct_booking_status`;
    }
    const countR = await pool.query(
      `select count(*)::int as c from direct_lesson_bookings b where ${where}`,
      args,
    );
    const total = (countR.rows[0] as { c: number }).c;
    args.push(limit, offset);
    const li = args.length - 1;
    const oi = args.length;
    const list = await pool.query(
      `select b.id, b.status::text as status, b.agreed_amount_minor, b.currency, b.created_at,
              su.display_name as student_name, su.email as student_email,
              tu.display_name as teacher_name, tu.email as teacher_email
       from direct_lesson_bookings b
       join students st on st.id = b.student_id
       join users su on su.id = st.user_id
       join teachers t on t.id = b.teacher_id
       join users tu on tu.id = t.user_id
       where ${where}
       order by b.created_at desc
       limit $${li} offset $${oi}`,
      args,
    );
    return c.json({ bookings: list.rows, total, limit, offset });
  });

  admin.get("/teacher-subscriptions", requireAuth, async (c) => {
    const denied = assertAdminGate(c);
    if (denied) return denied;
    const { limit, offset } = parseLimitOffset(c, 40);
    const list = await pool.query(
      `select ts.id, ts.status::text as status, ts.plan_code::text as plan_code,
              ts.started_at, ts.expires_at, ts.paid_amount_minor, ts.currency,
              ts.payment_provider, ts.created_at,
              t.id as teacher_id, u.display_name as teacher_name, u.email as teacher_email
       from teacher_subscriptions ts
       join teachers t on t.id = ts.teacher_id
       join users u on u.id = t.user_id
       order by ts.expires_at desc
       limit $1 offset $2`,
      [limit, offset],
    );
    const countR = await pool.query(`select count(*)::int as c from teacher_subscriptions`);
    return c.json({
      subscriptions: list.rows,
      total: (countR.rows[0] as { c: number }).c,
      limit,
      offset,
    });
  });

  admin.get("/wallet-topups", requireAuth, async (c) => {
    const denied = assertAdminGate(c);
    if (denied) return denied;
    const { limit, offset } = parseLimitOffset(c, 40);
    const list = await pool.query(
      `select w.id, w.user_id, w.amount_minor, w.currency, w.method::text as method, w.state::text as state,
              w.merchant_oid, w.created_at,
              u.email, u.display_name
       from wallet_topup_payments w
       join users u on u.id = w.user_id
       order by w.created_at desc
       limit $1 offset $2`,
      [limit, offset],
    );
    const countR = await pool.query(`select count(*)::int as c from wallet_topup_payments`);
    return c.json({
      topups: list.rows,
      total: (countR.rows[0] as { c: number }).c,
      limit,
      offset,
    });
  });

  admin.get("/student-sub-payments", requireAuth, async (c) => {
    const denied = assertAdminGate(c);
    if (denied) return denied;
    const { limit, offset } = parseLimitOffset(c, 40);
    const list = await pool.query(
      `select p.id, p.user_id, p.amount_minor, p.currency, p.method::text as method, p.state::text as state,
              p.merchant_oid, p.created_at,
              u.email, u.display_name
       from student_sub_payments p
       join users u on u.id = p.user_id
       order by p.created_at desc
       limit $1 offset $2`,
      [limit, offset],
    );
    const countR = await pool.query(`select count(*)::int as c from student_sub_payments`);
    return c.json({
      payments: list.rows,
      total: (countR.rows[0] as { c: number }).c,
      limit,
      offset,
    });
  });

  admin.get("/course-enrollments", requireAuth, async (c) => {
    const denied = assertAdminGate(c);
    if (denied) return denied;
    const { limit, offset } = parseLimitOffset(c, 40);
    const list = await pool.query(
      `select ce.id, ce.enrolled_at,
              c.id as course_id, c.title as course_title, c.status::text as course_status,
              cc.title as cohort_title,
              su.display_name as student_name, su.email as student_email
       from course_enrollments ce
       join course_cohorts cc on cc.id = ce.cohort_id
       join courses c on c.id = cc.course_id
       join students st on st.id = ce.student_id
       join users su on su.id = st.user_id
       order by ce.enrolled_at desc
       limit $1 offset $2`,
      [limit, offset],
    );
    const countR = await pool.query(`select count(*)::int as c from course_enrollments`);
    return c.json({
      enrollments: list.rows,
      total: (countR.rows[0] as { c: number }).c,
      limit,
      offset,
    });
  });

  admin.get("/parent-notifications", requireAuth, async (c) => {
    const denied = assertAdminGate(c);
    if (denied) return denied;
    const { limit, offset } = parseLimitOffset(c, 50);
    const list = await pool.query(
      `select n.id, n.recipient_user_id, n.student_id, n.channel::text as channel,
              n.title, n.delivery_status::text as delivery_status, n.read_at, n.sent_at, n.created_at,
              ru.email as recipient_email
       from parent_notifications n
       join users ru on ru.id = n.recipient_user_id
       order by n.created_at desc
       limit $1 offset $2`,
      [limit, offset],
    );
    const countR = await pool.query(`select count(*)::int as c from parent_notifications`);
    return c.json({
      notifications: list.rows,
      total: (countR.rows[0] as { c: number }).c,
      limit,
      offset,
    });
  });

  admin.get("/users/:userId/wallet", requireAuth, async (c) => {
    const denied = assertAdminGate(c);
    if (denied) return denied;
    const userId = c.req.param("userId")?.trim();
    if (!userId || !z.string().uuid().safeParse(userId).success) {
      return c.json({ error: "invalid_user_id" }, 400);
    }
    const w = await pool.query(
      `select user_id, balance_minor::text as balance_minor, currency, updated_at
       from user_wallets where user_id = $1`,
      [userId],
    );
    const led = await pool.query(
      `select id, delta_minor::text as delta_minor, balance_after::text as balance_after, kind, created_at
       from user_wallet_ledger where user_id = $1
       order by created_at desc, id desc limit 30`,
      [userId],
    );
    const u = await pool.query(`select email, display_name from users where id = $1`, [userId]);
    if (!u.rowCount) return c.json({ error: "user_not_found" }, 404);
    return c.json({
      user: u.rows[0],
      wallet: w.rows[0] ?? null,
      ledger: led.rows,
    });
  });

  const verificationSchema = z.object({
    verificationStatus: z.enum(["unverified", "pending", "verified", "rejected"]),
  });

  admin.patch("/teachers/:teacherId/verification", requireAuth, async (c) => {
    const denied = assertAdminGate(c);
    if (denied) return denied;
    const teacherId = c.req.param("teacherId")?.trim();
    if (!teacherId || !z.string().uuid().safeParse(teacherId).success) {
      return c.json({ error: "invalid_teacher_id" }, 400);
    }
    const parsed = verificationSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const r = await pool.query(
      `update teachers
       set verification_status = $1::teacher_verification_status, updated_at = now()
       where id = $2
       returning id, verification_status`,
      [parsed.data.verificationStatus, teacherId],
    );
    if (!r.rowCount) return c.json({ error: "teacher_not_found" }, 404);
    return c.json({ ok: true, teacher: r.rows[0] });
  });

  const courseStatusSchema = z.object({
    status: z.enum(["draft", "published", "archived"]),
  });

  admin.patch("/courses/:courseId/status", requireAuth, async (c) => {
    const denied = assertAdminGate(c);
    if (denied) return denied;
    const courseId = c.req.param("courseId")?.trim();
    if (!courseId || !z.string().uuid().safeParse(courseId).success) {
      return c.json({ error: "invalid_course_id" }, 400);
    }
    const parsed = courseStatusSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const r = await pool.query(
      `update courses set status = $1::course_status, updated_at = now() where id = $2
       returning id, status`,
      [parsed.data.status, courseId],
    );
    if (!r.rowCount) return c.json({ error: "course_not_found" }, 404);
    return c.json({ ok: true, course: r.rows[0] });
  });

  const glStatusSchema = z.object({
    status: z.enum(["open", "teacher_assigned", "scheduled", "completed", "cancelled"]),
  });

  admin.patch("/group-lesson-requests/:id/status", requireAuth, async (c) => {
    const denied = assertAdminGate(c);
    if (denied) return denied;
    const id = c.req.param("id")?.trim();
    if (!id || !z.string().uuid().safeParse(id).success) return c.json({ error: "invalid_id" }, 400);
    const parsed = glStatusSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const r = await pool.query(
      `update group_lesson_requests
       set status = $1::group_lesson_request_status, updated_at = now()
       where id = $2
       returning id, status`,
      [parsed.data.status, id],
    );
    if (!r.rowCount) return c.json({ error: "not_found" }, 404);
    return c.json({ ok: true, request: r.rows[0] });
  });

  admin.patch("/homework-posts/:id/status", requireAuth, async (c) => {
    const denied = assertAdminGate(c);
    if (denied) return denied;
    const id = c.req.param("id")?.trim();
    if (!id || !z.string().uuid().safeParse(id).success) return c.json({ error: "invalid_id" }, 400);
    const parsed = z.object({ status: z.literal("cancelled") }).safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: "only_cancelled_allowed" }, 400);
    const r = await pool.query(
      `update student_homework_posts
       set status = 'cancelled'::homework_post_status, updated_at = now()
       where id = $1 and status not in ('closed'::homework_post_status, 'cancelled'::homework_post_status)
       returning id, status`,
      [id],
    );
    if (!r.rowCount) return c.json({ error: "not_found_or_already_terminal" }, 404);
    return c.json({ ok: true, post: r.rows[0] });
  });

  admin.patch("/lesson-requests/:id/status", requireAuth, async (c) => {
    const denied = assertAdminGate(c);
    if (denied) return denied;
    const id = c.req.param("id")?.trim();
    if (!id || !z.string().uuid().safeParse(id).success) return c.json({ error: "invalid_id" }, 400);
    const parsed = z.object({ status: z.literal("cancelled") }).safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: "only_cancelled_allowed" }, 400);
    const r = await pool.query(
      `update lesson_requests
       set status = 'cancelled'::lesson_request_status, updated_at = now()
       where id = $1 and status in ('open'::lesson_request_status, 'matched'::lesson_request_status)
       returning id, status`,
      [id],
    );
    if (!r.rowCount) return c.json({ error: "not_found_or_not_cancellable" }, 404);
    return c.json({ ok: true, request: r.rows[0] });
  });

  admin.patch("/direct-bookings/:id/status", requireAuth, async (c) => {
    const denied = assertAdminGate(c);
    if (denied) return denied;
    const id = c.req.param("id")?.trim();
    if (!id || !z.string().uuid().safeParse(id).success) return c.json({ error: "invalid_id" }, 400);
    const parsed = z.object({ status: z.literal("cancelled") }).safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: "only_cancelled_allowed" }, 400);
    const r = await pool.query(
      `update direct_lesson_bookings
       set status = 'cancelled'::direct_booking_status, updated_at = now()
       where id = $1 and status not in ('completed'::direct_booking_status, 'cancelled'::direct_booking_status)
       returning id, status`,
      [id],
    );
    if (!r.rowCount) return c.json({ error: "not_found_or_not_cancellable" }, 404);
    return c.json({ ok: true, booking: r.rows[0] });
  });

  admin.get("/support-threads", requireAuth, async (c) => {
    const denied = assertAdminGate(c);
    if (denied) return denied;
    const { limit, offset } = parseLimitOffset(c, 40);
    const countR = await pool.query(`select count(*)::int as c from support_threads`);
    const total = (countR.rows[0] as { c: number }).c;
    const list = await pool.query(
      `select t.id, t.user_id, t.context_path, t.status::text as status, t.created_at, t.updated_at,
              u.email as user_email, u.display_name as user_display_name
       from support_threads t
       join users u on u.id = t.user_id
       order by t.updated_at desc
       limit $1 offset $2`,
      [limit, offset],
    );
    return c.json({ threads: list.rows, total });
  });

  admin.get("/support-threads/:threadId/messages", requireAuth, async (c) => {
    const denied = assertAdminGate(c);
    if (denied) return denied;
    const threadId = c.req.param("threadId")?.trim();
    if (!threadId || !z.string().uuid().safeParse(threadId).success) {
      return c.json({ error: "invalid_thread_id" }, 400);
    }
    const th = await pool.query(
      `select t.id, t.user_id, t.context_path, t.status::text as status, t.created_at, t.updated_at,
              u.email as user_email, u.display_name as user_display_name
       from support_threads t
       join users u on u.id = t.user_id
       where t.id = $1`,
      [threadId],
    );
    if (!th.rowCount) return c.json({ error: "not_found" }, 404);
    const msgs = await pool.query(
      `select id::text as id, sender, body, created_at
       from support_messages where thread_id = $1 order by created_at asc`,
      [threadId],
    );
    return c.json({ thread: th.rows[0], messages: msgs.rows });
  });

  const staffSupportMsgSchema = z.object({ content: z.string().min(1).max(8000) });

  admin.post("/support-threads/:threadId/messages", requireAuth, async (c) => {
    const denied = assertAdminGate(c);
    if (denied) return denied;
    const threadId = c.req.param("threadId")?.trim();
    if (!threadId || !z.string().uuid().safeParse(threadId).success) {
      return c.json({ error: "invalid_thread_id" }, 400);
    }
    const parsed = staffSupportMsgSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const ex = await pool.query(`select id from support_threads where id = $1`, [threadId]);
    if (!ex.rowCount) return c.json({ error: "not_found" }, 404);
    await pool.query(
      `insert into support_messages (thread_id, sender, body) values ($1, 'staff', $2)`,
      [threadId, parsed.data.content.trim()],
    );
    await pool.query(`update support_threads set updated_at = now() where id = $1`, [threadId]);
    const msgs = await pool.query(
      `select id::text as id, sender, body, created_at
       from support_messages where thread_id = $1 order by created_at asc`,
      [threadId],
    );
    return c.json({ ok: true, messages: msgs.rows });
  });
}
