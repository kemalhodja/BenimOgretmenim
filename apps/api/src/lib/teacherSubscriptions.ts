import type { PoolClient } from "pg";

export function teacherSubscriptionPromoMultiplier(): number {
  const n = Number(process.env.SUB_PROMO_MULTIPLIER ?? "5");
  if (!Number.isFinite(n) || n < 1 || n > 10) return 5;
  return Math.floor(n);
}

export async function createExtendedTeacherSubscription(
  client: PoolClient,
  opts: {
    teacherId: string;
    planCode: string;
    durationMonths: number;
    promoMultiplier?: number;
    paidAmountMinor: number;
    currency: string;
    paymentProvider: string;
    externalRef: string;
    paymentId?: string | null;
  },
): Promise<{ id: string; plan_code: string; status: string; started_at: Date; expires_at: Date; promo_multiplier: number }> {
  const promoMultiplier = opts.promoMultiplier ?? teacherSubscriptionPromoMultiplier();
  const totalMonths = Math.max(1, Math.floor(opts.durationMonths)) * Math.max(1, promoMultiplier);
  const r = await client.query(
    `with existing as (
       select greatest(now(), coalesce(max(expires_at), now())) as starts_at
       from teacher_subscriptions
       where teacher_id = $1
         and status = 'active'
         and expires_at > now()
     )
     insert into teacher_subscriptions (
       teacher_id, plan_code, status, started_at, expires_at,
       promo_multiplier, paid_amount_minor, currency, payment_provider, external_ref, payment_id
     )
     select $1, $2::subscription_plan_code, 'active',
            existing.starts_at,
            existing.starts_at + ($3::text || ' months')::interval,
            $4, $5, $6, $7, $8, $9
     from existing
     returning id, plan_code, status, started_at, expires_at, promo_multiplier`,
    [
      opts.teacherId,
      opts.planCode,
      String(totalMonths),
      Math.max(1, promoMultiplier),
      opts.paidAmountMinor,
      opts.currency,
      opts.paymentProvider,
      opts.externalRef,
      opts.paymentId ?? null,
    ],
  );
  return r.rows[0] as {
    id: string;
    plan_code: string;
    status: string;
    started_at: Date;
    expires_at: Date;
    promo_multiplier: number;
  };
}
