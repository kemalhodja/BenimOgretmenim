import { Hono } from "hono";
import { z } from "zod";
import { pool } from "../db.js";
import type { AppVariables } from "../types.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { assertAdminGate } from "../lib/adminGate.js";
import { registerAdminExtendedRoutes } from "./adminExtended.js";

export const admin = new Hono<{ Variables: AppVariables }>();

admin.get("/overview", requireAuth, async (c) => {
  const denied = assertAdminGate(c);
  if (denied) return denied;

  const [
    roles,
    teachersCt,
    studentsCt,
    coursesByStatus,
    lrByStatus,
    glByStatus,
    pendingBank,
    pendingSubPay,
    activeTeacherSubs,
    packagesByStatus,
    activeStudentSubs,
    walletsAgg,
    homeworkOpen,
    directBookingsActive,
    parentNotifUnread,
  ] = await Promise.all([
    pool.query(`select role::text as role, count(*)::int as c from users group by role`),
    pool.query(`select count(*)::int as c from teachers`),
    pool.query(`select count(*)::int as c from students`),
    pool.query(`select status::text as status, count(*)::int as c from courses group by status`),
    pool.query(`select status::text as status, count(*)::int as c from lesson_requests group by status`),
    pool
      .query(
        `select status::text as status, count(*)::int as c from group_lesson_requests group by status`,
      )
      .catch(() => ({ rows: [] as { status: string; c: number }[] })),
    pool.query(
      `select count(*)::int as c from subscription_payments
       where method = 'bank_transfer' and state = 'pending'`,
    ),
    pool.query(`select count(*)::int as c from subscription_payments where state = 'pending'`),
    pool.query(
      `select count(*)::int as c from teacher_subscriptions
       where status = 'active' and expires_at > now()`,
    ),
    pool.query(
      `select status::text as status, count(*)::int as c from lesson_packages group by status`,
    ),
    pool.query(
      `select count(*)::int as c from student_subscriptions
       where lifecycle = 'active' and (expires_at is null or expires_at > now())`,
    ),
    pool.query(
      `select
         count(*) filter (where balance_minor > 0)::int as wallets_nonzero,
         coalesce(sum(balance_minor), 0)::text as balance_sum_minor
       from user_wallets`,
    ),
    pool.query(
      `select count(*)::int as c from student_homework_posts where status in ('open','claimed')`,
    ),
    pool.query(
      `select count(*)::int as c from direct_lesson_bookings where status in ('pending_funding','funded')`,
    ),
    pool.query(`select count(*)::int as c from parent_notifications where read_at is null`),
  ]);

  const usersByRole: Record<string, number> = {};
  for (const row of roles.rows as { role: string; c: number }[]) {
    usersByRole[row.role] = row.c;
  }
  const usersTotal = Object.values(usersByRole).reduce((a, b) => a + b, 0);

  const courseMap = Object.fromEntries(
    (coursesByStatus.rows as { status: string; c: number }[]).map((r) => [r.status, r.c]),
  );
  const lrMap = Object.fromEntries(
    (lrByStatus.rows as { status: string; c: number }[]).map((r) => [r.status, r.c]),
  );
  const glRows = glByStatus.rows as { status: string; c: number }[];
  const glMap = Object.fromEntries(glRows.map((r) => [r.status, r.c]));

  const pkgMap = Object.fromEntries(
    (packagesByStatus.rows as { status: string; c: number }[]).map((r) => [r.status, r.c]),
  );

  const w0 = walletsAgg.rows[0] as
    | { wallets_nonzero: number; balance_sum_minor: string }
    | undefined;

  return c.json({
    usersByRole,
    counts: {
      usersTotal,
      teachers: (teachersCt.rows[0] as { c: number }).c,
      students: (studentsCt.rows[0] as { c: number }).c,
      coursesPublished: courseMap.published ?? 0,
      coursesDraft: courseMap.draft ?? 0,
      coursesArchived: courseMap.archived ?? 0,
      lessonRequestsOpen: lrMap.open ?? 0,
      lessonRequestsMatched: lrMap.matched ?? 0,
      groupLessonRequestsOpen: glMap.open ?? 0,
      pendingBankPayments: (pendingBank.rows[0] as { c: number }).c,
      pendingSubscriptionPayments: (pendingSubPay.rows[0] as { c: number }).c,
      activeTeacherSubscriptions: (activeTeacherSubs.rows[0] as { c: number }).c,
      lessonPackagesActive: pkgMap.active ?? 0,
      activeStudentSubscriptions: (activeStudentSubs.rows[0] as { c: number }).c,
      walletsWithBalance: w0?.wallets_nonzero ?? 0,
      walletBalanceSumMinor: w0?.balance_sum_minor ?? "0",
      homeworkPostsActive: (homeworkOpen.rows[0] as { c: number }).c,
      directBookingsInFlight: (directBookingsActive.rows[0] as { c: number }).c,
      parentNotificationsUnread: (parentNotifUnread.rows[0] as { c: number }).c,
    },
    generatedAt: new Date().toISOString(),
  });
});

const usersQuery = z.object({
  q: z.string().max(120).optional(),
  role: z.enum(["student", "teacher", "admin", "guardian", ""]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).max(10_000).optional(),
});

admin.get("/users", requireAuth, async (c) => {
  const denied = assertAdminGate(c);
  if (denied) return denied;

  const parsed = usersQuery.safeParse({
    q: c.req.query("q") ?? "",
    role: c.req.query("role") ?? "",
    limit: c.req.query("limit") ?? "40",
    offset: c.req.query("offset") ?? "0",
  });
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const { q, role, limit, offset } = parsed.data;
  const lim = limit ?? 40;
  const off = offset ?? 0;
  const qTrim = q?.trim() ?? "";
  const roleTrim = role?.trim() ?? "";

  const args: unknown[] = [];
  let where = "true";
  if (qTrim.length > 0) {
    args.push(`%${qTrim}%`);
    args.push(`%${qTrim.toLowerCase()}%`);
    where += ` and (u.display_name ilike $${args.length - 1} or u.email_normalized ilike $${args.length})`;
  }
  if (roleTrim && roleTrim !== "") {
    args.push(roleTrim);
    where += ` and u.role = $${args.length}::user_role`;
  }

  const countR = await pool.query(
    `select count(*)::int as c from users u where ${where}`,
    args,
  );
  const total = (countR.rows[0] as { c: number }).c;

  args.push(lim, off);
  const limIdx = args.length - 1;
  const offIdx = args.length;
  const list = await pool.query(
    `select u.id, u.email, u.display_name, u.role::text as role,
            u.created_at, u.last_login_at
     from users u
     where ${where}
     order by u.created_at desc, u.id desc
     limit $${limIdx} offset $${offIdx}`,
    args,
  );

  return c.json({ users: list.rows, total, limit: lim, offset: off });
});

const teachersQuery = z.object({
  q: z.string().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).max(10_000).optional(),
});

admin.get("/teachers", requireAuth, async (c) => {
  const denied = assertAdminGate(c);
  if (denied) return denied;

  const parsed = teachersQuery.safeParse({
    q: c.req.query("q") ?? "",
    limit: c.req.query("limit") ?? "30",
    offset: c.req.query("offset") ?? "0",
  });
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const qTrim = parsed.data.q?.trim() ?? "";
  const lim = parsed.data.limit ?? 30;
  const off = parsed.data.offset ?? 0;

  const args: unknown[] = [];
  let where = "true";
  if (qTrim.length > 0) {
    args.push(`%${qTrim}%`);
    args.push(`%${qTrim.toLowerCase()}%`);
    where += ` and (u.display_name ilike $1 or u.email_normalized ilike $2)`;
  }

  const countR = await pool.query(
    `select count(*)::int as c
     from teachers t
     join users u on u.id = t.user_id
     where ${where}`,
    args,
  );
  const total = (countR.rows[0] as { c: number }).c;

  args.push(lim, off);
  const limIdx = args.length - 1;
  const offIdx = args.length;
  const list = await pool.query(
    `select t.id as teacher_id, t.user_id, t.verification_status::text as verification_status,
            t.created_at as teacher_created_at,
            u.email, u.display_name, u.last_login_at,
            ci.name as city_name
     from teachers t
     join users u on u.id = t.user_id
     left join cities ci on ci.id = t.city_id
     where ${where}
     order by t.created_at desc
     limit $${limIdx} offset $${offIdx}`,
    args,
  );

  return c.json({ teachers: list.rows, total, limit: lim, offset: off });
});

const lrListQuery = z.object({
  status: z.enum(["open", "matched", "cancelled", "expired"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

admin.get("/lesson-requests", requireAuth, async (c) => {
  const denied = assertAdminGate(c);
  if (denied) return denied;

  const rawStatus = c.req.query("status")?.trim();
  const parsed = lrListQuery.safeParse({
    status: rawStatus === "" ? undefined : rawStatus,
    limit: c.req.query("limit") ?? "50",
  });
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const st = parsed.data.status?.trim() ?? "";
  const lim = parsed.data.limit ?? 50;

  const args: unknown[] = [];
  let where = "true";
  if (st && st !== "") {
    args.push(st);
    where += ` and lr.status = $1::lesson_request_status`;
  }

  args.push(lim);
  const limIdx = args.length;
  const list = await pool.query(
    `select lr.id, lr.status::text as status, lr.delivery_mode::text as delivery_mode,
            lr.created_at, lr.expires_at,
            b.name as branch_name,
            u.display_name as student_display_name, u.email as student_email
     from lesson_requests lr
     join students s on s.id = lr.student_id
     join users u on u.id = s.user_id
     join branches b on b.id = lr.branch_id
     where ${where}
     order by lr.created_at desc
     limit $${limIdx}`,
    args,
  );

  const summary = await pool.query(
    `select status::text as status, count(*)::int as c from lesson_requests group by status`,
  );

  return c.json({
    requests: list.rows,
    summary: Object.fromEntries(
      (summary.rows as { status: string; c: number }[]).map((r) => [r.status, r.c]),
    ),
  });
});

const coursesListQuery = z.object({
  status: z.enum(["draft", "published", "archived", ""]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).max(10_000).optional(),
});

admin.get("/courses", requireAuth, async (c) => {
  const denied = assertAdminGate(c);
  if (denied) return denied;

  const rawSt = c.req.query("status")?.trim();
  const parsed = coursesListQuery.safeParse({
    status: rawSt === "" ? undefined : rawSt,
    limit: c.req.query("limit") ?? "40",
    offset: c.req.query("offset") ?? "0",
  });
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const st = parsed.data.status?.trim() ?? "";
  const lim = parsed.data.limit ?? 40;
  const off = parsed.data.offset ?? 0;

  const args: unknown[] = [];
  let where = "true";
  if (st) {
    args.push(st);
    where += ` and c.status = $${args.length}::course_status`;
  }

  const countR = await pool.query(`select count(*)::int as c from courses c where ${where}`, args);
  const total = (countR.rows[0] as { c: number }).c;

  args.push(lim, off);
  const limIdx = args.length - 1;
  const offIdx = args.length;
  const list = await pool.query(
    `select c.id, c.title, c.status::text as status, c.price_minor, c.currency,
            c.created_at, c.delivery_mode::text as delivery_mode,
            u.display_name as teacher_display_name, u.email as teacher_email,
            t.id as teacher_id
     from courses c
     join teachers t on t.id = c.teacher_id
     join users u on u.id = t.user_id
     where ${where}
     order by c.created_at desc
     limit $${limIdx} offset $${offIdx}`,
    args,
  );

  return c.json({ courses: list.rows, total, limit: lim, offset: off });
});

const subPayQuery = z.object({
  state: z.enum(["pending", "paid", "failed", "cancelled", ""]).optional(),
  method: z.enum(["paytr_iframe", "bank_transfer", ""]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).max(10_000).optional(),
});

admin.get("/subscription-payments", requireAuth, async (c) => {
  const denied = assertAdminGate(c);
  if (denied) return denied;

  const rawState = c.req.query("state")?.trim();
  const rawMethod = c.req.query("method")?.trim();
  const parsed = subPayQuery.safeParse({
    state: rawState === "" ? undefined : rawState,
    method: rawMethod === "" ? undefined : rawMethod,
    limit: c.req.query("limit") ?? "40",
    offset: c.req.query("offset") ?? "0",
  });
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const stateTrim = parsed.data.state?.trim() ?? "";
  const methodTrim = parsed.data.method?.trim() ?? "";
  const lim = parsed.data.limit ?? 40;
  const off = parsed.data.offset ?? 0;

  const args: unknown[] = [];
  let where = "true";
  if (stateTrim) {
    args.push(stateTrim);
    where += ` and sp.state = $${args.length}::payment_state`;
  }
  if (methodTrim) {
    args.push(methodTrim);
    where += ` and sp.method = $${args.length}::payment_method`;
  }

  const countR = await pool.query(
    `select count(*)::int as c from subscription_payments sp where ${where}`,
    args,
  );
  const total = (countR.rows[0] as { c: number }).c;

  args.push(lim, off);
  const limIdx = args.length - 1;
  const offIdx = args.length;
  const list = await pool.query(
    `select sp.id, sp.plan_code::text as plan_code, sp.method::text as method, sp.state::text as state,
            sp.amount_minor, sp.currency, sp.bank_ref, sp.created_at,
            u.display_name as teacher_display_name, u.email as teacher_email
     from subscription_payments sp
     join teachers t on t.id = sp.teacher_id
     join users u on u.id = t.user_id
     where ${where}
     order by sp.created_at desc
     limit $${limIdx} offset $${offIdx}`,
    args,
  );

  return c.json({ payments: list.rows, total, limit: lim, offset: off });
});

const patchRoleSchema = z.object({
  role: z.enum(["student", "teacher", "guardian", "admin"]),
});

admin.patch("/users/:userId/role", requireAuth, async (c) => {
  const denied = assertAdminGate(c);
  if (denied) return denied;

  const userId = c.req.param("userId")?.trim();
  if (!userId || !z.string().uuid().safeParse(userId).success) {
    return c.json({ error: "invalid_user_id" }, 400);
  }

  const parsed = patchRoleSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const newRole = parsed.data.role;

  const actorId = c.get("userId");

  const client = await pool.connect();
  try {
    await client.query("begin");

    const u = await client.query(
      `select id, role::text as role from users where id = $1 for update`,
      [userId],
    );
    const row = u.rows[0] as { id: string; role: string } | undefined;
    if (!row) {
      await client.query("rollback");
      return c.json({ error: "user_not_found" }, 404);
    }

    if (row.role === "teacher" && newRole !== "teacher") {
      await client.query("rollback");
      return c.json({ error: "cannot_demote_teacher_role_remove_profile_first" }, 409);
    }

    if (row.role === "admin" && newRole !== "admin") {
      const ac = await client.query(
        `select count(*)::int as c from users where role = 'admin'::user_role and id <> $1`,
        [userId],
      );
      const other = (ac.rows[0] as { c: number }).c;
      if (other < 1) {
        await client.query("rollback");
        return c.json({ error: "cannot_remove_last_admin" }, 409);
      }
    }

    if (actorId === userId && newRole !== "admin") {
      const ac = await client.query(
        `select count(*)::int as c from users where role = 'admin'::user_role and id <> $1`,
        [userId],
      );
      if ((ac.rows[0] as { c: number }).c < 1) {
        await client.query("rollback");
        return c.json({ error: "cannot_demote_self_last_admin" }, 409);
      }
    }

    if (newRole === "teacher") {
      await client.query(
        `insert into teachers (user_id) values ($1)
         on conflict (user_id) do nothing`,
        [userId],
      );
    }
    if (newRole === "student") {
      await client.query(
        `insert into students (user_id) values ($1)
         on conflict (user_id) do nothing`,
        [userId],
      );
    }

    await client.query(`update users set role = $1::user_role, updated_at = now() where id = $2`, [
      newRole,
      userId,
    ]);

    await client.query("commit");
    return c.json({ ok: true, userId, role: newRole });
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
});

registerAdminExtendedRoutes(admin);
