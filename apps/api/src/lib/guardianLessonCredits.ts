import type { Pool, PoolClient } from "pg";
import { pool } from "../db.js";
import { getWalletAvailableMinor } from "./walletHolds.js";
import { applyWalletDelta } from "./wallet.js";

type Db = Pool | PoolClient;

function currentPeriodMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export async function allocateGuardianLessonCredits(
  input: {
    guardianUserId: string;
    studentId: string;
    monthlyCredits: number;
    perLessonBudgetMinor: number;
  },
  client: Db = pool,
): Promise<{ poolId: string; creditsRemaining: number }> {
  const periodMonth = currentPeriodMonth();
  const totalBudget = input.monthlyCredits * input.perLessonBudgetMinor;
  const available = await getWalletAvailableMinor(input.guardianUserId, client as PoolClient);
  if (available < BigInt(totalBudget)) {
    throw Object.assign(new Error("insufficient_wallet_available"), { code: "insufficient_wallet_available" });
  }

  const link = await client.query(`select 1 from student_guardians where guardian_user_id = $1 and student_id = $2`, [
    input.guardianUserId,
    input.studentId,
  ]);
  if (!link.rowCount) throw Object.assign(new Error("guardian_not_linked"), { code: "guardian_not_linked" });

  const existing = await client.query<{ id: string }>(
    `select id from guardian_lesson_credit_pools
     where guardian_user_id = $1 and student_id = $2 and period_month = $3::date`,
    [input.guardianUserId, input.studentId, periodMonth],
  );

  if (existing.rowCount) {
    await client.query(
      `update guardian_lesson_credit_pools
       set monthly_lesson_credits = $2,
           credits_remaining = $2,
           per_lesson_budget_minor = $3,
           status = 'active',
           updated_at = now()
       where id = $1`,
      [existing.rows[0].id, input.monthlyCredits, input.perLessonBudgetMinor],
    );
    return { poolId: existing.rows[0].id, creditsRemaining: input.monthlyCredits };
  }

  const ins = await client.query<{ id: string }>(
    `insert into guardian_lesson_credit_pools (
       guardian_user_id, student_id, period_month,
       monthly_lesson_credits, credits_remaining, per_lesson_budget_minor, status
     ) values ($1, $2, $3::date, $4, $4, $5, 'active')
     returning id`,
    [input.guardianUserId, input.studentId, periodMonth, input.monthlyCredits, input.perLessonBudgetMinor],
  );
  return { poolId: ins.rows[0].id, creditsRemaining: input.monthlyCredits };
}

export async function consumeGuardianLessonCredit(
  input: { guardianUserId: string; studentId: string; lessonRefType: string; lessonRefId: string },
  client: Db = pool,
): Promise<{ poolId: string; budgetMinor: number } | null> {
  const periodMonth = currentPeriodMonth();
  const r = await client.query<{
    id: string;
    credits_remaining: number;
    per_lesson_budget_minor: number;
  }>(
    `select id, credits_remaining, per_lesson_budget_minor
     from guardian_lesson_credit_pools
     where guardian_user_id = $1 and student_id = $2 and period_month = $3::date and status = 'active'
     for update`,
    [input.guardianUserId, input.studentId, periodMonth],
  );
  const row = r.rows[0];
  if (!row || row.credits_remaining < 1) return null;

  const budget = row.per_lesson_budget_minor;
  await applyWalletDelta({
    userId: input.guardianUserId,
    deltaMinor: -budget,
    kind: "guardian_lesson_credit_spend",
    refType: input.lessonRefType,
    refId: input.lessonRefId,
    client: client as PoolClient,
    metadata: { poolId: row.id },
  });

  await client.query(
    `update guardian_lesson_credit_pools
     set credits_remaining = credits_remaining - 1,
         status = case when credits_remaining - 1 <= 0 then 'exhausted' else status end,
         updated_at = now()
     where id = $1`,
    [row.id],
  );

  return { poolId: row.id, budgetMinor: budget };
}
