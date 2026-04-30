import type { Pool, PoolClient } from "pg";

export function homeworkResolveMinutes(): number {
  const n = Number(process.env.HOMEWORK_CLAIM_RESOLVE_MINUTES ?? "20");
  if (!Number.isFinite(n) || n < 1 || n > 24 * 60) return 20;
  return Math.floor(n);
}

export function homeworkSatisfactionRewardMinor(): number {
  const n = Number(process.env.HOMEWORK_SATISFACTION_REWARD_MINOR ?? "500");
  if (!Number.isFinite(n) || n < 1 || n > 1_000_000) return 500;
  return Math.floor(n);
}

/** Süresi dolmuş üstlenmeleri havuza iade eder (answered değilse). */
export async function releaseExpiredHomeworkClaims(db: Pool | PoolClient): Promise<number> {
  const r = await db.query(
    `update student_homework_posts
     set status = 'open',
         claimed_by_teacher_id = null,
         claimed_at = null,
         resolve_deadline_at = null,
         updated_at = now()
     where status = 'claimed'
       and resolve_deadline_at is not null
       and resolve_deadline_at < now()
       and answered_at is null
     returning id`,
  );
  return r.rowCount ?? 0;
}
