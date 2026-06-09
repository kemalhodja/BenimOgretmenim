import type { Pool, PoolClient } from "pg";
import { pool } from "../db.js";

const ANNUAL_MONTHS = Number(process.env.STUDENT_SUB_ANNUAL_MONTHS ?? "12");
const ANNUAL_PRICE_MINOR = Number(process.env.STUDENT_SUB_ANNUAL_PRICE_MINOR ?? "150000");
const PRICE_PER_MONTH_MINOR = Math.round(ANNUAL_PRICE_MINOR / Math.max(1, ANNUAL_MONTHS));

export type StudentUsagePolicy = {
  tier: "free" | "annual";
  dailyLessonRequestLimit: number;
  dailyHomeworkPostLimit: number;
};

export type StudentUsageSnapshot = {
  lessonRequestsToday: number;
  homeworkPostsToday: number;
  lessonRequestsRemaining: number;
  homeworkPostsRemaining: number;
  extraLessonRequestCredits: number;
  extraHomeworkCredits: number;
};

/** Annual student subscription: default 12 months / 1500 TL. */
export function getStudentSubPriceConfig(): {
  annualMonths: number;
  annualPriceMinor: number;
  pricePerMonthMinor: number;
} {
  return {
    annualMonths: ANNUAL_MONTHS,
    annualPriceMinor: ANNUAL_PRICE_MINOR,
    pricePerMonthMinor: PRICE_PER_MONTH_MINOR,
  };
}

export async function getActiveStudentSubscription(
  userId: string,
  client: Pick<Pool, "query"> | PoolClient = pool,
): Promise<{ id: string; expires_at: Date; months_count: number } | null> {
  const r = await client.query(
    `select id, expires_at, months_count
     from student_subscriptions
     where user_id = $1
       and lifecycle = 'active'
       and expires_at is not null
       and expires_at > now()
     order by expires_at desc
     limit 1`,
    [userId],
  );
  if (!r.rowCount) return null;
  const x = r.rows[0] as { id: string; expires_at: Date; months_count: number };
  return x;
}

export async function lockStudentDailyUsage(
  studentId: string,
  client: PoolClient,
): Promise<void> {
  await client.query(
    `select pg_advisory_xact_lock(hashtext($1), hashtext($2))`,
    ["student_daily_usage", studentId],
  );
}

async function availableStudentExtraCredits(
  userId: string,
  creditType: "student_homework" | "student_lesson_request",
  client: Pick<Pool, "query"> | PoolClient,
): Promise<number> {
  const r = await client.query<{ remaining: string }>(
    `select coalesce(sum(quantity - used_count), 0)::text as remaining
     from user_usage_credits
     where user_id = $1
       and credit_type = $2
       and used_count < quantity
       and valid_from <= now()
       and (valid_until is null or valid_until > now())`,
    [userId, creditType],
  );
  return Number(r.rows[0]?.remaining ?? 0);
}

export function studentUsagePolicyForSubscription(
  sub: { months_count: number } | null,
): StudentUsagePolicy {
  const annual = !!sub && Number(sub.months_count) >= ANNUAL_MONTHS;
  if (annual) {
    return {
      tier: "annual",
      dailyLessonRequestLimit: 5,
      dailyHomeworkPostLimit: 10,
    };
  }
  return {
    tier: "free",
    dailyLessonRequestLimit: 1,
    dailyHomeworkPostLimit: 5,
  };
}

export async function getStudentDailyUsage(
  studentId: string,
  policy: StudentUsagePolicy,
  client: Pick<Pool, "query"> | PoolClient = pool,
  userId?: string,
): Promise<StudentUsageSnapshot> {
  const [requests, homework] = await Promise.all([
    client.query<{ c: number }>(
      `select count(*)::int as c
       from lesson_requests
       where student_id = $1
         and request_kind <> 'demo'
         and created_at >= (date_trunc('day', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul')`,
      [studentId],
    ),
    client.query<{ c: number }>(
      `select count(*)::int as c
       from student_homework_posts
       where student_id = $1
         and created_at >= (date_trunc('day', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul')`,
      [studentId],
    ),
  ]);
  const lessonRequestsToday = Number(requests.rows[0]?.c ?? 0);
  const homeworkPostsToday = Number(homework.rows[0]?.c ?? 0);
  const [extraLessonRequestCredits, extraHomeworkCredits] = userId
    ? await Promise.all([
        availableStudentExtraCredits(userId, "student_lesson_request", client),
        availableStudentExtraCredits(userId, "student_homework", client),
      ])
    : [0, 0];
  return {
    lessonRequestsToday,
    homeworkPostsToday,
    lessonRequestsRemaining:
      lessonRequestsToday < policy.dailyLessonRequestLimit
        ? policy.dailyLessonRequestLimit - lessonRequestsToday + extraLessonRequestCredits
        : extraLessonRequestCredits,
    homeworkPostsRemaining:
      homeworkPostsToday < policy.dailyHomeworkPostLimit
        ? policy.dailyHomeworkPostLimit - homeworkPostsToday + extraHomeworkCredits
        : extraHomeworkCredits,
    extraLessonRequestCredits,
    extraHomeworkCredits,
  };
}

export async function ensureUserWalletRow(
  userId: string,
  client: Pick<Pool, "query"> | PoolClient = pool,
): Promise<void> {
  await client.query(
    `insert into user_wallets (user_id) values ($1)
     on conflict (user_id) do nothing`,
    [userId],
  );
}
