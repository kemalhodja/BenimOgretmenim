import type { Hono } from "hono";
import { z } from "zod";
import { pool } from "../db.js";
import type { AppVariables } from "../types.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { assertAdminGate } from "../lib/adminGate.js";
import { writeAdminAudit } from "../lib/adminAudit.js";

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
    const kindRaw = c.req.query("kind")?.trim();
    const minAbsRaw = Number(c.req.query("minAbsMinor") ?? "0");
    const args: unknown[] = [];
    let where = "true";
    if (userIdRaw && z.string().uuid().safeParse(userIdRaw).success) {
      args.push(userIdRaw);
      where += ` and l.user_id = $${args.length}::uuid`;
    }
    if (kindRaw) {
      args.push(kindRaw);
      where += ` and l.kind = $${args.length}`;
    }
    if (Number.isFinite(minAbsRaw) && minAbsRaw > 0) {
      args.push(Math.floor(minAbsRaw));
      where += ` and abs(l.delta_minor) >= $${args.length}`;
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

  admin.get("/wallet-ops-overview", requireAuth, async (c) => {
    const denied = assertAdminGate(c);
    if (denied) return denied;
    const [wallets, ledger24h, topups, directBookings, studentPayments] = await Promise.all([
      pool.query(
        `select
           count(*)::int as wallet_count,
           count(*) filter (where balance_minor > 0)::int as wallets_with_balance,
           coalesce(sum(balance_minor), 0)::text as total_balance_minor,
           coalesce(max(balance_minor), 0)::text as max_balance_minor
         from user_wallets`,
      ),
      pool.query(
        `select
           count(*)::int as ledger_count_24h,
           count(*) filter (where abs(delta_minor) >= 100000)::int as large_movements_24h,
           coalesce(sum(delta_minor) filter (where delta_minor > 0), 0)::text as inflow_minor_24h,
           coalesce(sum(abs(delta_minor)) filter (where delta_minor < 0), 0)::text as outflow_minor_24h
         from user_wallet_ledger
         where created_at >= now() - interval '24 hours'`,
      ),
      pool.query(
        `select state::text as state, count(*)::int as count, coalesce(sum(amount_minor), 0)::text as amount_minor
         from wallet_topup_payments
         group by state`,
      ),
      pool.query(
        `select status::text as status, count(*)::int as count, coalesce(sum(agreed_amount_minor), 0)::text as amount_minor
         from direct_lesson_bookings
         group by status`,
      ),
      pool.query(
        `select state::text as state, count(*)::int as count, coalesce(sum(amount_minor), 0)::text as amount_minor
         from student_sub_payments
         group by state`,
      ),
    ]);
    return c.json({
      wallets: wallets.rows[0],
      ledger24h: ledger24h.rows[0],
      topupsByState: topups.rows,
      directBookingsByStatus: directBookings.rows,
      studentPaymentsByState: studentPayments.rows,
    });
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
              b.dispute_reason, b.quality_status,
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
    const rawState = c.req.query("state")?.trim();
    const rawMethod = c.req.query("method")?.trim();
    const args: unknown[] = [];
    let where = "true";
    if (rawState && z.enum(["pending", "paid", "failed", "cancelled"]).safeParse(rawState).success) {
      args.push(rawState);
      where += ` and w.state = $${args.length}::payment_state`;
    }
    if (rawMethod && z.enum(["paytr_iframe", "bank_transfer"]).safeParse(rawMethod).success) {
      args.push(rawMethod);
      where += ` and w.method = $${args.length}::payment_method`;
    }
    args.push(limit, offset);
    const li = args.length - 1;
    const oi = args.length;
    const list = await pool.query(
      `select w.id, w.user_id, w.amount_minor, w.currency, w.method::text as method, w.state::text as state,
              w.merchant_oid, w.created_at,
              u.email, u.display_name
       from wallet_topup_payments w
       join users u on u.id = w.user_id
       where ${where}
       order by w.created_at desc
       limit $${li} offset $${oi}`,
      args,
    );
    const countR = await pool.query(`select count(*)::int as c from wallet_topup_payments w where ${where}`, args.slice(0, -2));
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

  admin.get("/guardian-invites", requireAuth, async (c) => {
    const denied = assertAdminGate(c);
    if (denied) return denied;
    const { limit, offset } = parseLimitOffset(c, 50);
    const list = await pool.query(
      `select i.id,
              i.student_id,
              su.display_name as student_name,
              su.email as student_email,
              case
                when i.accepted_at is not null then 'accepted'
                when i.expires_at <= now() then 'expired'
                else 'active'
              end as status,
              i.expires_at,
              i.accepted_at,
              gu.display_name as accepted_guardian_name,
              gu.email as accepted_guardian_email,
              i.created_at
       from guardian_invite_codes i
       join students s on s.id = i.student_id
       join users su on su.id = s.user_id
       left join users gu on gu.id = i.accepted_guardian_user_id
       order by i.created_at desc
       limit $1 offset $2`,
      [limit, offset],
    );
    const countR = await pool.query(`select count(*)::int as c from guardian_invite_codes`);
    return c.json({
      invites: list.rows,
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
      `update teachers t
       set verification_status = $1::teacher_verification_status, updated_at = now()
       from users u
       where t.id = $2
         and u.id = t.user_id
       returning t.id, t.user_id, t.verification_status, u.display_name`,
      [parsed.data.verificationStatus, teacherId],
    );
    if (!r.rowCount) return c.json({ error: "teacher_not_found" }, 404);
    const teacher = r.rows[0] as {
      id: string;
      user_id: string;
      verification_status: string;
      display_name: string | null;
    };
    const status = parsed.data.verificationStatus;
    const title =
      status === "verified"
        ? "Öğretmen profiliniz doğrulandı"
        : status === "rejected"
          ? "Öğretmen doğrulama başvurunuz güncellendi"
          : status === "pending"
            ? "Doğrulama başvurunuz incelemede"
            : "Öğretmen doğrulama durumunuz güncellendi";
    const body =
      status === "verified"
        ? "Profiliniz doğrulandı. Öğrenciler sizi doğrulanmış öğretmen rozetiyle görebilir."
        : status === "rejected"
          ? "Profiliniz doğrulama için hazır görünmüyor. Lütfen biyografi, branş, video veya belge alanlarınızı güncelleyin."
          : status === "pending"
            ? "Profiliniz admin inceleme kuyruğuna alındı."
            : "Doğrulama durumunuz güncellendi.";
    await pool.query(
      `insert into parent_notifications (
         recipient_user_id, student_id, snapshot_id, channel,
         title, body, payload_jsonb, delivery_status, sent_at
       ) values ($1, null, null, 'in_app', $2, $3, $4::jsonb, 'sent', now())`,
      [
        teacher.user_id,
        title,
        body,
        JSON.stringify({
          kind: "teacher_verification_status",
          teacherId: teacher.id,
          verificationStatus: status,
        }),
      ],
    );
    await writeAdminAudit({
      actorUserId: c.get("userId"),
      actorRole: c.get("userRole"),
      requestId: c.req.header("x-request-id") ?? null,
      action: "teacher.verification.update",
      entityType: "teacher",
      entityId: teacher.id,
      reason: "admin_verification_decision",
      after: { verificationStatus: status },
    });
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
    await writeAdminAudit({
      actorUserId: c.get("userId"),
      actorRole: c.get("userRole"),
      requestId: c.req.header("x-request-id") ?? null,
      action: "course.status.update",
      entityType: "course",
      entityId: courseId,
      reason: "admin_course_status",
      after: r.rows[0],
    });
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
    await writeAdminAudit({
      actorUserId: c.get("userId"),
      actorRole: c.get("userRole"),
      requestId: c.req.header("x-request-id") ?? null,
      action: "group_lesson_request.status.update",
      entityType: "group_lesson_request",
      entityId: id,
      reason: "admin_group_lesson_status",
      after: r.rows[0],
    });
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
    await writeAdminAudit({
      actorUserId: c.get("userId"),
      actorRole: c.get("userRole"),
      requestId: c.req.header("x-request-id") ?? null,
      action: "homework.status.cancel",
      entityType: "student_homework_post",
      entityId: id,
      reason: "admin_homework_cancel",
      after: r.rows[0],
    });
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
    await writeAdminAudit({
      actorUserId: c.get("userId"),
      actorRole: c.get("userRole"),
      requestId: c.req.header("x-request-id") ?? null,
      action: "lesson_request.status.cancel",
      entityType: "lesson_request",
      entityId: id,
      reason: "admin_lesson_request_cancel",
      after: r.rows[0],
    });
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
    await writeAdminAudit({
      actorUserId: c.get("userId"),
      actorRole: c.get("userRole"),
      requestId: c.req.header("x-request-id") ?? null,
      action: "direct_booking.status.cancel",
      entityType: "direct_lesson_booking",
      entityId: id,
      reason: "admin_direct_booking_cancel",
      after: r.rows[0],
    });
    return c.json({ ok: true, booking: r.rows[0] });
  });

  const supportThreadMetaSchema = z.object({
    status: z.enum(["open", "closed"]).optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    assignedToMe: z.boolean().optional(),
  });

  admin.get("/support-threads", requireAuth, async (c) => {
    const denied = assertAdminGate(c);
    if (denied) return denied;
    const { limit, offset } = parseLimitOffset(c, 40);
    const rawStatus = c.req.query("status")?.trim();
    const rawPriority = c.req.query("priority")?.trim();
    const args: unknown[] = [];
    let where = "true";
    if (rawStatus && z.enum(["open", "closed"]).safeParse(rawStatus).success) {
      args.push(rawStatus);
      where += ` and t.status = $${args.length}`;
    }
    if (rawPriority && z.enum(["low", "normal", "high", "urgent"]).safeParse(rawPriority).success) {
      args.push(rawPriority);
      where += ` and t.priority = $${args.length}`;
    }
    const countR = await pool.query(`select count(*)::int as c from support_threads t where ${where}`, args);
    const total = (countR.rows[0] as { c: number }).c;
    args.push(limit, offset);
    const li = args.length - 1;
    const oi = args.length;
    const list = await pool.query(
      `select t.id, t.user_id, t.visitor_email, t.context_path, t.status::text as status, t.created_at, t.updated_at,
              t.priority, t.assigned_admin_user_id, t.first_response_due_at, t.resolved_at,
              u.email as user_email, u.display_name as user_display_name,
              au.display_name as assigned_admin_display_name,
              (select max(m.created_at) from support_messages m where m.thread_id = t.id and m.sender = 'user') as last_user_message_at,
              (select max(m.created_at) from support_messages m where m.thread_id = t.id and m.sender = 'staff') as last_staff_message_at,
              (select count(*)::int from support_messages m where m.thread_id = t.id and m.sender = 'staff') as staff_response_count
       from support_threads t
       left join users u on u.id = t.user_id
       left join users au on au.id = t.assigned_admin_user_id
       where ${where}
       order by
         case t.priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end,
         t.first_response_due_at asc nulls last,
         t.updated_at desc
       limit $${li} offset $${oi}`,
      args,
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
      `select t.id, t.user_id, t.visitor_email, t.context_path, t.status::text as status, t.created_at, t.updated_at,
              t.priority, t.assigned_admin_user_id, t.first_response_due_at, t.resolved_at,
              u.email as user_email, u.display_name as user_display_name,
              au.display_name as assigned_admin_display_name,
              (select max(m.created_at) from support_messages m where m.thread_id = t.id and m.sender = 'user') as last_user_message_at,
              (select max(m.created_at) from support_messages m where m.thread_id = t.id and m.sender = 'staff') as last_staff_message_at,
              (select count(*)::int from support_messages m where m.thread_id = t.id and m.sender = 'staff') as staff_response_count
       from support_threads t
       left join users u on u.id = t.user_id
       left join users au on au.id = t.assigned_admin_user_id
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

  admin.patch("/support-threads/:threadId", requireAuth, async (c) => {
    const denied = assertAdminGate(c);
    if (denied) return denied;
    const threadId = c.req.param("threadId")?.trim();
    if (!threadId || !z.string().uuid().safeParse(threadId).success) {
      return c.json({ error: "invalid_thread_id" }, 400);
    }
    const parsed = supportThreadMetaSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const userId = c.get("userId");
    const r = await pool.query(
      `update support_threads
       set status = coalesce($2, status),
           priority = coalesce($3, priority),
           assigned_admin_user_id = case
             when $4::boolean is true then $5::uuid
             else assigned_admin_user_id
           end,
           resolved_at = case
             when $2 = 'closed' then coalesce(resolved_at, now())
             when $2 = 'open' then null
             else resolved_at
           end,
           first_response_due_at = case
             when first_response_due_at is null and coalesce($2, status) = 'open'
               then created_at + interval '2 hours'
             else first_response_due_at
           end,
           updated_at = now()
       where id = $1
       returning id, user_id, visitor_email, context_path, status::text as status, priority,
                 assigned_admin_user_id, first_response_due_at, resolved_at, created_at, updated_at`,
      [
        threadId,
        parsed.data.status ?? null,
        parsed.data.priority ?? null,
        parsed.data.assignedToMe ?? false,
        userId,
      ],
    );
    if (!r.rowCount) return c.json({ error: "not_found" }, 404);
    await writeAdminAudit({
      actorUserId: userId,
      actorRole: c.get("userRole"),
      requestId: c.req.header("x-request-id") ?? null,
      action: "support_thread.meta.update",
      entityType: "support_thread",
      entityId: threadId,
      reason: "admin_support_thread_update",
      after: r.rows[0],
    });
    return c.json({ thread: r.rows[0] });
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
    const ex = await pool.query(`select id, user_id, visitor_email from support_threads where id = $1`, [threadId]);
    if (!ex.rowCount) return c.json({ error: "not_found" }, 404);
    await pool.query(
      `insert into support_messages (thread_id, sender, body) values ($1, 'staff', $2)`,
      [threadId, parsed.data.content.trim()],
    );
    await pool.query(
      `update support_threads
       set status = 'open',
           assigned_admin_user_id = coalesce(assigned_admin_user_id, $2),
           first_response_due_at = coalesce(first_response_due_at, created_at + interval '2 hours'),
           updated_at = now()
       where id = $1`,
      [threadId, c.get("userId")],
    );
    const msgs = await pool.query(
      `select id::text as id, sender, body, created_at
       from support_messages where thread_id = $1 order by created_at asc`,
      [threadId],
    );
    return c.json({ ok: true, messages: msgs.rows });
  });
}
