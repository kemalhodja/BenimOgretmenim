import type { PoolClient } from "pg";
import { pool } from "../db.js";
import { ensureUserWalletRow } from "./studentSub.js";

export async function getWalletAvailableMinor(
  userId: string,
  client?: PoolClient,
): Promise<bigint> {
  const run = async (c: PoolClient) => {
    await ensureUserWalletRow(userId, c);
    const w = await c.query(
      `select balance_minor from user_wallets where user_id = $1`,
      [userId],
    );
    const balance = BigInt(w.rows[0]?.balance_minor ?? "0");
    const h = await c.query(
      `select coalesce(sum(amount_minor), 0)::bigint as s
       from user_wallet_holds
       where user_id = $1 and status = 'active'`,
      [userId],
    );
    const holds = BigInt(h.rows[0]?.s ?? "0");
    const available = balance - holds;
    return available < 0n ? 0n : available;
  };
  if (client) return run(client);
  const c = await pool.connect();
  try {
    return await run(c);
  } finally {
    c.release();
  }
}

export async function createWalletHold(
  opts: {
    userId: string;
    amountMinor: number;
    reason: string;
    refType?: string | null;
    refId?: string | null;
  },
  client: PoolClient,
): Promise<{ holdId: string }> {
  const amount = BigInt(Math.trunc(opts.amountMinor));
  if (amount <= 0n) throw new Error("hold_amount_invalid");
  await ensureUserWalletRow(opts.userId, client);
  const r = await client.query(
    `insert into user_wallet_holds (user_id, amount_minor, reason, ref_type, ref_id)
     values ($1, $2::bigint, $3, $4, $5)
     returning id`,
    [
      opts.userId,
      amount.toString(),
      opts.reason,
      opts.refType ?? null,
      opts.refId ?? null,
    ],
  );
  return { holdId: r.rows[0].id as string };
}

export async function releaseWalletHold(
  opts: { holdId: string },
  client: PoolClient,
): Promise<void> {
  await client.query(
    `update user_wallet_holds
     set status = 'released', updated_at = now()
     where id = $1 and status = 'active'`,
    [opts.holdId],
  );
}

export async function chargeWalletHold(
  opts: { holdId: string },
  client: PoolClient,
): Promise<void> {
  await client.query(
    `update user_wallet_holds
     set status = 'charged', updated_at = now()
     where id = $1 and status = 'active'`,
    [opts.holdId],
  );
}

export async function reduceWalletHoldAmount(
  opts: { holdId: string; newAmountMinor: bigint },
  client: PoolClient,
): Promise<void> {
  if (opts.newAmountMinor < 0n) throw new Error("hold_amount_invalid");
  if (opts.newAmountMinor === 0n) {
    await client.query(
      `update user_wallet_holds
       set amount_minor = 0, status = 'charged', updated_at = now()
       where id = $1 and status = 'active'`,
      [opts.holdId],
    );
    return;
  }
  await client.query(
    `update user_wallet_holds
     set amount_minor = $2::bigint, updated_at = now()
     where id = $1 and status = 'active'`,
    [opts.holdId, opts.newAmountMinor.toString()],
  );
}

