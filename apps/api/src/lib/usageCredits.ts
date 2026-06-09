import type { PoolClient } from "pg";
import { pool } from "../db.js";
import { applyWalletDelta } from "./wallet.js";
import { getWalletAvailableMinor } from "./walletHolds.js";

export type UsageCreditType =
  | "student_homework"
  | "student_lesson_request"
  | "teacher_campaign_conversation";

type Queryable = Pick<PoolClient, "query">;

type PackCredit = {
  type?: unknown;
  quantity?: unknown;
  validDays?: unknown;
};

export type UsageCreditPack = {
  code: string;
  audience_role: "student" | "teacher";
  title: string;
  description: string;
  price_minor: number;
  currency: string;
  credits_jsonb: PackCredit[];
};

function normalizeCreditType(value: unknown): UsageCreditType | null {
  if (
    value === "student_homework" ||
    value === "student_lesson_request" ||
    value === "teacher_campaign_conversation"
  ) {
    return value;
  }
  return null;
}

export async function listUsageCreditPacks(
  audienceRole: "student" | "teacher",
  client: Queryable = pool,
): Promise<UsageCreditPack[]> {
  const r = await client.query<UsageCreditPack>(
    `select code, audience_role, title, description, price_minor, currency, credits_jsonb
     from usage_credit_packs
     where audience_role = $1
       and is_active = true
     order by sort_order asc, price_minor asc`,
    [audienceRole],
  );
  return r.rows;
}

export async function availableUsageCredits(
  userId: string,
  creditType: UsageCreditType,
  client: Queryable = pool,
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

export async function consumeUsageCredit(
  userId: string,
  creditType: UsageCreditType,
  client: PoolClient,
): Promise<boolean> {
  const r = await client.query(
    `with selected as (
       select id
       from user_usage_credits
       where user_id = $1
         and credit_type = $2
         and used_count < quantity
         and valid_from <= now()
         and (valid_until is null or valid_until > now())
       order by valid_until asc nulls last, created_at asc
       for update skip locked
       limit 1
     )
     update user_usage_credits c
     set used_count = used_count + 1
     from selected
     where c.id = selected.id
     returning c.id`,
    [userId, creditType],
  );
  return !!r.rowCount;
}

export async function purchaseUsageCreditPackFromWallet(opts: {
  userId: string;
  audienceRole: "student" | "teacher";
  packCode: string;
  client: PoolClient;
}): Promise<{ payment: { id: string; pack_code: string; amount_minor: number; currency: string } }> {
  const { userId, audienceRole, packCode, client } = opts;
  const packRes = await client.query<UsageCreditPack>(
    `select code, audience_role, title, description, price_minor, currency, credits_jsonb
     from usage_credit_packs
     where code = $1
       and audience_role = $2
       and is_active = true
     for update`,
    [packCode, audienceRole],
  );
  const pack = packRes.rows[0];
  if (!pack) throw new Error("usage_credit_pack_not_found");
  if (pack.currency !== "TRY") throw new Error("currency_not_supported");

  const available = await getWalletAvailableMinor(userId, client);
  if (available < BigInt(pack.price_minor)) {
    const err = new Error("insufficient_balance");
    (err as Error & { neededMinor?: number }).neededMinor = pack.price_minor;
    throw err;
  }

  const payment = await client.query<{ id: string; pack_code: string; amount_minor: number; currency: string }>(
    `insert into usage_credit_payments (user_id, pack_code, amount_minor, currency, method, state)
     values ($1, $2, $3, $4, 'wallet', 'paid')
     returning id, pack_code, amount_minor, currency`,
    [userId, pack.code, pack.price_minor, pack.currency],
  );
  const paymentRow = payment.rows[0];

  await applyWalletDelta({
    userId,
    deltaMinor: -pack.price_minor,
    kind: "usage_credit_pack_purchase",
    refType: "usage_credit_payment",
    refId: paymentRow.id,
    metadata: {
      packCode: pack.code,
      audienceRole,
      credits: pack.credits_jsonb,
    },
    client,
  });

  for (const rawCredit of pack.credits_jsonb ?? []) {
    const creditType = normalizeCreditType(rawCredit.type);
    const quantity = Math.floor(Number(rawCredit.quantity ?? 0));
    if (!creditType || quantity <= 0) continue;
    const parsedValidDays = Number(rawCredit.validDays);
    const validDays =
      rawCredit.validDays == null || !Number.isFinite(parsedValidDays)
        ? null
        : Math.max(1, Math.floor(parsedValidDays));
    await client.query(
      `insert into user_usage_credits (
         user_id, pack_code, payment_id, credit_type, quantity, valid_until
       ) values (
         $1, $2, $3, $4, $5,
         case when $6::int is null then null else now() + ($6::text || ' days')::interval end
       )`,
      [userId, pack.code, paymentRow.id, creditType, quantity, validDays],
    );
  }

  return { payment: paymentRow };
}
