import { randomBytes } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import { pool } from "../db.js";
import type { AppVariables } from "../types.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { ensureUserWalletRow } from "../lib/studentSub.js";
import { applyWalletDelta } from "../lib/wallet.js";

export const userWallet = new Hono<{ Variables: AppVariables }>();

const topupSchema = z.object({
  amountMinor: z.number().int().min(10_000).max(10_000_000_000), // min 100 TL
});

const adminGrantSchema = z.object({
  userId: z.string().uuid(),
  amountMinor: z.number().int().min(1).max(10_000_000_000),
  reason: z.string().min(3).max(200).optional(),
});

userWallet.get("/me", requireAuth, async (c) => {
  const userId = c.get("userId");
  await ensureUserWalletRow(userId);
  const w = await pool.query(
    `select balance_minor, currency, updated_at from user_wallets where user_id = $1`,
    [userId],
  );
  const b = w.rows[0] as { balance_minor: string; currency: string; updated_at: Date } | undefined;
  return c.json({
    balanceMinor: b ? Number(b.balance_minor) : 0,
    currency: b?.currency ?? "TRY",
    updatedAt: b?.updated_at ?? null,
  });
});

/** Admin: test/ops için cüzdana bakiye ekle (wallet-only MVP destek) */
userWallet.post("/admin/grant", requireAuth, async (c) => {
  const role = c.get("userRole");
  if (role !== "admin") return c.json({ error: "forbidden_admin_only" }, 403);
  const parsed = adminGrantSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  await applyWalletDelta({
    userId: parsed.data.userId,
    deltaMinor: parsed.data.amountMinor,
    kind: "wallet_admin_grant",
    refType: "admin",
    refId: null,
    metadata: { reason: parsed.data.reason ?? "grant" },
  });
  return c.json({ ok: true }, 200);
});

/** PayTR ile cüzdan yükleme — callback WLT- */
userWallet.post("/topup", requireAuth, async (c) => {
  const userId = c.get("userId");
  const parsed = topupSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const amount = parsed.data.amountMinor;
  const merchantOid = `WLT-${Date.now()}-${randomBytes(5).toString("hex")}`;

  const pay = await pool.query(
    `insert into wallet_topup_payments (
       user_id, amount_minor, currency, method, state, merchant_oid
     ) values ($1, $2, 'TRY', 'paytr_iframe', 'pending', $3)
     returning id, amount_minor, merchant_oid`,
    [userId, amount, merchantOid],
  );

  return c.json(
    {
      payment: pay.rows[0],
      next: { checkout: `/v1/paytr/wallet-topup-checkout?paymentId=${pay.rows[0].id}` },
    },
    201,
  );
});

userWallet.get("/ledger", requireAuth, async (c) => {
  const userId = c.get("userId");
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? "30") || 30));
  await ensureUserWalletRow(userId);
  const r = await pool.query(
    `select id, delta_minor, balance_after, kind, ref_type, ref_id, created_at, metadata_jsonb
     from user_wallet_ledger
     where user_id = $1
     order by id desc
     limit $2`,
    [userId, limit],
  );
  return c.json({ entries: r.rows });
});

userWallet.get("/holds", requireAuth, async (c) => {
  const userId = c.get("userId");
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? "50") || 50));
  await ensureUserWalletRow(userId);
  const h = await pool.query(
    `select id, amount_minor, currency, status, reason, ref_type, ref_id, created_at, updated_at
     from user_wallet_holds
     where user_id = $1
     order by created_at desc
     limit $2`,
    [userId, limit],
  );
  const s = await pool.query(
    `select coalesce(sum(amount_minor), 0)::bigint as active_sum
     from user_wallet_holds
     where user_id = $1 and status = 'active'`,
    [userId],
  );
  return c.json({
    holds: h.rows,
    activeHoldMinor: Number(s.rows[0]?.active_sum ?? 0),
  });
});
