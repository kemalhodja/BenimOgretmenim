import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { pool } from "../db.js";
import type { AppVariables } from "../types.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { applyWalletDelta } from "../lib/wallet.js";
import { getWalletAvailableMinor } from "../lib/walletHolds.js";

export const subscriptions = new Hono<{ Variables: AppVariables }>();

type Ctx = Context<{ Variables: AppVariables }>;

/** Üretimde ADMIN_API_SECRET tanımlıysa admin uçları ek başlık ister (tarayıcıda Next proxy kullanın). */
function assertAdminApiSecret(c: Ctx): Response | undefined {
  const want = process.env.ADMIN_API_SECRET?.trim();
  if (!want) return undefined;
  const got = c.req.header("x-admin-secret")?.trim();
  if (got !== want) {
    return c.json({ error: "forbidden_admin_secret" }, 403);
  }
  return undefined;
}

subscriptions.get("/plans", async (c) => {
  const r = await pool.query(
    `select code, title, duration_months, price_minor, currency, entitlements_jsonb
     from subscription_plans
     where is_active = true
     order by duration_months asc`,
  );
  return c.json({ plans: r.rows });
});

subscriptions.get("/me", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "teacher") {
    return c.json({ error: "forbidden_teachers_only" }, 403);
  }

  const tr = await pool.query(`select id from teachers where user_id = $1`, [
    userId,
  ]);
  if (!tr.rowCount) return c.json({ error: "teacher_profile_missing" }, 400);
  const teacherId = tr.rows[0].id as string;

  const r = await pool.query(
    `select s.id, s.plan_code, s.status, s.started_at, s.expires_at, s.promo_multiplier,
            p.title, p.duration_months, p.price_minor, p.currency, p.entitlements_jsonb
     from teacher_subscriptions s
     join subscription_plans p on p.code = s.plan_code
     where s.teacher_id = $1
     order by s.expires_at desc
     limit 1`,
    [teacherId],
  );

  const row = r.rows[0] as Record<string, unknown> | undefined;
  const active =
    !!row && row.status === "active" && (row.expires_at as Date) > new Date();

  return c.json({ subscription: row ?? null, active });
});

const purchaseFromWalletSchema = z.object({
  planCode: z.enum(["teacher_6m", "teacher_12m"]),
});

/** Öğretmen aboneliği: cüzdandan satın al (wallet-only MVP) */
subscriptions.post("/purchase-from-wallet", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "teacher") {
    return c.json({ error: "forbidden_teachers_only" }, 403);
  }

  const parsed = purchaseFromWalletSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const tr = await pool.query(`select id from teachers where user_id = $1`, [userId]);
  if (!tr.rowCount) return c.json({ error: "teacher_profile_missing" }, 400);
  const teacherId = tr.rows[0].id as string;

  const promoMultiplier = Number(process.env.SUB_PROMO_MULTIPLIER ?? "3");

  const plan = await pool.query(
    `select code, duration_months, price_minor, currency
     from subscription_plans
     where code = $1 and is_active = true`,
    [parsed.data.planCode],
  );
  if (!plan.rowCount) return c.json({ error: "plan_not_found" }, 404);
  const p = plan.rows[0] as {
    code: string;
    duration_months: number;
    price_minor: number;
    currency: string;
  };
  if (p.currency !== "TRY") return c.json({ error: "currency_not_supported" }, 409);
  if (!Number.isFinite(p.price_minor) || p.price_minor <= 0) return c.json({ error: "plan_price_invalid" }, 409);

  const totalMonths = p.duration_months * Math.max(1, promoMultiplier);

  const client = await pool.connect();
  try {
    await client.query("begin");

    const available = await getWalletAvailableMinor(userId, client);
    if (available < BigInt(p.price_minor)) {
      await client.query("rollback");
      return c.json({ error: "insufficient_balance", neededMinor: p.price_minor }, 409);
    }

    await applyWalletDelta({
      userId,
      deltaMinor: -p.price_minor,
      kind: "teacher_subscription_purchase",
      refType: "subscription_plan",
      refId: p.code,
      metadata: {
        planCode: p.code,
        durationMonths: p.duration_months,
        promoMultiplier: Math.max(1, promoMultiplier),
        totalMonths,
      },
      client,
    });

    const sub = await client.query(
      `insert into teacher_subscriptions (
         teacher_id, plan_code, status, started_at, expires_at,
         promo_multiplier, paid_amount_minor, currency, payment_provider, external_ref
       ) values (
         $1, $2::subscription_plan_code, 'active', now(),
         now() + ($3::text || ' months')::interval,
         $4, $5, $6, 'wallet', $7
       )
       returning id, plan_code, status, started_at, expires_at, promo_multiplier`,
      [
        teacherId,
        p.code,
        String(totalMonths),
        Math.max(1, promoMultiplier),
        p.price_minor,
        p.currency,
        `wallet-${Date.now()}`,
      ],
    );

    await client.query("commit");
    return c.json({ ok: true, subscription: sub.rows[0] }, 201);
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
});

const purchaseSchema = z.object({
  planCode: z.enum(["teacher_6m", "teacher_12m"]),
  method: z.enum(["paytr_iframe", "bank_transfer"]).optional(),
  bankRef: z.string().max(120).optional(),
});

/** Öğretmen aboneliği: havale → admin onayı; PayTR → ödeme + callback ile aktif */
subscriptions.post("/purchase", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "teacher") {
    return c.json({ error: "forbidden_teachers_only" }, 403);
  }

  const parsed = purchaseSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const tr = await pool.query(`select id from teachers where user_id = $1`, [
    userId,
  ]);
  if (!tr.rowCount) return c.json({ error: "teacher_profile_missing" }, 400);
  const teacherId = tr.rows[0].id as string;

  const promoMultiplier = Number(process.env.SUB_PROMO_MULTIPLIER ?? "3");

  const plan = await pool.query(
    `select code, duration_months, price_minor, currency
     from subscription_plans
     where code = $1 and is_active = true`,
    [parsed.data.planCode],
  );
  if (!plan.rowCount) return c.json({ error: "plan_not_found" }, 404);

  const p = plan.rows[0] as {
    code: string;
    duration_months: number;
    price_minor: number;
    currency: string;
  };

  const method = parsed.data.method ?? "paytr_iframe";

  // Bank transfer: ödeme kaydı aç, admin onayı bekle
  if (method === "bank_transfer") {
    const pay = await pool.query(
      `insert into subscription_payments (
         teacher_id, plan_code, method, state, amount_minor, currency, bank_ref
       ) values ($1, $2::subscription_plan_code, 'bank_transfer', 'pending', $3, $4, $5)
       returning id, state, amount_minor, currency`,
      [teacherId, p.code, p.price_minor, p.currency, parsed.data.bankRef ?? null],
    );

    const iban = process.env.BANK_IBAN ?? "";
    const acct = process.env.BANK_ACCOUNT_NAME ?? "BenimÖğretmenim";
    const desc = process.env.BANK_TRANSFER_DESCRIPTION_PREFIX ?? "BO-SUB";

    return c.json(
      {
        payment: pay.rows[0],
        instructions: {
          accountName: acct,
          iban,
          description: `${desc}-${pay.rows[0].id}`,
          amountTry: (p.price_minor / 100).toFixed(2),
          note: "Havale/EFT sonrası dekont numarasını bankRef olarak iletebilirsiniz. Onay sonrası abonelik aktif edilir.",
        },
      },
      201,
    );
  }

  // PayTR iFrame: burada sadece ödeme kaydı açıyoruz; token üretimi ayrı endpoint (/paytr/checkout)
  const pay = await pool.query(
    `insert into subscription_payments (
       teacher_id, plan_code, method, state, amount_minor, currency, merchant_oid
     ) values ($1, $2::subscription_plan_code, 'paytr_iframe', 'pending', $3, $4, $5)
     returning id, merchant_oid`,
    [
      teacherId,
      p.code,
      p.price_minor,
      p.currency,
      `SUB-${teacherId.slice(0, 8)}-${Date.now()}`,
    ],
  );

  return c.json(
    {
      payment: pay.rows[0],
      next: {
        checkout: `/v1/paytr/checkout?paymentId=${pay.rows[0].id}`,
      },
    },
    201,
  );
});

const approveSchema = z.object({
  paymentId: z.string().uuid(),
});

/** Admin: bekleyen havale/EFT ödemeleri */
subscriptions.get("/admin/pending-bank-transfers", requireAuth, async (c) => {
  const role = c.get("userRole");
  if (role !== "admin") {
    return c.json({ error: "forbidden_admin_only" }, 403);
  }

  const secErr = assertAdminApiSecret(c);
  if (secErr) return secErr;

  const r = await pool.query(
    `select sp.id,
            sp.teacher_id,
            sp.plan_code,
            sp.amount_minor,
            sp.currency,
            sp.bank_ref,
            sp.created_at,
            u.display_name as teacher_display_name,
            u.email as teacher_email
     from subscription_payments sp
     join teachers t on t.id = sp.teacher_id
     join users u on u.id = t.user_id
     where sp.method = 'bank_transfer'
       and sp.state = 'pending'
     order by sp.created_at asc`,
  );
  return c.json({ payments: r.rows });
});

/** Admin: havale ödemesini onayla → aboneliği aktif et */
subscriptions.post("/admin/approve-bank-transfer", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "admin") {
    return c.json({ error: "forbidden_admin_only" }, 403);
  }

  const secErr = assertAdminApiSecret(c);
  if (secErr) return secErr;

  const parsed = approveSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const pay = await pool.query(
    `select id, teacher_id, plan_code, state, amount_minor, currency
     from subscription_payments
     where id = $1 and method = 'bank_transfer'`,
    [parsed.data.paymentId],
  );
  if (!pay.rowCount) return c.json({ error: "payment_not_found" }, 404);
  const p = pay.rows[0] as {
    id: string;
    teacher_id: string;
    plan_code: string;
    state: string;
    amount_minor: number;
    currency: string;
  };
  if (p.state !== "pending") return c.json({ error: "payment_not_pending" }, 409);

  const promoMultiplier = Number(process.env.SUB_PROMO_MULTIPLIER ?? "3");
  const plan = await pool.query(
    `select duration_months from subscription_plans where code = $1`,
    [p.plan_code],
  );
  const months = (plan.rows[0]?.duration_months as number | undefined) ?? 0;
  if (!months) return c.json({ error: "plan_not_found" }, 404);
  const totalMonths = months * Math.max(1, promoMultiplier);

  const client = await pool.connect();
  try {
    await client.query("begin");

    await client.query(
      `update subscription_payments
       set state = 'paid', approved_by_user_id = $2, approved_at = now(), updated_at = now()
       where id = $1 and state = 'pending'`,
      [p.id, userId],
    );

    const sub = await client.query(
      `insert into teacher_subscriptions (
         teacher_id, plan_code, status, started_at, expires_at,
         promo_multiplier, paid_amount_minor, currency, payment_provider, external_ref, payment_id
       ) values (
         $1, $2::subscription_plan_code, 'active', now(),
         now() + ($3::text || ' months')::interval,
         $4, $5, $6, 'bank_transfer', $7, $8
       )
       returning id`,
      [
        p.teacher_id,
        p.plan_code,
        String(totalMonths),
        promoMultiplier,
        p.amount_minor,
        p.currency,
        `BANK-${p.id}`,
        p.id,
      ],
    );

    await client.query("commit");
    return c.json({ ok: true, subscriptionId: sub.rows[0].id });
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
});

