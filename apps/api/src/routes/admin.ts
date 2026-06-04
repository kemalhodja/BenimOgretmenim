import { Hono } from "hono";
import { z } from "zod";
import { pool } from "../db.js";
import type { AppVariables } from "../types.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { assertAdminGate } from "../lib/adminGate.js";
import { writeAdminAudit } from "../lib/adminAudit.js";
import { runLessonReminderJob } from "../lib/lessonReminders.js";
import {
  configurationHealthWarnings,
  runtimeHealthSnapshot,
  summarizeSystemHealth,
  type SystemHealthCheck,
} from "../lib/systemHealth.js";
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
    openDemoRequests,
    unansweredDemoRequests,
    pendingTeacherVerification,
    weakTeacherProfiles,
    classroomNoteCount,
    classroomRecordingCount,
    classroomMessageCount,
    homeworkQualityQueue,
    openSupportThreads,
    activeStudyPlans,
    recentAssessmentAttempts,
    guardianInviteStats,
    homeworkSlaBreaches,
    supportSlaBreaches,
    teacherQualityAvg,
    reconciliationIssues30d,
    completedLessons30d,
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
    pool.query(
      `select count(*)::int as c
       from lesson_requests
       where status = 'open' and request_kind = 'demo'`,
    ),
    pool.query(
      `select count(*)::int as c
       from lesson_requests lr
       where lr.status = 'open'
         and lr.request_kind = 'demo'
         and not exists (select 1 from lesson_offers o where o.request_id = lr.id)`,
    ),
    pool.query(`select count(*)::int as c from teachers where verification_status = 'pending'`),
    pool.query(
      `select count(*)::int as c
       from teachers t
       where (
         (case when t.verification_status = 'verified' then 15 else 0 end) +
         (case when t.city_id is not null then 10 else 0 end) +
         (case when length(trim(coalesce(t.bio_raw, ''))) >= 80 then 20
               when length(trim(coalesce(t.bio_raw, ''))) >= 40 then 10
               else 0 end) +
         (case when coalesce(trim(t.video_url), '') <> '' then 15 else 0 end) +
         (case when exists (select 1 from teacher_branches tbq where tbq.teacher_id = t.id) then 15 else 0 end) +
         (case when jsonb_typeof(coalesce(t.exam_docs_jsonb, '[]'::jsonb)) = 'array'
                 and jsonb_array_length(coalesce(t.exam_docs_jsonb, '[]'::jsonb)) > 0 then 10 else 0 end) +
         (case when jsonb_typeof(coalesce(t.platform_links_jsonb, '[]'::jsonb)) = 'array'
                 and jsonb_array_length(coalesce(t.platform_links_jsonb, '[]'::jsonb)) > 0 then 5 else 0 end) +
         (case when coalesce(t.rating_count, 0) > 0 then 10 else 0 end)
       ) < 40`,
    ),
    pool.query(`select count(*)::int as c from classroom_session_notes`),
    pool.query(`select count(*)::int as c from recording_assets where status <> 'deleted'`),
    pool.query(`select count(*)::int as c from classroom_messages where deleted_at is null`),
    pool.query(
      `select count(*)::int as c
       from student_homework_posts
       where quality_status in ('pending_review', 'revision_requested', 'flagged')`,
    ),
    pool.query(`select count(*)::int as c from support_threads where status = 'open'`),
    pool.query(`select count(*)::int as c from student_study_plans where status = 'active'`),
    pool.query(
      `select count(*)::int as c
       from student_assessment_attempts
       where created_at >= now() - interval '7 days'`,
    ),
    pool.query(
      `select
         count(*) filter (where accepted_at is null and expires_at > now())::int as active,
         count(*) filter (where accepted_at is not null)::int as accepted,
         count(*) filter (where accepted_at is null and expires_at <= now())::int as expired
       from guardian_invite_codes`,
    ).catch(() => ({ rows: [{ active: 0, accepted: 0, expired: 0 }] })),
    pool.query(
      `select count(*)::int as c
       from student_homework_posts
       where status in ('open', 'claimed')
         and resolution_sla_due_at is not null
         and resolution_sla_due_at < now()`,
    ).catch(() => ({ rows: [{ c: 0 }] })),
    pool.query(
      `select count(*)::int as c
       from support_threads
       where status = 'open'
         and created_at < now() - interval '1 day'`,
    ).catch(() => ({ rows: [{ c: 0 }] })),
    pool.query(
      `select round(avg(
         (case when t.verification_status = 'verified' then 15 else 0 end) +
         (case when t.city_id is not null then 10 else 0 end) +
         (case when length(trim(coalesce(t.bio_raw, ''))) >= 80 then 20
               when length(trim(coalesce(t.bio_raw, ''))) >= 40 then 10
               else 0 end) +
         (case when coalesce(trim(t.video_url), '') <> '' then 15 else 0 end) +
         (case when exists (select 1 from teacher_branches tbq where tbq.teacher_id = t.id) then 15 else 0 end) +
         (case when jsonb_typeof(coalesce(t.exam_docs_jsonb, '[]'::jsonb)) = 'array'
                 and jsonb_array_length(coalesce(t.exam_docs_jsonb, '[]'::jsonb)) > 0 then 10 else 0 end) +
         (case when jsonb_typeof(coalesce(t.platform_links_jsonb, '[]'::jsonb)) = 'array'
                 and jsonb_array_length(coalesce(t.platform_links_jsonb, '[]'::jsonb)) > 0 then 5 else 0 end) +
         (case when coalesce(t.rating_count, 0) > 0 then 10 else 0 end)
       ))::int as avg_score
       from teachers t`,
    ).catch(() => ({ rows: [{ avg_score: 0 }] })),
    pool.query(
      `select count(*)::int as c
       from payment_reconciliation_events
       where status <> 'matched'
         and resolution_status = 'open'
         and created_at >= now() - interval '30 days'`,
    ).catch(() => ({ rows: [{ c: 0 }] })),
    pool.query(
      `select count(*)::int as c
       from lesson_sessions
       where status = 'completed'
         and updated_at >= now() - interval '30 days'`,
    ).catch(() => ({ rows: [{ c: 0 }] })),
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
      openDemoRequests: (openDemoRequests.rows[0] as { c: number }).c,
      unansweredDemoRequests: (unansweredDemoRequests.rows[0] as { c: number }).c,
      pendingTeacherVerification: (pendingTeacherVerification.rows[0] as { c: number }).c,
      weakTeacherProfiles: (weakTeacherProfiles.rows[0] as { c: number }).c,
      classroomNoteCount: (classroomNoteCount.rows[0] as { c: number }).c,
      classroomRecordingCount: (classroomRecordingCount.rows[0] as { c: number }).c,
      classroomMessageCount: (classroomMessageCount.rows[0] as { c: number }).c,
      homeworkQualityQueue: (homeworkQualityQueue.rows[0] as { c: number }).c,
      openSupportThreads: (openSupportThreads.rows[0] as { c: number }).c,
      activeStudyPlans: (activeStudyPlans.rows[0] as { c: number }).c,
      recentAssessmentAttempts: (recentAssessmentAttempts.rows[0] as { c: number }).c,
      guardianInvitesActive: (guardianInviteStats.rows[0] as { active: number }).active,
      guardianInvitesAccepted: (guardianInviteStats.rows[0] as { accepted: number }).accepted,
      guardianInvitesExpired: (guardianInviteStats.rows[0] as { expired: number }).expired,
      homeworkSlaBreaches: (homeworkSlaBreaches.rows[0] as { c: number }).c,
      supportSlaBreaches: (supportSlaBreaches.rows[0] as { c: number }).c,
      teacherQualityAvg: (teacherQualityAvg.rows[0] as { avg_score: number | null }).avg_score ?? 0,
      reconciliationIssues30d: (reconciliationIssues30d.rows[0] as { c: number }).c,
      completedLessons30d: (completedLessons30d.rows[0] as { c: number }).c,
    },
    generatedAt: new Date().toISOString(),
  });
});

admin.get("/system-health", requireAuth, async (c) => {
  const denied = assertAdminGate(c);
  if (denied) return denied;

  const checks: Array<
    SystemHealthCheck & {
      latencyMs?: number;
      message?: string;
      metadata?: Record<string, unknown>;
    }
  > = [];

  const dbStarted = Date.now();
  try {
    const r = await pool.query(
      `select now() as db_now,
              current_database() as database_name,
              current_setting('server_version') as server_version`,
    );
    checks.push({
      name: "database",
      status: "ok",
      latencyMs: Date.now() - dbStarted,
      metadata: r.rows[0] ?? {},
    });
  } catch (e) {
    checks.push({
      name: "database",
      status: "down",
      latencyMs: Date.now() - dbStarted,
      message: e instanceof Error ? e.message : "database_unavailable",
    });
  }

  try {
    const exists = await pool.query(`select to_regclass('public.schema_migrations') as table_name`);
    if (!exists.rows[0]?.table_name) {
      checks.push({
        name: "migrations",
        status: "degraded",
        message: "schema_migrations tablosu bulunamadı.",
      });
    } else {
      const migration = await pool.query(
        `select count(*)::int as applied_count,
                max(filename) as latest_migration,
                max(applied_at) as latest_applied_at
         from schema_migrations`,
      );
      checks.push({
        name: "migrations",
        status: "ok",
        metadata: migration.rows[0] ?? {},
      });
    }
  } catch (e) {
    checks.push({
      name: "migrations",
      status: "degraded",
      message: e instanceof Error ? e.message : "migration_check_failed",
    });
  }

  try {
    const ops = await pool.query(
      `select
         to_regclass('public.admin_audit_events') as audit_table,
         to_regclass('public.payment_reconciliation_events') as reconciliation_table,
         to_regclass('public.guardian_invite_codes') as guardian_invites_table`,
    );
    const auditReady = !!ops.rows[0]?.audit_table;
    const reconciliationReady = !!ops.rows[0]?.reconciliation_table;
    const guardianInvitesReady = !!ops.rows[0]?.guardian_invites_table;
    const latest = reconciliationReady
      ? await pool.query(
          `select created_at, status, merchant_oid
           from payment_reconciliation_events
           order by created_at desc
           limit 1`,
        )
      : { rows: [] };
    checks.push({
      name: "payment_ops",
      status: auditReady && reconciliationReady && guardianInvitesReady ? "ok" : "degraded",
      metadata: {
        auditReady,
        reconciliationReady,
        guardianInvitesReady,
        latestReconciliation: latest.rows[0] ?? null,
      },
    });
  } catch (e) {
    checks.push({
      name: "payment_ops",
      status: "degraded",
      message: e instanceof Error ? e.message : "payment_ops_check_failed",
    });
  }

  const warnings = configurationHealthWarnings();
  checks.push({
    name: "configuration",
    status: warnings.length ? "degraded" : "ok",
    metadata: { warnings },
  });

  const status = summarizeSystemHealth(checks);
  return c.json({
    status,
    generatedAt: new Date().toISOString(),
    runtime: runtimeHealthSnapshot(),
    checks,
  });
});

admin.post("/reminders/run", requireAuth, async (c) => {
  const denied = assertAdminGate(c);
  if (denied) return denied;
  const result = await runLessonReminderJob(pool);
  return c.json({ ok: true, result });
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
  verificationStatus: z.enum(["unverified", "pending", "verified", "rejected", ""]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).max(10_000).optional(),
});

admin.get("/teachers", requireAuth, async (c) => {
  const denied = assertAdminGate(c);
  if (denied) return denied;

  const parsed = teachersQuery.safeParse({
    q: c.req.query("q") ?? "",
    verificationStatus: c.req.query("verificationStatus") ?? "",
    limit: c.req.query("limit") ?? "30",
    offset: c.req.query("offset") ?? "0",
  });
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const qTrim = parsed.data.q?.trim() ?? "";
  const verificationStatus = parsed.data.verificationStatus?.trim() ?? "";
  const lim = parsed.data.limit ?? 30;
  const off = parsed.data.offset ?? 0;

  const args: unknown[] = [];
  let where = "true";
  if (qTrim.length > 0) {
    args.push(`%${qTrim}%`);
    args.push(`%${qTrim.toLowerCase()}%`);
    where += ` and (u.display_name ilike $1 or u.email_normalized ilike $2)`;
  }
  if (verificationStatus) {
    args.push(verificationStatus);
    where += ` and t.verification_status = $${args.length}::teacher_verification_status`;
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
            ci.name as city_name,
            (
              (case when t.verification_status = 'verified' then 15 else 0 end) +
              (case when t.city_id is not null then 10 else 0 end) +
              (case when length(trim(coalesce(t.bio_raw, ''))) >= 80 then 20
                    when length(trim(coalesce(t.bio_raw, ''))) >= 40 then 10
                    else 0 end) +
              (case when coalesce(trim(t.video_url), '') <> '' then 15 else 0 end) +
              (case when exists (select 1 from teacher_branches tbq where tbq.teacher_id = t.id) then 15 else 0 end) +
              (case when jsonb_typeof(coalesce(t.exam_docs_jsonb, '[]'::jsonb)) = 'array'
                      and jsonb_array_length(coalesce(t.exam_docs_jsonb, '[]'::jsonb)) > 0 then 10 else 0 end) +
              (case when jsonb_typeof(coalesce(t.platform_links_jsonb, '[]'::jsonb)) = 'array'
                      and jsonb_array_length(coalesce(t.platform_links_jsonb, '[]'::jsonb)) > 0 then 5 else 0 end) +
              (case when coalesce(t.rating_count, 0) > 0 then 10 else 0 end)
            )::int as profile_quality_score,
            coalesce(trim(t.video_url), '') <> '' as has_video,
            (
              jsonb_typeof(coalesce(t.exam_docs_jsonb, '[]'::jsonb)) = 'array'
              and jsonb_array_length(coalesce(t.exam_docs_jsonb, '[]'::jsonb)) > 0
            ) as has_exam_docs,
            (select count(*)::int from teacher_branches tb where tb.teacher_id = t.id) as branch_count,
            (
              select count(*)::int
              from lesson_sessions ls
              join lesson_packages lp on lp.id = ls.package_id
              where lp.teacher_id = t.id and ls.status = 'completed'
            ) as completed_sessions_count
     from teachers t
     join users u on u.id = t.user_id
     left join cities ci on ci.id = t.city_id
     where ${where}
     order by
       case t.verification_status when 'pending' then 0 when 'unverified' then 1 when 'rejected' then 2 else 3 end,
       profile_quality_score asc,
       t.created_at desc
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
            lr.request_kind, lr.target_teacher_id, lr.topic_text,
            lr.created_at, lr.expires_at,
            b.name as branch_name,
            u.display_name as student_display_name, u.email as student_email,
            tu.display_name as target_teacher_display_name
     from lesson_requests lr
     join students s on s.id = lr.student_id
     join users u on u.id = s.user_id
     join branches b on b.id = lr.branch_id
     left join teachers tt on tt.id = lr.target_teacher_id
     left join users tu on tu.id = tt.user_id
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

admin.get("/audit-events", requireAuth, async (c) => {
  const denied = assertAdminGate(c);
  if (denied) return denied;
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? "50") || 50));
  const offset = Math.min(10_000, Math.max(0, Number(c.req.query("offset") ?? "0") || 0));
  const entityType = c.req.query("entityType")?.trim();
  const args: unknown[] = [];
  let where = "true";
  if (entityType) {
    args.push(entityType);
    where += ` and entity_type = $${args.length}`;
  }
  const countR = await pool.query(`select count(*)::int as c from admin_audit_events where ${where}`, args);
  args.push(limit, offset);
  const li = args.length - 1;
  const oi = args.length;
  const rows = await pool.query(
    `select e.id, e.actor_user_id, e.actor_role, e.request_id, e.action,
            e.entity_type, e.entity_id, e.reason, e.before_jsonb, e.after_jsonb,
            e.metadata_jsonb, e.created_at,
            u.email as actor_email, u.display_name as actor_display_name
     from admin_audit_events e
     left join users u on u.id = e.actor_user_id
     where ${where}
     order by e.created_at desc
     limit $${li} offset $${oi}`,
    args,
  );
  return c.json({ events: rows.rows, total: (countR.rows[0] as { c: number }).c, limit, offset });
});

admin.get("/payment-reconciliation", requireAuth, async (c) => {
  const denied = assertAdminGate(c);
  if (denied) return denied;
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? "50") || 50));
  const offset = Math.min(10_000, Math.max(0, Number(c.req.query("offset") ?? "0") || 0));
  const status = c.req.query("status")?.trim();
  const resolutionStatus = c.req.query("resolutionStatus")?.trim();
  const args: unknown[] = [];
  let where = "true";
  if (status) {
    args.push(status);
    where += ` and status = $${args.length}`;
  }
  if (resolutionStatus) {
    args.push(resolutionStatus);
    where += ` and resolution_status = $${args.length}`;
  }
  const countR = await pool.query(`select count(*)::int as c from payment_reconciliation_events where ${where}`, args);
  const [statusSummary, riskSummary] = await Promise.all([
    pool.query(
      `select status, resolution_status, count(*)::int as count, max(created_at) as latest_at
       from payment_reconciliation_events
       group by status, resolution_status
       order by count desc, status asc, resolution_status asc`,
    ),
    pool.query(
      `select
         count(*) filter (where status <> 'matched' and resolution_status = 'open')::int as open_issues,
         count(*) filter (where status <> 'matched')::int as issues_30d,
         count(*) filter (where status = 'amount_mismatch' and resolution_status = 'open')::int as amount_mismatches_30d,
         count(*) filter (where status = 'unknown_merchant_oid' and resolution_status = 'open')::int as unknown_merchant_oids_30d,
         count(*) filter (where status = 'failed' and resolution_status = 'open')::int as failed_30d,
         max(created_at) filter (where status <> 'matched' and resolution_status = 'open') as latest_issue_at
       from payment_reconciliation_events
       where created_at >= now() - interval '30 days'`,
    ),
  ]);
  args.push(limit, offset);
  const li = args.length - 1;
  const oi = args.length;
  const rows = await pool.query(
    `select id, provider, merchant_oid, payment_table, payment_id,
            expected_amount_minor, received_amount_minor, status,
            resolution_status, resolution_kind, resolution_note,
            resolved_by_user_id, resolved_at, updated_at,
            details_jsonb, created_at
     from payment_reconciliation_events
     where ${where}
     order by created_at desc
     limit $${li} offset $${oi}`,
    args,
  );
  const risk = riskSummary.rows[0] as
    | {
        issues_30d: number;
        amount_mismatches_30d: number;
        unknown_merchant_oids_30d: number;
        failed_30d: number;
      open_issues: number;
        latest_issue_at: string | null;
      }
    | undefined;
  return c.json({
    events: rows.rows,
    total: (countR.rows[0] as { c: number }).c,
    limit,
    offset,
    summary: {
      byStatus: statusSummary.rows,
      openIssues: risk?.open_issues ?? 0,
      issues30d: risk?.issues_30d ?? 0,
      amountMismatches30d: risk?.amount_mismatches_30d ?? 0,
      unknownMerchantOids30d: risk?.unknown_merchant_oids_30d ?? 0,
      failed30d: risk?.failed_30d ?? 0,
      latestIssueAt: risk?.latest_issue_at ?? null,
    },
  });
});

const paymentReconciliationResolutionSchema = z.object({
  resolutionStatus: z.enum(["open", "resolved", "dismissed"]),
  resolutionKind: z
    .enum(["provider_retry", "manual_adjustment", "manual_refund", "duplicate", "not_actionable", "other"])
    .nullable()
    .optional(),
  note: z.string().trim().max(1000).optional(),
});

admin.patch("/payment-reconciliation/:eventId", requireAuth, async (c) => {
  const denied = assertAdminGate(c);
  if (denied) return denied;

  const eventId = c.req.param("eventId")?.trim();
  if (!eventId || !z.string().uuid().safeParse(eventId).success) {
    return c.json({ error: "invalid_event_id" }, 400);
  }

  const parsed = paymentReconciliationResolutionSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const actorId = c.get("userId");
  const actorRole = c.get("userRole");
  const resolutionStatus = parsed.data.resolutionStatus;
  const resolutionKind = resolutionStatus === "open" ? null : (parsed.data.resolutionKind ?? "other");
  const note = parsed.data.note?.trim() || null;

  const client = await pool.connect();
  try {
    await client.query("begin");
    const beforeQ = await client.query(
      `select id, merchant_oid, payment_table, payment_id, status,
              resolution_status, resolution_kind, resolution_note, resolved_by_user_id, resolved_at
       from payment_reconciliation_events
       where id = $1
       for update`,
      [eventId],
    );
    const before = beforeQ.rows[0] as Record<string, unknown> | undefined;
    if (!before) {
      await client.query("rollback");
      return c.json({ error: "event_not_found" }, 404);
    }

    const updateQ = await client.query(
      `update payment_reconciliation_events
       set resolution_status = $2,
           resolution_kind = $3,
           resolution_note = $4,
           resolved_by_user_id = case when $2 = 'open' then null else $5::uuid end,
           resolved_at = case when $2 = 'open' then null else now() end,
           updated_at = now()
       where id = $1
       returning id, merchant_oid, payment_table, payment_id, status,
                 resolution_status, resolution_kind, resolution_note, resolved_by_user_id, resolved_at, updated_at`,
      [eventId, resolutionStatus, resolutionKind, note, actorId],
    );
    const after = updateQ.rows[0] as Record<string, unknown>;

    await writeAdminAudit(
      {
        actorUserId: actorId,
        actorRole,
        requestId: c.req.header("x-request-id") ?? c.get("requestId") ?? null,
        action: "payment_reconciliation_resolution_update",
        entityType: "payment_reconciliation_event",
        entityId: eventId,
        reason: note,
        before,
        after,
        metadata: {
          merchantOid: after.merchant_oid,
          resolutionStatus,
          resolutionKind,
        },
      },
      client,
    );

    await client.query("commit");
    return c.json({ event: after });
  } catch (e) {
    await client.query("rollback").catch(() => {});
    console.error("[admin] payment reconciliation resolution failed", {
      eventId,
      error: e instanceof Error ? e.message : String(e),
    });
    return c.json({ error: "resolution_update_failed" }, 500);
  } finally {
    client.release();
  }
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

    await writeAdminAudit(
      {
        actorUserId: actorId,
        actorRole: c.get("userRole"),
        requestId: c.req.header("x-request-id") ?? null,
        action: "user.role.update",
        entityType: "user",
        entityId: userId,
        reason: "admin_role_change",
        before: { role: row.role },
        after: { role: newRole },
      },
      client,
    );

    await client.query("commit");
    return c.json({ ok: true, userId, role: newRole });
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
});

const opsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(40),
  offset: z.coerce.number().int().min(0).max(10_000).optional().default(0),
});

admin.get("/classroom-notes", requireAuth, async (c) => {
  const denied = assertAdminGate(c);
  if (denied) return denied;
  const parsed = opsQuery.safeParse({
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const { limit, offset } = parsed.data;
  const [rows, total] = await Promise.all([
    pool.query(
      `select n.id, n.subject_type, n.subject_id, n.body,
              n.created_at, u.display_name as author_display_name
       from classroom_session_notes n
       left join users u on u.id = n.author_user_id
       order by n.created_at desc
       limit $1 offset $2`,
      [limit, offset],
    ),
    pool.query(`select count(*)::int as c from classroom_session_notes`),
  ]);
  return c.json({ notes: rows.rows, total: (total.rows[0] as { c: number }).c });
});

admin.get("/classroom-recordings", requireAuth, async (c) => {
  const denied = assertAdminGate(c);
  if (denied) return denied;
  const parsed = opsQuery.safeParse({
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const { limit, offset } = parsed.data;
  const [rows, total] = await Promise.all([
    pool.query(
      `select ra.id,
              coalesce(ra.subject_type, 'lesson_session') as subject_type,
              coalesce(ra.subject_id, cs.lesson_session_id) as subject_id,
              ra.status::text as status,
              coalesce(ra.title, 'Ders kaydı') as title,
              coalesce(ra.public_url, case when ra.storage_bucket = 'external_url' then ra.storage_object_key else null end) as public_url,
              ra.duration_seconds,
              ra.bytes::text as bytes,
              ra.created_at,
              u.display_name as created_by_display_name
       from recording_assets ra
       left join classroom_sessions cs on cs.id = ra.classroom_session_id
       left join users u on u.id = ra.created_by_user_id
       order by ra.created_at desc
       limit $1 offset $2`,
      [limit, offset],
    ),
    pool.query(`select count(*)::int as c from recording_assets`),
  ]);
  return c.json({ recordings: rows.rows, total: (total.rows[0] as { c: number }).c });
});

admin.get("/classroom-messages", requireAuth, async (c) => {
  const denied = assertAdminGate(c);
  if (denied) return denied;
  const parsed = opsQuery.safeParse({
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const { limit, offset } = parsed.data;
  const [rows, total] = await Promise.all([
    pool.query(
      `select id,
              subject_type,
              subject_id,
              author_role,
              author_display_name,
              message_type,
              body,
              created_at
       from classroom_messages
       where deleted_at is null
       order by created_at desc
       limit $1 offset $2`,
      [limit, offset],
    ),
    pool.query(`select count(*)::int as c from classroom_messages where deleted_at is null`),
  ]);
  return c.json({ messages: rows.rows, total: (total.rows[0] as { c: number }).c });
});

admin.get("/learning", requireAuth, async (c) => {
  const denied = assertAdminGate(c);
  if (denied) return denied;
  const parsed = opsQuery.safeParse({
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const { limit, offset } = parsed.data;
  const [rows, total] = await Promise.all([
    pool.query(
      `select 'study_plan' as kind, p.id, su.display_name as student_display_name,
              p.target_exam as title, p.weekly_minutes::text as metric,
              p.status, p.created_at
       from student_study_plans p
       join students s on s.id = p.student_id
       join users su on su.id = s.user_id
       union all
       select 'assessment_attempt' as kind, a.id, su.display_name as student_display_name,
              a.title, coalesce(a.score_percent::text, '') as metric,
              'recorded' as status, a.created_at
       from student_assessment_attempts a
       join students s on s.id = a.student_id
       join users su on su.id = s.user_id
       order by created_at desc
       limit $1 offset $2`,
      [limit, offset],
    ),
    pool.query(
      `select (
         (select count(*) from student_study_plans) +
         (select count(*) from student_assessment_attempts)
       )::int as c`,
    ),
  ]);
  return c.json({ rows: rows.rows, total: (total.rows[0] as { c: number }).c });
});

admin.get("/homework-quality", requireAuth, async (c) => {
  const denied = assertAdminGate(c);
  if (denied) return denied;
  const parsed = opsQuery.safeParse({
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const { limit, offset } = parsed.data;
  const [rows, total] = await Promise.all([
    pool.query(
      `select h.id, h.topic, h.status, h.help_text, h.answer_text, h.answer_video_url,
              h.grade_level_text, h.target_exam, h.learning_objective, h.urgency_level,
              h.target_answer_minutes, h.resolution_sla_due_at,
              h.quality_status, h.quality_score, h.moderator_note,
              h.revision_requested_at, h.accepted_quality_at, h.created_at,
              su.display_name as student_display_name,
              tu.display_name as teacher_display_name
       from student_homework_posts h
       join students s on s.id = h.student_id
       join users su on su.id = s.user_id
       left join teachers t on t.id = h.claimed_by_teacher_id
       left join users tu on tu.id = t.user_id
       where h.quality_status in ('pending_review', 'revision_requested', 'flagged')
       order by h.updated_at desc
       limit $1 offset $2`,
      [limit, offset],
    ),
    pool.query(
      `select count(*)::int as c
       from student_homework_posts
       where quality_status in ('pending_review', 'revision_requested', 'flagged')`,
    ),
  ]);
  return c.json({ posts: rows.rows, total: (total.rows[0] as { c: number }).c });
});

const homeworkQualityPatchSchema = z.object({
  qualityStatus: z.enum(["not_reviewed", "pending_review", "accepted", "revision_requested", "flagged"]),
  qualityScore: z.number().int().min(1).max(5).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
});

admin.patch("/homework-quality/:postId", requireAuth, async (c) => {
  const denied = assertAdminGate(c);
  if (denied) return denied;
  const postId = c.req.param("postId");
  if (!z.string().uuid().safeParse(postId).success) return c.json({ error: "invalid_post_id" }, 400);
  const parsed = homeworkQualityPatchSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const client = await pool.connect();
  try {
    await client.query("begin");
    const before = await client.query(
      `select h.quality_status, h.topic, h.student_id, h.claimed_by_teacher_id,
              su.id as student_user_id, tu.id as teacher_user_id
       from student_homework_posts h
       join students s on s.id = h.student_id
       join users su on su.id = s.user_id
       left join teachers t on t.id = h.claimed_by_teacher_id
       left join users tu on tu.id = t.user_id
       where h.id = $1
       for update of h`,
      [postId],
    );
    if (!before.rowCount) {
      await client.query("rollback");
      return c.json({ error: "not_found" }, 404);
    }
    const previous = String(before.rows[0].quality_status ?? "not_reviewed");
    const status = parsed.data.qualityStatus;
    const score = parsed.data.qualityScore ?? null;
    const note = parsed.data.note?.trim() || null;
    const updated = await client.query(
      `update student_homework_posts
       set quality_status = $2,
           quality_score = $3,
           moderator_note = $4,
           accepted_quality_at = case when $2 = 'accepted' then coalesce(accepted_quality_at, now()) else accepted_quality_at end,
           revision_requested_at = case when $2 = 'revision_requested' then now() else revision_requested_at end,
           updated_at = now()
       where id = $1
       returning id, topic, status, quality_status, quality_score, moderator_note, updated_at`,
      [postId, status, score, note],
    );
    await client.query(
      `insert into homework_quality_reviews (
         post_id, reviewer_user_id, previous_status, new_status, quality_score, note
       ) values ($1, $2, $3, $4, $5, $6)`,
      [postId, c.get("userId"), previous, status, score, note],
    );
    const qualityRow = before.rows[0] as {
      topic: string;
      student_id: string;
      student_user_id: string;
      teacher_user_id: string | null;
    };
    const shortTopic = qualityRow.topic.length > 100 ? `${qualityRow.topic.slice(0, 97)}…` : qualityRow.topic;
    const payload = JSON.stringify({
      kind: "homework_quality_review",
      homeworkPostId: postId,
      qualityStatus: status,
      qualityScore: score,
    });
    const studentTitle =
      status === "accepted"
        ? "Soru çözümü kalite kontrolünden geçti"
        : status === "revision_requested"
          ? "Soru çözümü için revizyon istendi"
          : "Soru çözümü kalite incelemede";
    await client.query(
      `insert into parent_notifications (
         recipient_user_id, student_id, snapshot_id, channel,
         title, body, payload_jsonb, delivery_status, sent_at
       ) values ($1, $2, null, 'in_app', $3, $4, $5::jsonb, 'sent', now())`,
      [
        qualityRow.student_user_id,
        qualityRow.student_id,
        studentTitle,
        note ? `"${shortTopic}" için kalite notu: ${note}` : `"${shortTopic}" için kalite durumu güncellendi.`,
        payload,
      ],
    );
    if (qualityRow.teacher_user_id) {
      await client.query(
        `insert into parent_notifications (
           recipient_user_id, student_id, snapshot_id, channel,
           title, body, payload_jsonb, delivery_status, sent_at
         ) values ($1, $2, null, 'in_app', $3, $4, $5::jsonb, 'sent', now())`,
        [
          qualityRow.teacher_user_id,
          qualityRow.student_id,
          status === "accepted" ? "Çözümünüz onaylandı" : "Çözümünüz kalite incelemesinden geçti",
          note ? `"${shortTopic}" için moderasyon notu: ${note}` : `"${shortTopic}" için kalite durumu güncellendi.`,
          payload,
        ],
      );
    }
    await client.query("commit");
    return c.json({ post: updated.rows[0] });
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
});

registerAdminExtendedRoutes(admin);
