import type { PoolClient } from "pg";
import { pool } from "../db.js";
import { ensureUserWalletRow } from "./studentSub.js";

function feeBps(): number {
  const n = Number(process.env.DIRECT_LESSON_FEE_BPS ?? "0");
  if (!Number.isFinite(n) || n < 0 || n > 10_000) return 0;
  return Math.floor(n);
}

/** Brüt tutardan öğretmen payı (kuruş) */
export function teacherPayoutFromGross(grossMinor: number): { payout: number; fee: number } {
  const bps = feeBps();
  if (grossMinor <= 0) return { payout: 0, fee: 0 };
  const fee = Math.floor((grossMinor * bps) / 10_000);
  return { payout: grossMinor - fee, fee };
}

type ApplyOpts = {
  userId: string;
  deltaMinor: number;
  kind: string;
  refType?: string | null;
  refId?: string | null;
  metadata?: Record<string, unknown>;
  client?: PoolClient;
};

export async function applyWalletDelta(opts: ApplyOpts): Promise<{ balanceAfter: bigint }> {
  const { userId, kind, refType, refId, metadata } = opts;
  const deltaMinor = BigInt(Math.trunc(opts.deltaMinor));
  const run = async (c: PoolClient) => {
    await ensureUserWalletRow(userId, c);
    const l = await c.query(
      `update user_wallets
       set balance_minor = balance_minor + $2::bigint,
           updated_at = now()
       where user_id = $1
       returning balance_minor`,
      [userId, deltaMinor.toString()],
    );
    if (!l.rowCount) throw new Error("wallet_update_failed");
    const after = l.rows[0].balance_minor as string | number | bigint;
    const afterB = BigInt(after);
    if (afterB < 0n) throw new Error("insufficient_balance");
    await c.query(
      `insert into user_wallet_ledger (
         user_id, delta_minor, balance_after, kind, ref_type, ref_id, metadata_jsonb
       ) values ($1, $2::bigint, $3::bigint, $4, $5, $6, $7::jsonb)`,
      [
        userId,
        deltaMinor.toString(),
        afterB.toString(),
        kind,
        refType ?? null,
        refId ?? null,
        JSON.stringify(metadata ?? {}),
      ],
    );
    return { balanceAfter: afterB };
  };
  if (opts.client) {
    return run(opts.client);
  }
  const c = await pool.connect();
  try {
    await c.query("begin");
    const r = await run(c);
    await c.query("commit");
    return r;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
