import type { Pool, PoolClient } from "pg";
import { pool } from "../db.js";

const PRICE_PER_MONTH_MINOR = Number(process.env.STUDENT_SUB_PRICE_MINOR ?? "100000");

/** 1000 TL/ay = 100_000 kuruş (ayar: STUDENT_SUB_PRICE_MINOR) */
export function getStudentSubPriceConfig(): { pricePerMonthMinor: number } {
  return { pricePerMonthMinor: PRICE_PER_MONTH_MINOR };
}

export async function getActiveStudentSubscription(
  userId: string,
): Promise<{ id: string; expires_at: Date; months_count: number } | null> {
  const r = await pool.query(
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
