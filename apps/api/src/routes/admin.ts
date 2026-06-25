import { Hono } from "hono";
import { z } from "zod";
import { pool } from "../db.js";
import type { AppVariables } from "../types.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { assertAdminGate, assertAdminFinanceScope, assertAdminSupportScope, assertAdminScope } from "../lib/adminGate.js";
import {
  getLastAdminAuditWriteFailure,
  getLastPaymentReconciliationWriteFailure,
  writeAdminAudit,
} from "../lib/adminAudit.js";
import { runLessonReminderJob } from "../lib/lessonReminders.js";
import { runGuardianWeeklyReports } from "../lib/guardianWeeklyReports.js";
import {
  configurationHealthWarnings,
  runtimeHealthSnapshot,
  summarizeSystemHealth,
  type SystemHealthCheck,
} from "../lib/systemHealth.js";
import { registerAdminExtendedRoutes } from "./adminExtended.js";
import { rateLimitSnapshot } from "../middleware/rateLimit.js";
import { holdCourseEnrollmentPayment, releaseCourseEnrollmentHold } from "../lib/courseEnrollmentWallet.js";
import { notifyUserInApp, notifyLessonVideoPublishedToGradeStudents } from "../lib/accountLifecycle.js";
import { notifyParentInApp } from "../lib/inAppNotifications.js";
import { notifyStudentAndGuardians } from "../lib/parentNotifyRecipients.js";

export const admin = new Hono<{ Variables: AppVariables }>();

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function csvLine(values: unknown[]): string {
  return values.map(csvCell).join(",");
}

const smokeRunSchema = z.object({
  status: z.enum(["ok", "failed"]),
  targetUrl: z.string().url().optional().nullable(),
  workflow: z.string().max(160).optional().nullable(),
  runId: z.string().max(80).optional().nullable(),
  commitSha: z.string().max(80).optional().nullable(),
  details: z.record(z.string(), z.unknown()).optional().default({}),
});

admin.post("/smoke-runs", async (c) => {
  const secret = process.env.SMOKE_RUN_SECRET?.trim();
  if (!secret) return c.json({ error: "smoke_run_secret_not_configured" }, 503);
  if (c.req.header("x-smoke-run-secret") !== secret) {
    return c.json({ error: "unauthorized" }, 401);
  }
  const parsed = smokeRunSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const table = await pool.query(`select to_regclass('public.operational_smoke_runs') as smoke_table`);
  if (!table.rows[0]?.smoke_table) {
    return c.json({ error: "smoke_runs_table_missing" }, 503);
  }

  const r = await pool.query(
    `insert into operational_smoke_runs (
       status, target_url, workflow, run_id, commit_sha, details_jsonb
     ) values ($1, $2, $3, $4, $5, $6::jsonb)
     returning id, status, created_at`,
    [
      parsed.data.status,
      parsed.data.targetUrl ?? null,
      parsed.data.workflow ?? null,
      parsed.data.runId ?? null,
      parsed.data.commitSha ?? null,
      JSON.stringify(parsed.data.details ?? {}),
    ],
  );
  return c.json({ run: r.rows[0] }, 201);
});

admin.get("/smoke-runs", requireAuth, async (c) => {
  const denied = assertAdminGate(c);
  if (denied) return denied;
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? "20") || 20));
  const offset = Math.min(10_000, Math.max(0, Number(c.req.query("offset") ?? "0") || 0));
  const table = await pool.query(`select to_regclass('public.operational_smoke_runs') as smoke_table`);
  if (!table.rows[0]?.smoke_table) {
    return c.json({ runs: [], total: 0, limit, offset });
  }
  const countR = await pool.query(`select count(*)::int as c from operational_smoke_runs`);
  const rows = await pool.query(
    `select id, status, target_url, workflow, run_id, commit_sha, details_jsonb, created_at
     from operational_smoke_runs
     order by created_at desc
     limit $1 offset $2`,
    [limit, offset],
  );
  return c.json({
    runs: rows.rows,
    total: (countR.rows[0] as { c: number }).c,
    limit,
    offset,
  });
});

admin.get("/course-applications", requireAuth, async (c) => {
  const denied = await assertAdminSupportScope(c);
  if (denied) return denied;
  const status = (c.req.query("status")?.trim() || "pending") as string;
  const kind = c.req.query("kind")?.trim() || "all";
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? "50") || 50));
  const offset = Math.min(10_000, Math.max(0, Number(c.req.query("offset") ?? "0") || 0));

  const teacherApps =
    kind === "student"
      ? { rows: [] }
      : await pool.query(
          `select ta.id, ta.status, ta.message, ta.experience_note, ta.created_at, ta.updated_at,
                  ta.course_id, c.title as course_title, c.status::text as course_status,
                  t.id as teacher_id, u.display_name as applicant_display_name, u.email as applicant_email,
                  'teacher'::text as application_kind
           from course_teacher_applications ta
           join courses c on c.id = ta.course_id
           join teachers t on t.id = ta.teacher_id
           join users u on u.id = t.user_id
           where ta.status::text = $1
           order by ta.created_at desc
           limit $2 offset $3`,
          [status, limit, offset],
        );

  const studentApps =
    kind === "teacher"
      ? { rows: [] }
      : await pool.query(
          `select sa.id, sa.status, sa.goal_note, sa.guardian_note, sa.created_at, sa.updated_at,
                  sa.course_id, c.title as course_title, c.status::text as course_status,
                  s.id as student_id, u.display_name as applicant_display_name, u.email as applicant_email,
                  'student'::text as application_kind
           from course_student_applications sa
           join courses c on c.id = sa.course_id
           join students s on s.id = sa.student_id
           join users u on u.id = s.user_id
           where sa.status::text = $1
           order by sa.created_at desc
           limit $2 offset $3`,
          [status, limit, offset],
        );

  const [teacherTotal, studentTotal] = await Promise.all([
    kind === "student"
      ? Promise.resolve({ rows: [{ c: 0 }] })
      : pool.query(
          `select count(*)::int as c from course_teacher_applications where status::text = $1`,
          [status],
        ),
    kind === "teacher"
      ? Promise.resolve({ rows: [{ c: 0 }] })
      : pool.query(
          `select count(*)::int as c from course_student_applications where status::text = $1`,
          [status],
        ),
  ]);

  const applications = [...teacherApps.rows, ...studentApps.rows].sort(
    (a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime(),
  );

  return c.json({
    applications,
    summary: {
      teacherPending: (teacherTotal.rows[0] as { c: number }).c,
      studentPending: (studentTotal.rows[0] as { c: number }).c,
      status,
    },
    total: (teacherTotal.rows[0] as { c: number }).c + (studentTotal.rows[0] as { c: number }).c,
    limit,
    offset,
  });
});

admin.get("/funnel/summary", requireAuth, async (c) => {
  const denied = assertAdminGate(c);
  if (denied) return denied;
  const days = Math.min(90, Math.max(1, Number(c.req.query("days") ?? "7") || 7));
  const table = await pool.query(`select to_regclass('public.funnel_events') as funnel_table`);
  if (!table.rows[0]?.funnel_table) {
    return c.json({ days, events: [], funnel: [], operations: { quotaExceeded: [], rateLimit: rateLimitSnapshot() } });
  }

  const events = await pool.query(
    `select event_name, count(*)::int as count
     from funnel_events
     where created_at >= now() - ($1::int * interval '1 day')
     group by event_name
     order by count desc`,
    [days],
  );
  const counts = new Map(events.rows.map((row) => [row.event_name as string, Number(row.count ?? 0)]));
  const stepNames = [
    "teacher_search",
    "teacher_profile_view",
    "teacher_shortlist",
    "demo_request_start",
    "lesson_request_created",
    "payment_checkout_start",
  ];
  const firstStep = counts.get(stepNames[0]) ?? 0;
  const funnel = stepNames.map((name) => ({
    eventName: name,
    count: counts.get(name) ?? 0,
    conversionFromSearch: firstStep > 0 ? Math.round(((counts.get(name) ?? 0) / firstStep) * 1000) / 10 : null,
  }));
  const quotaExceeded = await pool
    .query(
      `select event_name, count(*)::int as count
       from funnel_events
       where created_at >= now() - ($1::int * interval '1 day')
         and metadata_jsonb::text ilike '%quota%'
       group by event_name
       order by count desc`,
      [days],
    )
    .catch(() => ({ rows: [] }));

  return c.json({
    days,
    events: events.rows,
    funnel,
    operations: {
      quotaExceeded: quotaExceeded.rows,
      rateLimit: rateLimitSnapshot(),
    },
  });
});

admin.get("/quality/weekly-report", requireAuth, async (c) => {
  const denied = assertAdminGate(c);
  if (denied) return denied;
  const sinceSql = `now() - interval '7 days'`;
  const requiredTables = [
    "funnel_events",
    "subscription_payments",
    "student_sub_payments",
    "wallet_topup_payments",
    "teacher_campaigns",
    "payment_reconciliation_events",
    "support_threads",
    "teachers",
    "courses",
    "teacher_branches",
  ];
  const tableStatus = await pool
    .query<{ table_name: string; exists: boolean }>(
      `select table_name, to_regclass('public.' || table_name) is not null as exists
       from unnest($1::text[]) as t(table_name)`,
      [requiredTables],
    )
    .catch(() => ({ rows: requiredTables.map((table_name) => ({ table_name, exists: false })) }));
  const missingTables = tableStatus.rows
    .filter((row) => row.exists !== true)
    .map((row) => row.table_name);
  const [
    funnel,
    teacherRevenue,
    studentRevenue,
    walletTopups,
    pendingCampaigns,
    openReconciliation,
    supportSla,
    seoInventory,
    activeLandings,
  ] = await Promise.all([
    pool
      .query(
        `select event_name, count(*)::int as count
         from funnel_events
         where created_at >= ${sinceSql}
         group by event_name
         order by count desc`,
      )
      .catch(() => ({ rows: [] })),
    pool
      .query(
        `select coalesce(sum(amount_minor), 0)::bigint as amount_minor
         from subscription_payments
         where created_at >= ${sinceSql} and state = 'paid'`,
      )
      .catch(() => ({ rows: [{ amount_minor: 0 }] })),
    pool
      .query(
        `select coalesce(sum(amount_minor), 0)::bigint as amount_minor
         from student_sub_payments
         where created_at >= ${sinceSql} and state = 'paid'`,
      )
      .catch(() => ({ rows: [{ amount_minor: 0 }] })),
    pool
      .query(
        `select coalesce(sum(amount_minor), 0)::bigint as amount_minor
         from wallet_topup_payments
         where created_at >= ${sinceSql} and state = 'paid'`,
      )
      .catch(() => ({ rows: [{ amount_minor: 0 }] })),
    pool.query(`select count(*)::int as count from teacher_campaigns where status = 'pending_review'`).catch(() => ({ rows: [{ count: 0 }] })),
    pool
      .query(
        `select count(*)::int as count
         from payment_reconciliation_events
         where resolution_status = 'open' and status <> 'matched'`,
      )
      .catch(() => ({ rows: [{ count: 0 }] })),
    pool
      .query(
        `select count(*)::int as count
         from support_threads
         where status = 'open' and updated_at < now() - interval '24 hours'`,
      )
      .catch(() => ({ rows: [{ count: 0 }] })),
    pool
      .query(
        `select
           (select count(*)::int from teachers) as teachers,
           (select count(*)::int from courses where status = 'published') as courses,
           (select count(*)::int from teacher_campaigns where status = 'published') as campaigns`,
      )
      .catch(() => ({ rows: [{ teachers: 0, courses: 0, campaigns: 0 }] })),
    pool
      .query(
        `select count(*)::int as count
         from teachers t
         join teacher_branches tb on tb.teacher_id = t.id
         where t.city_id is not null`,
      )
      .catch(() => ({ rows: [{ count: 0 }] })),
  ]);

  return c.json({
    generatedAt: new Date().toISOString(),
    periodDays: 7,
    warnings: {
      missingTables,
      partial: missingTables.length > 0,
    },
    funnel: funnel.rows,
    revenue: {
      teacherSubscriptionsMinor: Number(teacherRevenue.rows[0]?.amount_minor ?? 0),
      studentSubscriptionsMinor: Number(studentRevenue.rows[0]?.amount_minor ?? 0),
      walletTopupsMinor: Number(walletTopups.rows[0]?.amount_minor ?? 0),
    },
    seo: {
      inventory: seoInventory.rows[0] ?? {},
      activeCityBranchTeacherCombos: activeLandings.rows[0]?.count ?? 0,
    },
    operations: {
      openPaymentRisks: openReconciliation.rows[0]?.count ?? 0,
      pendingCampaignModeration: pendingCampaigns.rows[0]?.count ?? 0,
      supportSlaBreaches: supportSla.rows[0]?.count ?? 0,
      rateLimit: rateLimitSnapshot(),
    },
  });
});

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
    lessonVideoModerationQueue,
    openSupportThreads,
    activeStudyPlans,
    recentAssessmentAttempts,
    guardianInviteStats,
    homeworkSlaBreaches,
    supportSlaBreaches,
    teacherQualityAvg,
    reconciliationIssues30d,
    completedLessons30d,
    pendingWithdrawals,
    openDisputes,
    pendingCampaignReview,
    pendingCourseTeacherApplications,
    pendingCourseStudentApplications,
    openJobAlerts,
    suspendedUsers,
    deletionRequestedUsers,
    revenue7dTeacher,
    revenue7dStudent,
    revenue7dWallet,
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
    pool
      .query(
        `select count(*)::int as c
         from teacher_lesson_videos
         where moderation_status in ('pending_review', 'flagged')
           and status <> 'archived'`,
      )
      .catch(() => ({ rows: [{ c: 0 }] })),
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
    pool.query(
      `select count(*)::int as c from teacher_wallet_withdrawals where status = 'pending'`,
    ).catch(() => ({ rows: [{ c: 0 }] })),
    pool.query(
      `select count(*)::int as c
       from platform_disputes
       where status in ('open', 'waiting_admin', 'waiting_user')`,
    ).catch(() => ({ rows: [{ c: 0 }] })),
    pool.query(
      `select count(*)::int as c from teacher_campaigns where status = 'pending_review'`,
    ).catch(() => ({ rows: [{ c: 0 }] })),
    pool.query(
      `select count(*)::int as c from course_teacher_applications where status = 'pending'`,
    ).catch(() => ({ rows: [{ c: 0 }] })),
    pool.query(
      `select count(*)::int as c from course_student_applications where status = 'pending'`,
    ).catch(() => ({ rows: [{ c: 0 }] })),
    pool.query(
      `select count(*)::int as c
       from platform_job_heartbeats
       where status = 'failed'
          or last_success_at is null
          or last_success_at < now() - (expected_interval_minutes::text || ' minutes')::interval * 2`,
    ).catch(() => ({ rows: [{ c: 0 }] })),
    pool.query(
      `select count(*)::int as c from users where account_status = 'suspended'`,
    ).catch(() => ({ rows: [{ c: 0 }] })),
    pool.query(
      `select count(*)::int as c from users where account_status = 'deletion_requested'`,
    ).catch(() => ({ rows: [{ c: 0 }] })),
    pool.query(
      `select coalesce(sum(amount_minor), 0)::bigint as amount_minor
       from subscription_payments
       where created_at >= now() - interval '7 days' and state = 'paid'`,
    ).catch(() => ({ rows: [{ amount_minor: 0 }] })),
    pool.query(
      `select coalesce(sum(amount_minor), 0)::bigint as amount_minor
       from student_sub_payments
       where created_at >= now() - interval '7 days' and state = 'paid'`,
    ).catch(() => ({ rows: [{ amount_minor: 0 }] })),
    pool.query(
      `select coalesce(sum(amount_minor), 0)::bigint as amount_minor
       from wallet_topup_payments
       where created_at >= now() - interval '7 days' and state = 'paid'`,
    ).catch(() => ({ rows: [{ amount_minor: 0 }] })),
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

  const revenue7dTeacherMinor = Number(revenue7dTeacher.rows[0]?.amount_minor ?? 0);
  const revenue7dStudentMinor = Number(revenue7dStudent.rows[0]?.amount_minor ?? 0);
  const revenue7dWalletMinor = Number(revenue7dWallet.rows[0]?.amount_minor ?? 0);

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
      lessonVideoModerationQueue: (lessonVideoModerationQueue.rows[0] as { c: number }).c,
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
      pendingWithdrawals: (pendingWithdrawals.rows[0] as { c: number }).c,
      openDisputes: (openDisputes.rows[0] as { c: number }).c,
      pendingCampaignReview: (pendingCampaignReview.rows[0] as { c: number }).c,
      pendingCourseTeacherApplications: (pendingCourseTeacherApplications.rows[0] as { c: number }).c,
      pendingCourseStudentApplications: (pendingCourseStudentApplications.rows[0] as { c: number }).c,
      openJobAlerts: (openJobAlerts.rows[0] as { c: number }).c,
      suspendedUsers: (suspendedUsers.rows[0] as { c: number }).c,
      deletionRequestedUsers: (deletionRequestedUsers.rows[0] as { c: number }).c,
    },
    revenue7d: {
      teacherSubscriptionsMinor: revenue7dTeacherMinor,
      studentSubscriptionsMinor: revenue7dStudentMinor,
      walletTopupsMinor: revenue7dWalletMinor,
      totalMinor: revenue7dTeacherMinor + revenue7dStudentMinor + revenue7dWalletMinor,
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
         to_regclass('public.guardian_invite_codes') as guardian_invites_table,
         to_regclass('public.operational_smoke_runs') as smoke_runs_table`,
    );
    const auditReady = !!ops.rows[0]?.audit_table;
    const reconciliationReady = !!ops.rows[0]?.reconciliation_table;
    const guardianInvitesReady = !!ops.rows[0]?.guardian_invites_table;
    const smokeRunsReady = !!ops.rows[0]?.smoke_runs_table;
    const latest = reconciliationReady
      ? await pool.query(
          `select created_at, status, merchant_oid
           from payment_reconciliation_events
           order by created_at desc
           limit 1`,
        )
      : { rows: [] };
    const latestSmoke = smokeRunsReady
      ? await pool.query(
          `select created_at, status, target_url, workflow, run_id, commit_sha
           from operational_smoke_runs
           order by created_at desc
           limit 1`,
        )
      : { rows: [] };
    const lastReconciliationWriteFailure = getLastPaymentReconciliationWriteFailure();
    const lastAdminAuditWriteFailure = getLastAdminAuditWriteFailure();
    const latestSmokeRow = latestSmoke.rows[0] as { status?: string; created_at?: Date } | undefined;
    const smokeStale =
      latestSmokeRow?.created_at instanceof Date
        ? Date.now() - latestSmokeRow.created_at.getTime() > 1000 * 60 * 60 * 24 * 8
        : false;
    checks.push({
      name: "payment_ops",
      status:
        auditReady &&
        reconciliationReady &&
        guardianInvitesReady &&
        smokeRunsReady &&
        !lastAdminAuditWriteFailure &&
        !lastReconciliationWriteFailure &&
        latestSmokeRow?.status !== "failed" &&
        !smokeStale
          ? "ok"
          : "degraded",
      metadata: {
        auditReady,
        reconciliationReady,
        guardianInvitesReady,
        smokeRunsReady,
        latestReconciliation: latest.rows[0] ?? null,
        latestSmoke: latestSmoke.rows[0] ?? null,
        smokeStale,
        lastAdminAuditWriteFailure,
        lastReconciliationWriteFailure,
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

  checks.push({
    name: "rate_limit",
    status: "ok",
    metadata: rateLimitSnapshot(),
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

admin.post("/weekly-reports/run", requireAuth, async (c) => {
  const denied = assertAdminGate(c);
  if (denied) return denied;
  const result = await runGuardianWeeklyReports(pool);
  return c.json({ ok: true, result });
});

const usersQuery = z.object({
  q: z.string().max(120).optional(),
  role: z.enum(["student", "teacher", "admin", "guardian", ""]).optional(),
  accountStatus: z.enum(["active", "suspended", "deletion_requested", ""]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).max(10_000).optional(),
});

admin.get("/users", requireAuth, async (c) => {
  const denied = await assertAdminSupportScope(c);
  if (denied) return denied;

  const parsed = usersQuery.safeParse({
    q: c.req.query("q") ?? "",
    role: c.req.query("role") ?? "",
    accountStatus: c.req.query("accountStatus") ?? c.req.query("status") ?? "",
    limit: c.req.query("limit") ?? "40",
    offset: c.req.query("offset") ?? "0",
  });
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const { q, role, accountStatus, limit, offset } = parsed.data;
  const lim = limit ?? 40;
  const off = offset ?? 0;
  const qTrim = q?.trim() ?? "";
  const roleTrim = role?.trim() ?? "";
  const statusTrim = accountStatus?.trim() ?? "";

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
  if (statusTrim) {
    args.push(statusTrim);
    where += ` and u.account_status = $${args.length}::user_account_status`;
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
            u.account_status::text as account_status,
            u.admin_scope::text as admin_scope,
            u.suspension_reason,
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
  const denied = await assertAdminSupportScope(c);
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
            ) as completed_sessions_count,
            t.exam_docs_jsonb,
            t.video_url,
            left(trim(coalesce(t.bio_raw, '')), 240) as bio_preview
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
  const denied = await assertAdminSupportScope(c);
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
  origin: z.enum(["teacher_created", "admin_campaign", ""]).optional(),
  teacherMissing: z.preprocess((v) => v === "1" || v === "true", z.boolean()).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).max(10_000).optional(),
});

const adminCourseCampaignSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(10000).optional().nullable(),
  branchId: z.number().int().positive().optional().nullable(),
  deliveryMode: z.enum(["online", "in_person", "hybrid"]).optional().default("online"),
  languageCode: z.string().min(2).max(10).optional().default("tr"),
  studentPriceMinor: z.number().int().min(0),
  teacherHourlyRateMinor: z.number().int().min(0),
  currency: z.string().length(3).optional().default("TRY"),
  status: z.enum(["draft", "published"]).optional().default("published"),
  applicationStatus: z.enum(["open", "closed"]).optional().default("open"),
  cohortTitle: z.string().min(3).max(120).optional().default("Ana grup"),
  capacity: z.number().int().min(1).max(500).optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  schedule: z.record(z.string(), z.unknown()).optional().default({}),
  details: z
    .object({
      targetAudience: z.string().max(1000).optional().nullable(),
      outcomes: z.array(z.string().max(240)).max(12).optional().default([]),
      requirements: z.array(z.string().max(240)).max(12).optional().default([]),
      applicationNote: z.string().max(1000).optional().nullable(),
    })
    .optional()
    .default({ outcomes: [], requirements: [] }),
  sessions: z
    .array(
      z.object({
        title: z.string().max(200).optional().nullable(),
        scheduledStart: z.string().datetime(),
        durationMinutes: z.number().int().min(15).max(240).optional().default(60),
      }),
    )
    .max(80)
    .optional()
    .default([]),
});

const applicationDecisionSchema = z.object({
  status: z.enum(["accepted", "rejected", "approved", "pending"]),
});

async function notifyCourseStudentApplicationDecision(application: {
  course_id: string;
  cohort_id: string | null;
  student_id: string;
  status: string;
}) {
  const course = await pool.query<{ title: string; price_minor: number; currency: string; cohort_title: string | null }>(
    `select c.title, c.price_minor, c.currency, cc.title as cohort_title
     from courses c
     left join course_cohorts cc on cc.id = $2
     where c.id = $1`,
    [application.course_id, application.cohort_id],
  );
  const title = course.rows[0]?.title ?? "Kurs kampanyası";
  const statusLabel =
    application.status === "approved"
      ? "onaylandı"
      : application.status === "rejected"
        ? "uygun bulunmadı"
        : "değerlendirmeye alındı";
  const body =
    application.status === "approved"
      ? `${title} ön kaydı onaylandı. Kurs, Kurslarım ekranına eklendi; ücret bakiyede bloke edildi ve kurs başlayınca tahsil edilecek.`
      : application.status === "rejected"
        ? `${title} ön kaydı şu an uygun bulunmadı. Kontenjan, seviye veya takvim nedeniyle farklı bir kampanya önerilebilir.`
        : `${title} ön kaydı tekrar değerlendirmeye alındı.`;

  await notifyStudentAndGuardians(
    pool,
    application.student_id,
    `Kurs ön kaydı ${statusLabel}`,
    body,
    {
      kind: "course_campaign_application_decision",
      courseId: application.course_id,
      cohortId: application.cohort_id,
      status: application.status,
      courseTitle: title,
      href: application.status === "approved" ? "/student/kurslar" : `/courses/${application.course_id}`,
    },
  );
}

async function notifyCourseTeacherApplicationDecision(application: {
  course_id: string;
  teacher_id: string;
  status: string;
}) {
  const r = await pool.query<{ title: string; recipient_user_id: string }>(
    `select c.title, t.user_id as recipient_user_id
     from course_teacher_applications cta
     join courses c on c.id = cta.course_id
     join teachers t on t.id = cta.teacher_id
     where cta.course_id = $1 and cta.teacher_id = $2`,
    [application.course_id, application.teacher_id],
  );
  const row = r.rows[0];
  if (!row?.recipient_user_id) return;

  const statusLabel =
    application.status === "accepted"
      ? "kabul edildi"
      : application.status === "rejected"
        ? "uygun bulunmadı"
        : "tekrar değerlendirmeye alındı";
  const body =
    application.status === "accepted"
      ? `${row.title} kampanyasında eğitmen olarak seçildiniz. Ders planı ve öğrenci ön kayıtlarını takip edebilirsiniz.`
      : application.status === "rejected"
        ? `${row.title} kampanyası için eğitmenlik başvurunuz şu an uygun bulunmadı. Yeni kampanyaları takip edebilirsiniz.`
        : `${row.title} kampanyası başvurunuz tekrar değerlendirmeye alındı.`;

  await pool.query(
    `insert into user_notifications (
       recipient_user_id, channel, title, body, payload_jsonb, delivery_status, sent_at
     )
     values ($1, 'in_app', $2, $3, $4::jsonb, 'sent', now())`,
    [
      row.recipient_user_id,
      `Kurs eğitmenlik başvurusu ${statusLabel}`,
      body,
      JSON.stringify({
        kind: "course_campaign_teacher_application_decision",
        courseId: application.course_id,
        teacherId: application.teacher_id,
        status: application.status,
        courseTitle: row.title,
        href: `/teacher/kurslar`,
      }),
    ],
  );
}

admin.get("/courses", requireAuth, async (c) => {
  const denied = await assertAdminSupportScope(c);
  if (denied) return denied;

  const rawSt = c.req.query("status")?.trim();
  const rawOrigin = c.req.query("origin")?.trim();
  const parsed = coursesListQuery.safeParse({
    status: rawSt === "" ? undefined : rawSt,
    origin: rawOrigin === "" ? undefined : rawOrigin,
    teacherMissing: c.req.query("teacherMissing"),
    limit: c.req.query("limit") ?? "40",
    offset: c.req.query("offset") ?? "0",
  });
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const st = parsed.data.status?.trim() ?? "";
  const origin = parsed.data.origin?.trim() ?? "";
  const lim = parsed.data.limit ?? 40;
  const off = parsed.data.offset ?? 0;

  const args: unknown[] = [];
  let where = "true";
  if (st) {
    args.push(st);
    where += ` and c.status = $${args.length}::course_status`;
  }
  if (origin) {
    args.push(origin);
    where += ` and c.origin = $${args.length}`;
  }
  if (parsed.data.teacherMissing) {
    where += ` and c.origin = 'admin_campaign' and c.teacher_id is null`;
  }

  const countR = await pool.query(`select count(*)::int as c from courses c where ${where}`, args);
  const total = (countR.rows[0] as { c: number }).c;

  args.push(lim, off);
  const limIdx = args.length - 1;
  const offIdx = args.length;
  const list = await pool.query(
    `select c.id, c.title, c.status::text as status, c.price_minor, c.currency,
            c.origin, c.teacher_hourly_rate_minor, c.application_status,
            c.created_at, c.delivery_mode::text as delivery_mode,
            coalesce(u.display_name, 'Öğretmen seçilecek') as teacher_display_name, u.email as teacher_email,
            t.id as teacher_id,
            (select count(*)::int from course_teacher_applications ta where ta.course_id = c.id) as teacher_application_count,
            (select count(*)::int from course_student_applications sa where sa.course_id = c.id) as student_application_count,
            (select count(*)::int from course_student_applications sa where sa.course_id = c.id and sa.status = 'pending') as student_application_pending_count,
            (select count(*)::int from course_student_applications sa where sa.course_id = c.id and sa.status = 'approved') as student_application_approved_count,
            (select count(*)::int from course_student_applications sa where sa.course_id = c.id and sa.status = 'rejected') as student_application_rejected_count,
            (select count(*)::int
             from course_enrollments ce
             join course_cohorts cc on cc.id = ce.cohort_id
             where cc.course_id = c.id
               and ce.payment_status not in ('cancelled', 'refunded')) as enrollment_count,
            (select count(*)::int
             from course_enrollments ce
             join course_cohorts cc on cc.id = ce.cohort_id
             where cc.course_id = c.id and ce.payment_status = 'wallet_held') as wallet_held_count,
            (select coalesce(sum(ce.price_minor), 0)::bigint
             from course_enrollments ce
             join course_cohorts cc on cc.id = ce.cohort_id
             where cc.course_id = c.id and ce.payment_status = 'wallet_held') as wallet_held_amount_minor,
            (select count(*)::int
             from course_enrollments ce
             join course_cohorts cc on cc.id = ce.cohort_id
             where cc.course_id = c.id and ce.payment_status = 'wallet_charged') as wallet_charged_count,
            (select coalesce(sum(ce.price_minor), 0)::bigint
             from course_enrollments ce
             join course_cohorts cc on cc.id = ce.cohort_id
             where cc.course_id = c.id and ce.payment_status = 'wallet_charged') as wallet_charged_amount_minor,
            (select count(*)::int
             from course_enrollments ce
             join course_cohorts cc on cc.id = ce.cohort_id
             where cc.course_id = c.id and ce.payment_status = 'refunded') as refunded_count,
            (select coalesce(sum(ce.refund_amount_minor), 0)::bigint
             from course_enrollments ce
             join course_cohorts cc on cc.id = ce.cohort_id
             where cc.course_id = c.id and ce.payment_status = 'refunded') as refunded_amount_minor,
            (select count(*)::int
             from course_teacher_payouts tp
             where tp.course_id = c.id and tp.status = 'wallet_paid') as teacher_payout_count,
            (select coalesce(sum(tp.teacher_net_amount_minor), 0)::bigint
             from course_teacher_payouts tp
             where tp.course_id = c.id and tp.status = 'wallet_paid') as teacher_payout_amount_minor
     from courses c
     left join teachers t on t.id = c.teacher_id
     left join users u on u.id = t.user_id
     where ${where}
     order by c.created_at desc
     limit $${limIdx} offset $${offIdx}`,
    args,
  );

  return c.json({ courses: list.rows, total, limit: lim, offset: off });
});

admin.post("/courses", requireAuth, async (c) => {
  const denied = await assertAdminSupportScope(c);
  if (denied) return denied;
  const parsed = adminCourseCampaignSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const body = parsed.data;
  const client = await pool.connect();
  try {
    await client.query("begin");
    const course = await client.query(
      `insert into courses (
         teacher_id, branch_id, title, description, delivery_mode, language_code,
         price_minor, currency, status, created_by_admin_user_id, origin,
         teacher_hourly_rate_minor, campaign_details_jsonb, application_status
       ) values (
         null, $1, $2, $3, $4::lesson_delivery_mode, $5,
         $6, $7, $8::course_status, $9, 'admin_campaign',
         $10, $11::jsonb, $12
       )
       returning id, title, status::text as status, origin, price_minor, teacher_hourly_rate_minor, currency`,
      [
        body.branchId ?? null,
        body.title.trim(),
        body.description?.trim() || null,
        body.deliveryMode,
        body.languageCode,
        body.studentPriceMinor,
        body.currency.toUpperCase(),
        body.status,
        c.get("userId"),
        body.teacherHourlyRateMinor,
        JSON.stringify(body.details ?? {}),
        body.applicationStatus,
      ],
    );
    const courseId = course.rows[0].id as string;
    const cohort = await client.query(
      `insert into course_cohorts (
         course_id, title, capacity, starts_at, ends_at, schedule_jsonb, status
       ) values ($1, $2, $3, $4, $5, $6::jsonb, 'planned')
       returning id, title, capacity, starts_at, ends_at`,
      [
        courseId,
        body.cohortTitle.trim(),
        body.capacity ?? null,
        body.startsAt ? new Date(body.startsAt) : null,
        body.endsAt ? new Date(body.endsAt) : null,
        JSON.stringify(body.schedule ?? {}),
      ],
    );
    const cohortId = cohort.rows[0].id as string;
    const sessions = [];
    for (let index = 0; index < body.sessions.length; index++) {
      const session = body.sessions[index];
      const start = new Date(session.scheduledStart);
      const end = new Date(start.getTime() + session.durationMinutes * 60_000);
      const r = await client.query(
        `insert into course_sessions (
           cohort_id, session_index, title, scheduled_start, scheduled_end, duration_minutes,
           delivery_mode, status
         ) values ($1, $2, $3, $4, $5, $6, $7::lesson_delivery_mode, 'scheduled')
         returning id, session_index, title, scheduled_start, scheduled_end, duration_minutes`,
        [
          cohortId,
          index + 1,
          session.title?.trim() || `Ders ${index + 1}`,
          start,
          end,
          session.durationMinutes,
          body.deliveryMode,
        ],
      );
      sessions.push(r.rows[0]);
    }
    await client.query("commit");
    await writeAdminAudit({
      actorUserId: c.get("userId"),
      actorRole: c.get("userRole"),
      requestId: c.req.header("x-request-id") ?? null,
      action: "course.admin_campaign.create",
      entityType: "course",
      entityId: courseId,
      reason: "admin_course_campaign_create",
      after: { course: course.rows[0], cohort: cohort.rows[0], sessions: sessions.length },
    });
    return c.json({ course: course.rows[0], cohort: cohort.rows[0], sessions }, 201);
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
});

admin.get("/courses/:courseId/applications", requireAuth, async (c) => {
  const denied = await assertAdminSupportScope(c);
  if (denied) return denied;
  const courseId = c.req.param("courseId");
  if (!z.string().uuid().safeParse(courseId).success) return c.json({ error: "invalid_course_id" }, 400);

  const teacherApplications = await pool.query(
    `select ta.id, ta.status, ta.message, ta.experience_note, ta.created_at, ta.updated_at,
            t.id as teacher_id, u.display_name as teacher_display_name, u.email as teacher_email,
            t.rating_avg, t.rating_count, t.verification_status
     from course_teacher_applications ta
     join teachers t on t.id = ta.teacher_id
     join users u on u.id = t.user_id
     where ta.course_id = $1
     order by case ta.status when 'accepted' then 0 when 'pending' then 1 else 2 end, ta.created_at desc`,
    [courseId],
  );
  const studentApplications = await pool.query(
    `select sa.id, sa.status, sa.goal_note, sa.guardian_note, sa.created_at, sa.updated_at,
            s.id as student_id, u.display_name as student_display_name, u.email as student_email,
            cc.title as cohort_title,
            ce.id as enrollment_id,
            ce.price_minor as enrollment_price_minor,
            ce.currency as enrollment_currency,
            ce.payment_status as enrollment_payment_status,
            ce.charged_at as enrollment_charged_at,
            ce.wallet_hold_id,
            wh.status::text as wallet_hold_status,
            wh.amount_minor as wallet_hold_amount_minor,
            coalesce(uw.balance_minor, 0)::bigint as wallet_balance_minor,
            coalesce(holds.active_hold_minor, 0)::bigint as wallet_active_hold_minor,
            greatest(coalesce(uw.balance_minor, 0)::bigint - coalesce(holds.active_hold_minor, 0)::bigint, 0)::bigint as wallet_available_minor
     from course_student_applications sa
     join students s on s.id = sa.student_id
     join users u on u.id = s.user_id
     left join course_cohorts cc on cc.id = sa.cohort_id
     left join course_enrollments ce on ce.cohort_id = sa.cohort_id and ce.student_id = sa.student_id
     left join user_wallet_holds wh on wh.id = ce.wallet_hold_id
     left join user_wallets uw on uw.user_id = u.id
     left join lateral (
       select sum(amount_minor)::bigint as active_hold_minor
       from user_wallet_holds h
       where h.user_id = u.id and h.status = 'active'
     ) holds on true
     where sa.course_id = $1
     order by case sa.status when 'pending' then 0 when 'approved' then 1 else 2 end, sa.created_at desc`,
    [courseId],
  );
  return c.json({ teacherApplications: teacherApplications.rows, studentApplications: studentApplications.rows });
});

admin.patch("/courses/:courseId/teacher-applications/:applicationId/status", requireAuth, async (c) => {
  const denied = await assertAdminSupportScope(c);
  if (denied) return denied;
  const courseId = c.req.param("courseId");
  const applicationId = c.req.param("applicationId");
  if (!z.string().uuid().safeParse(courseId).success) return c.json({ error: "invalid_course_id" }, 400);
  if (!z.string().uuid().safeParse(applicationId).success) return c.json({ error: "invalid_application_id" }, 400);
  const parsed = applicationDecisionSchema.safeParse(await c.req.json());
  if (!parsed.success || !["accepted", "rejected", "pending"].includes(parsed.data.status)) {
    return c.json({ error: "invalid_teacher_application_status" }, 400);
  }
  const client = await pool.connect();
  try {
    await client.query("begin");
    const course = await client.query(
      `select id, teacher_id from courses where id = $1 and origin = 'admin_campaign' for update`,
      [courseId],
    );
    if (!course.rowCount) {
      await client.query("rollback");
      return c.json({ error: "admin_campaign_not_found" }, 404);
    }
    const app = await client.query(
      `update course_teacher_applications
       set status = $1, decided_by_admin_user_id = $2, decided_at = now(), updated_at = now()
       where id = $3 and course_id = $4
       returning id, course_id, teacher_id, status`,
      [parsed.data.status, c.get("userId"), applicationId, courseId],
    );
    if (!app.rowCount) {
      await client.query("rollback");
      return c.json({ error: "application_not_found" }, 404);
    }
    if (parsed.data.status !== "accepted" && course.rows[0].teacher_id === app.rows[0].teacher_id) {
      await client.query(`update courses set teacher_id = null, updated_at = now() where id = $1`, [courseId]);
    }
    if (parsed.data.status === "accepted") {
      await client.query(
        `update course_teacher_applications
         set status = 'rejected', decided_by_admin_user_id = $1, decided_at = now(), updated_at = now()
         where course_id = $2 and id <> $3 and status = 'pending'`,
        [c.get("userId"), courseId, applicationId],
      );
      await client.query(`update courses set teacher_id = $1, updated_at = now() where id = $2`, [
        app.rows[0].teacher_id,
        courseId,
      ]);
    }
    await client.query("commit");
    await notifyCourseTeacherApplicationDecision(app.rows[0] as {
      course_id: string;
      teacher_id: string;
      status: string;
    });
    await writeAdminAudit({
      actorUserId: c.get("userId"),
      actorRole: c.get("userRole"),
      requestId: c.req.header("x-request-id") ?? null,
      action: "course.teacher_application.status",
      entityType: "course_teacher_application",
      entityId: applicationId,
      reason: "admin_teacher_selection",
      after: app.rows[0],
    });
    return c.json({ application: app.rows[0] });
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
});

admin.patch("/courses/:courseId/student-applications/:applicationId/status", requireAuth, async (c) => {
  const denied = await assertAdminSupportScope(c);
  if (denied) return denied;
  const courseId = c.req.param("courseId");
  const applicationId = c.req.param("applicationId");
  if (!z.string().uuid().safeParse(courseId).success) return c.json({ error: "invalid_course_id" }, 400);
  if (!z.string().uuid().safeParse(applicationId).success) return c.json({ error: "invalid_application_id" }, 400);
  const parsed = applicationDecisionSchema.safeParse(await c.req.json());
  if (!parsed.success || !["approved", "rejected", "pending"].includes(parsed.data.status)) {
    return c.json({ error: "invalid_student_application_status" }, 400);
  }
  const actorUserId = c.get("userId");
  const client = await pool.connect();
  let application: {
    id: string;
    course_id: string;
    cohort_id: string | null;
    student_id: string;
    status: string;
  } | null = null;
  let enrollment: { id: string; enrolled_at: string; payment_status?: string; wallet_hold_id?: string | null } | null = null;
  try {
    await client.query("begin");
    const course = await client.query<{ price_minor: number; currency: string }>(
      `select price_minor, currency from courses where id = $1 and origin = 'admin_campaign' for update`,
      [courseId],
    );
    if (!course.rowCount) {
      await client.query("rollback");
      return c.json({ error: "admin_campaign_not_found" }, 404);
    }
    const r = await client.query<{
      id: string;
      course_id: string;
      cohort_id: string | null;
      student_id: string;
      status: string;
    }>(
      `update course_student_applications
       set status = $1, decided_by_admin_user_id = $2, decided_at = now(), updated_at = now()
       where id = $3 and course_id = $4
       returning id, course_id, cohort_id, student_id, status`,
      [parsed.data.status, actorUserId, applicationId, courseId],
    );
    if (!r.rowCount) {
      await client.query("rollback");
      return c.json({ error: "application_not_found" }, 404);
    }
    application = r.rows[0];

    if (application.status === "approved") {
      let cohortId = application.cohort_id;
      if (!cohortId) {
        const defaultCohort = await client.query<{ id: string }>(
          `select id from course_cohorts
           where course_id = $1 and status in ('planned', 'active')
           order by starts_at nulls last, created_at asc
           limit 1`,
          [courseId],
        );
        cohortId = defaultCohort.rows[0]?.id ?? null;
        if (!cohortId) {
          await client.query("rollback");
          return c.json({ error: "no_active_campaign_cohort" }, 409);
        }
        const updated = await client.query<{
          id: string;
          course_id: string;
          cohort_id: string | null;
          student_id: string;
          status: string;
        }>(
          `update course_student_applications
           set cohort_id = $1, updated_at = now()
           where id = $2
           returning id, course_id, cohort_id, student_id, status`,
          [cohortId, application.id],
        );
        application = updated.rows[0];
      }

      const existing = await client.query<{
        id: string;
        enrolled_at: string;
        payment_status: string;
        wallet_hold_id: string | null;
      }>(
        `select id, enrolled_at, payment_status, wallet_hold_id from course_enrollments where cohort_id = $1 and student_id = $2`,
        [cohortId, application.student_id],
      );
      enrollment = existing.rows[0] ?? null;
      const enrollmentFinalized = enrollment?.payment_status === "cancelled" || enrollment?.payment_status === "refunded";
      if (!enrollment || enrollmentFinalized) {
        const cohort = await client.query<{ capacity: number | null; enrolled_count: number }>(
          `select cc.capacity,
                  (select count(*)::int
                   from course_enrollments e
                   where e.cohort_id = cc.id
                     and e.payment_status not in ('cancelled', 'refunded')) as enrolled_count
           from course_cohorts cc
           where cc.id = $1 and cc.course_id = $2 and cc.status in ('planned', 'active')
           for update`,
          [cohortId, courseId],
        );
        if (!cohort.rowCount) {
          await client.query("rollback");
          return c.json({ error: "invalid_campaign_cohort" }, 400);
        }
        const capacity = cohort.rows[0].capacity;
        if (capacity != null && cohort.rows[0].enrolled_count >= capacity) {
          await client.query("rollback");
          return c.json({ error: "cohort_full" }, 409);
        }
        const enrollmentMetadata = JSON.stringify({
          source: "course_campaign_application",
          applicationId: application.id,
          courseId,
          approvedByAdminUserId: actorUserId,
        });
        if (enrollmentFinalized && enrollment) {
          const updated = await client.query<{ id: string; enrolled_at: string; payment_status: string; wallet_hold_id: string | null }>(
            `update course_enrollments
             set price_minor = $2,
                 currency = $3,
                 payment_status = 'manual',
                 enrolled_at = now(),
                 wallet_hold_id = null,
                 charged_at = null,
                 released_at = null,
                 cancelled_at = null,
                 refunded_at = null,
                 refund_amount_minor = 0,
                 cancellation_reason = null,
                 metadata_jsonb = metadata_jsonb || $4::jsonb
             where id = $1
             returning id, enrolled_at, payment_status, wallet_hold_id`,
            [enrollment.id, course.rows[0].price_minor, course.rows[0].currency, enrollmentMetadata],
          );
          enrollment = updated.rows[0] ?? null;
        } else {
          const inserted = await client.query<{ id: string; enrolled_at: string }>(
            `insert into course_enrollments (cohort_id, student_id, price_minor, currency, payment_status, metadata_jsonb)
             values ($1, $2, $3, $4, 'manual', $5::jsonb)
             on conflict (cohort_id, student_id) do nothing
             returning id, enrolled_at`,
            [cohortId, application.student_id, course.rows[0].price_minor, course.rows[0].currency, enrollmentMetadata],
          );
          enrollment = inserted.rows[0] ?? null;
        }
      }
      if (enrollment && Number(course.rows[0].price_minor ?? 0) > 0) {
        const student = await client.query<{ user_id: string }>(`select user_id from students where id = $1`, [
          application.student_id,
        ]);
        const userId = student.rows[0]?.user_id;
        if (!userId) {
          await client.query("rollback");
          return c.json({ error: "student_profile_missing" }, 400);
        }
        const priceMinor = Number(course.rows[0].price_minor);
        try {
          await holdCourseEnrollmentPayment(
            {
              enrollmentId: enrollment.id,
              userId,
              studentId: application.student_id,
              courseId,
              cohortId,
              amountMinor: priceMinor,
              currency: course.rows[0].currency,
              source: "course_campaign_application",
            },
            client,
          );
        } catch (e) {
          if (e instanceof Error && e.message === "insufficient_balance") {
            await client.query("rollback");
            return c.json({ error: "insufficient_balance", neededMinor: priceMinor }, 409);
          }
          throw e;
        }
      }
    } else if (application.cohort_id) {
      const existing = await client.query<{ id: string }>(
        `select id from course_enrollments
         where cohort_id = $1
           and student_id = $2
           and metadata_jsonb->>'source' = 'course_campaign_application'
           and metadata_jsonb->>'applicationId' = $3
           and payment_status <> 'wallet_charged'`,
        [application.cohort_id, application.student_id, application.id],
      );
      for (const row of existing.rows) {
        await releaseCourseEnrollmentHold(row.id, client);
      }
      await client.query(
        `delete from course_enrollments
         where cohort_id = $1
           and student_id = $2
           and metadata_jsonb->>'source' = 'course_campaign_application'
           and metadata_jsonb->>'applicationId' = $3`,
        [application.cohort_id, application.student_id, application.id],
      );
    }

    await client.query("commit");
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  await notifyCourseStudentApplicationDecision(application);
  await writeAdminAudit({
    actorUserId,
    actorRole: c.get("userRole"),
    requestId: c.req.header("x-request-id") ?? null,
    action: "course.student_application.status",
    entityType: "course_student_application",
    entityId: applicationId,
    reason: "admin_student_application_decision",
    after: { ...application, enrollment },
  });
  return c.json({ application, enrollment });
});

const subPayQuery = z.object({
  state: z.enum(["pending", "paid", "failed", "cancelled", ""]).optional(),
  method: z.enum(["paytr_iframe", "bank_transfer", ""]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).max(10_000).optional(),
});

admin.get("/subscription-payments", requireAuth, async (c) => {
  const denied = await assertAdminFinanceScope(c);
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
  const denied = await assertAdminFinanceScope(c);
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

admin.get("/payment-reconciliation.csv", requireAuth, async (c) => {
  const denied = await assertAdminFinanceScope(c);
  if (denied) return denied;
  const limit = Math.min(5000, Math.max(1, Number(c.req.query("limit") ?? "1000") || 1000));
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
  args.push(limit);
  const rows = await pool.query(
    `select id, provider, merchant_oid, payment_table, payment_id,
            expected_amount_minor, received_amount_minor, status,
            resolution_status, resolution_kind, resolution_note,
            resolved_by_user_id, resolved_at, updated_at, created_at
     from payment_reconciliation_events
     where ${where}
     order by created_at desc
     limit $${args.length}`,
    args,
  );
  const header = [
    "id",
    "provider",
    "merchant_oid",
    "payment_table",
    "payment_id",
    "expected_amount_minor",
    "received_amount_minor",
    "status",
    "resolution_status",
    "resolution_kind",
    "resolution_note",
    "resolved_by_user_id",
    "resolved_at",
    "updated_at",
    "created_at",
  ];
  const body = rows.rows.map((row) => header.map((key) => (row as Record<string, unknown>)[key]));
  const csv = [csvLine(header), ...body.map(csvLine)].join("\n");
  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="payment-reconciliation-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
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
  const denied = await assertAdminFinanceScope(c);
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
  const denied = await assertAdminScope(c, ["full"]);
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
    if (newRole === "admin") {
      await client.query(
        `update users set admin_scope = 'full'::admin_scope, updated_at = now() where id = $1`,
        [userId],
      );
    }

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

const patchAccountStatusSchema = z.object({
  status: z.enum(["active", "suspended", "deletion_requested"]),
  reason: z.string().trim().min(3).max(2000).optional(),
});

admin.patch("/users/:userId/account-status", requireAuth, async (c) => {
  const denied = await assertAdminSupportScope(c);
  if (denied) return denied;

  const userId = c.req.param("userId")?.trim();
  if (!userId || !z.string().uuid().safeParse(userId).success) {
    return c.json({ error: "invalid_user_id" }, 400);
  }

  const parsed = patchAccountStatusSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  if (parsed.data.status === "suspended" && !parsed.data.reason?.trim()) {
    return c.json({ error: "suspension_reason_required" }, 400);
  }

  const actorId = c.get("userId");
  const client = await pool.connect();
  try {
    await client.query("begin");
    const before = await client.query(
      `select id, account_status::text as account_status, suspension_reason
       from users where id = $1 for update`,
      [userId],
    );
    const row = before.rows[0] as { id: string; account_status: string; suspension_reason: string | null } | undefined;
    if (!row) {
      await client.query("rollback");
      return c.json({ error: "user_not_found" }, 404);
    }

    if (parsed.data.status === "active") {
      await client.query(
        `update users
         set account_status = 'active',
             suspension_reason = null,
             suspended_at = null,
             suspended_by_admin_id = null,
             deletion_requested_at = null,
             deletion_reason = null,
             updated_at = now()
         where id = $1`,
        [userId],
      );
      await notifyUserInApp(
        userId,
        "Hesabınız yeniden aktif",
        "Hesap durumunuz güncellendi. Platformu normal şekilde kullanabilirsiniz.",
        { kind: "account_reactivated", href: "/panel" },
        client,
      );
    } else if (parsed.data.status === "suspended") {
      const reason = parsed.data.reason!.trim();
      await client.query(
        `update users
         set account_status = 'suspended',
             suspension_reason = $2,
             suspended_at = now(),
             suspended_by_admin_id = $3,
             updated_at = now()
         where id = $1`,
        [userId, reason, actorId],
      );
      await notifyUserInApp(
        userId,
        "Hesabınız geçici olarak askıya alındı",
        reason,
        { kind: "account_suspended", href: "/hesap-askida", reason },
        client,
      );
    } else {
      await client.query(
        `update users
         set account_status = 'deletion_requested',
             deletion_requested_at = coalesce(deletion_requested_at, now()),
             deletion_reason = coalesce($2, deletion_reason),
             updated_at = now()
         where id = $1`,
        [userId, parsed.data.reason ?? null],
      );
    }

    await writeAdminAudit(
      {
        actorUserId: actorId,
        action: "user.account_status",
        entityType: "user",
        entityId: userId,
        reason: parsed.data.reason ?? `status:${parsed.data.status}`,
        before: { account_status: row.account_status, suspension_reason: row.suspension_reason },
        after: { account_status: parsed.data.status, suspension_reason: parsed.data.reason ?? null },
      },
      client,
    );

    await client.query("commit");
    return c.json({ ok: true, userId, status: parsed.data.status });
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
});

const patchAdminScopeSchema = z.object({
  scope: z.enum(["full", "finance", "support"]),
});

admin.patch("/users/:userId/admin-scope", requireAuth, async (c) => {
  const denied = await assertAdminScope(c, ["full"]);
  if (denied) return denied;

  const userId = c.req.param("userId")?.trim();
  if (!userId || !z.string().uuid().safeParse(userId).success) {
    return c.json({ error: "invalid_user_id" }, 400);
  }

  const parsed = patchAdminScopeSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const actorId = c.get("userId");
  const nextScope = parsed.data.scope;
  const client = await pool.connect();
  try {
    await client.query("begin");
    const before = await client.query<{ id: string; role: string; admin_scope: string }>(
      `select id, role::text as role, admin_scope::text as admin_scope
       from users where id = $1 for update`,
      [userId],
    );
    const row = before.rows[0];
    if (!row) {
      await client.query("rollback");
      return c.json({ error: "user_not_found" }, 404);
    }
    if (row.role !== "admin") {
      await client.query("rollback");
      return c.json({ error: "admin_scope_requires_admin_role" }, 409);
    }

    if (row.admin_scope === "full" && nextScope !== "full") {
      const fullCount = await client.query<{ c: number }>(
        `select count(*)::int as c
         from users
         where role = 'admin'::user_role and admin_scope = 'full'::admin_scope and id <> $1`,
        [userId],
      );
      if ((fullCount.rows[0]?.c ?? 0) < 1) {
        await client.query("rollback");
        return c.json({ error: "cannot_remove_last_full_admin" }, 409);
      }
    }

    await client.query(
      `update users set admin_scope = $1::admin_scope, updated_at = now() where id = $2`,
      [nextScope, userId],
    );

    await writeAdminAudit(
      {
        actorUserId: actorId,
        actorRole: c.get("userRole"),
        requestId: c.req.header("x-request-id") ?? null,
        action: "user.admin_scope.update",
        entityType: "user",
        entityId: userId,
        reason: `scope:${nextScope}`,
        before: { admin_scope: row.admin_scope },
        after: { admin_scope: nextScope },
      },
      client,
    );

    await client.query("commit");
    return c.json({
      ok: true,
      userId,
      adminScope: nextScope,
      reloginRequired: actorId === userId,
    });
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
  const denied = await assertAdminSupportScope(c);
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
  const denied = await assertAdminSupportScope(c);
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
  const denied = await assertAdminSupportScope(c);
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
  const denied = await assertAdminSupportScope(c);
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
  const denied = await assertAdminSupportScope(c);
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
  const denied = await assertAdminSupportScope(c);
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
    const payload = {
      kind: "homework_quality_review",
      homeworkPostId: postId,
      qualityStatus: status,
      qualityScore: score,
    };
    const studentTitle =
      status === "accepted"
        ? "Soru çözümü kalite kontrolünden geçti"
        : status === "revision_requested"
          ? "Soru çözümü için revizyon istendi"
          : "Soru çözümü kalite incelemede";
    await notifyParentInApp(
      qualityRow.student_user_id,
      studentTitle,
      note ? `"${shortTopic}" için kalite notu: ${note}` : `"${shortTopic}" için kalite durumu güncellendi.`,
      payload,
      { studentId: qualityRow.student_id },
      client,
    );
    if (qualityRow.teacher_user_id) {
      await notifyParentInApp(
        qualityRow.teacher_user_id,
        status === "accepted" ? "Çözümünüz onaylandı" : "Çözümünüz kalite incelemesinden geçti",
        note ? `"${shortTopic}" için moderasyon notu: ${note}` : `"${shortTopic}" için kalite durumu güncellendi.`,
        payload,
        { studentId: qualityRow.student_id },
        client,
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

const lessonVideoModerationPatchSchema = z.object({
  moderationStatus: z.enum(["approved", "rejected", "flagged"]),
  moderationNote: z.string().max(1000).optional().nullable(),
});

admin.get("/lesson-videos", requireAuth, async (c) => {
  const denied = await assertAdminSupportScope(c);
  if (denied) return denied;

  const status = c.req.query("status")?.trim() || "pending_review";
  const allowed = ["pending_review", "approved", "rejected", "flagged", "all"];
  if (!allowed.includes(status)) return c.json({ error: "invalid_status" }, 400);

  const args: unknown[] = [];
  const where = ["v.status <> 'archived'"];
  if (status !== "all") {
    args.push(status);
    where.push(`v.moderation_status = $${args.length}`);
  }

  try {
    const r = await pool.query(
      `select v.id, v.title, v.grade_level, v.topic_title, v.outcome_code, v.video_url, v.video_kind,
              v.moderation_status, v.moderation_note, v.created_at,
              u.display_name as teacher_display_name, b.name as branch_name
       from teacher_lesson_videos v
       join teachers t on t.id = v.teacher_id
       join users u on u.id = t.user_id
       join branches b on b.id = v.branch_id
       where ${where.join(" and ")}
       order by v.created_at desc
       limit 80`,
      args,
    );
    return c.json({ videos: r.rows, status });
  } catch {
    return c.json({ videos: [], status, note: "lesson_video_moderation_not_available" });
  }
});

admin.patch("/lesson-videos/:videoId/moderation", requireAuth, async (c) => {
  const denied = await assertAdminSupportScope(c);
  if (denied) return denied;

  const videoId = c.req.param("videoId");
  if (!z.string().uuid().safeParse(videoId).success) return c.json({ error: "invalid_video_id" }, 400);

  const parsed = lessonVideoModerationPatchSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const actorUserId = c.get("userId");
  const note =
    parsed.data.moderationStatus === "rejected" && !parsed.data.moderationNote?.trim()
      ? null
      : parsed.data.moderationNote?.trim() ?? null;

  if (parsed.data.moderationStatus === "rejected" && !note) {
    return c.json({ error: "moderation_note_required_for_reject" }, 400);
  }

  try {
    const r = await pool.query(
      `update teacher_lesson_videos
       set moderation_status = $2,
           moderation_note = $3,
           moderated_at = now(),
           moderated_by_user_id = $4,
           updated_at = now()
       where id = $1 and status <> 'archived'
       returning id, title, grade_level, branch_id, moderation_status`,
      [videoId, parsed.data.moderationStatus, note, actorUserId],
    );
    if (!r.rowCount) return c.json({ error: "not_found" }, 404);

    const video = r.rows[0] as {
      id: string;
      title: string;
      grade_level: number;
      branch_id: number;
      moderation_status: string;
    };

    if (parsed.data.moderationStatus === "approved") {
      const branch = await pool.query<{ name: string }>(`select name from branches where id = $1`, [
        video.branch_id,
      ]);
      const branchName = branch.rows[0]?.name ?? "Ders";
      await notifyLessonVideoPublishedToGradeStudents({
        id: video.id,
        title: video.title,
        gradeLevel: video.grade_level,
        branchId: video.branch_id,
        branchName,
      });
    }

    return c.json({ video: r.rows[0] });
  } catch {
    return c.json({ error: "lesson_video_moderation_not_available" }, 503);
  }
});

registerAdminExtendedRoutes(admin);
