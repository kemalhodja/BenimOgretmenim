import { randomBytes } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import { pool } from "../db.js";
import type { AppVariables } from "../types.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { assertAdminFinanceScope } from "../lib/adminGate.js";
import { ensureUserWalletRow } from "../lib/studentSub.js";
import { applyWalletDelta } from "../lib/wallet.js";
import { getWalletAvailableMinor } from "../lib/walletHolds.js";
import { TEACHER_WITHDRAWAL_SLA_BUSINESS_DAYS, withdrawalSlaLabelTr } from "../lib/teacherWithdrawalSla.js";
import {
  autoApproveWithdrawalIfEligible,
  evaluateAutoWithdrawal,
  loadAutoWithdrawalContext,
} from "../lib/teacherAutoWithdrawal.js";
import { loadTeacherAutoWithdrawalSettings } from "../lib/platformOpsSettings.js";
import { isPaytrConfigured, paytrNotConfiguredBody } from "../lib/systemHealth.js";

export const userWallet = new Hono<{ Variables: AppVariables }>();

const topupSchema = z.object({
  amountMinor: z.number().int().min(10_000).max(10_000_000_000), // min 100 TL
});

const adminGrantSchema = z.object({
  userId: z.string().uuid(),
  amountMinor: z.number().int().min(1).max(10_000_000_000),
  reason: z.string().min(3).max(200).optional(),
});

const withdrawalSchema = z.object({
  amountMinor: z.number().int().min(10_000).max(10_000_000_000),
  iban: z.string().trim().transform((v) => v.replace(/\s+/g, "").toUpperCase()).pipe(z.string().regex(/^TR[0-9A-Z]{24}$/)),
  accountHolderName: z.string().trim().min(3).max(120),
  bankName: z.string().trim().max(120).optional(),
});

userWallet.get("/me", requireAuth, async (c) => {
  const userId = c.get("userId");
  await ensureUserWalletRow(userId);
  const [w, h, available] = await Promise.all([
    pool.query(
    `select balance_minor, currency, updated_at from user_wallets where user_id = $1`,
    [userId],
    ),
    pool.query(
      `select coalesce(sum(amount_minor), 0)::bigint as active_hold_minor
       from user_wallet_holds
       where user_id = $1 and status = 'active'`,
      [userId],
    ),
    getWalletAvailableMinor(userId),
  ]);
  const b = w.rows[0] as { balance_minor: string; currency: string; updated_at: Date } | undefined;
  const activeHoldMinor = Number(h.rows[0]?.active_hold_minor ?? 0);
  return c.json({
    balanceMinor: b ? Number(b.balance_minor) : 0,
    activeHoldMinor,
    availableMinor: Number(available),
    currency: b?.currency ?? "TRY",
    updatedAt: b?.updated_at ?? null,
  });
});

/** Admin: test/ops için cüzdana bakiye ekle (wallet-only MVP destek) */
userWallet.post("/admin/grant", requireAuth, async (c) => {
  const denied = await assertAdminFinanceScope(c);
  if (denied) return denied;
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
  if (!isPaytrConfigured()) return c.json(paytrNotConfiguredBody(), 503);

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

userWallet.get("/course-payouts", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "teacher") return c.json({ error: "forbidden_teacher_only" }, 403);
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? "30") || 30));
  const teacher = await pool.query<{ id: string }>(`select id from teachers where user_id = $1`, [userId]);
  const teacherId = teacher.rows[0]?.id;
  if (!teacherId) return c.json({ payouts: [], summary: { paidCount: 0, paidAmountMinor: 0 } });

  const [summary, payouts] = await Promise.all([
    pool.query(
      `select count(*) filter (where status = 'wallet_paid')::int as paid_count,
              coalesce(sum(teacher_net_amount_minor) filter (where status = 'wallet_paid'), 0)::bigint as paid_amount_minor,
              count(*) filter (where status = 'pending')::int as pending_count,
              coalesce(sum(teacher_net_amount_minor) filter (where status = 'pending'), 0)::bigint as pending_amount_minor,
              coalesce(sum(platform_fee_minor) filter (where status = 'wallet_paid'), 0)::bigint as platform_fee_amount_minor
       from course_teacher_payouts
       where teacher_id = $1`,
      [teacherId],
    ),
    pool.query(
      `select tp.id, tp.course_id, tp.cohort_id, tp.session_id,
              c.title as course_title, cc.title as cohort_title, cs.title as session_title,
              cs.scheduled_start, tp.hourly_rate_minor, tp.duration_minutes,
              tp.amount_minor, tp.platform_fee_minor, tp.teacher_net_amount_minor,
              tp.success_fee_bps, tp.refund_lock_status, tp.payable_after,
              tp.currency, tp.status, tp.paid_at, tp.created_at
       from course_teacher_payouts tp
       join courses c on c.id = tp.course_id
       join course_cohorts cc on cc.id = tp.cohort_id
       join course_sessions cs on cs.id = tp.session_id
       where tp.teacher_id = $1
       order by coalesce(tp.paid_at, tp.created_at) desc
       limit $2`,
      [teacherId, limit],
    ),
  ]);

  const s = summary.rows[0] as {
    paid_count?: number;
    paid_amount_minor?: string | number;
    pending_count?: number;
    pending_amount_minor?: string | number;
    platform_fee_amount_minor?: string | number;
  } | undefined;
  return c.json({
    payouts: payouts.rows,
    summary: {
      paidCount: Number(s?.paid_count ?? 0),
      paidAmountMinor: Number(s?.paid_amount_minor ?? 0),
      pendingCount: Number(s?.pending_count ?? 0),
      pendingAmountMinor: Number(s?.pending_amount_minor ?? 0),
      platformFeeAmountMinor: Number(s?.platform_fee_amount_minor ?? 0),
    },
  });
});

userWallet.get("/withdrawals", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "teacher") return c.json({ error: "forbidden_teacher_only" }, 403);
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? "30") || 30));
  const r = await pool.query(
    `select w.id, w.amount_minor, w.currency, w.iban, w.account_holder_name, w.bank_name,
            w.status, w.requested_at, w.decided_at, w.paid_at, w.admin_note, w.bank_receipt_ref
     from teacher_wallet_withdrawals w
     where w.teacher_user_id = $1
     order by w.created_at desc
     limit $2`,
    [userId, limit],
  );
  return c.json({ withdrawals: r.rows });
});

userWallet.get("/earnings-summary", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "teacher") return c.json({ error: "forbidden_teacher_only" }, 403);

  const [wallet, pendingWd, paid30, pendingCourse, lastPaidWd] = await Promise.all([
    pool.query(
      `select balance_minor, currency from user_wallets where user_id = $1`,
      [userId],
    ),
    pool.query<{ count: number; sum: string }>(
      `select count(*)::int as count, coalesce(sum(amount_minor), 0)::bigint as sum
       from teacher_wallet_withdrawals
       where teacher_user_id = $1 and status = 'pending'`,
      [userId],
    ),
    pool.query<{ sum: string }>(
      `select coalesce(sum(amount_minor), 0)::bigint as sum
       from teacher_wallet_withdrawals
       where teacher_user_id = $1 and status = 'paid'
         and paid_at >= now() - interval '30 days'`,
      [userId],
    ),
    pool.query<{ count: number; sum: string }>(
      `select count(*)::int as count, coalesce(sum(teacher_net_amount_minor), 0)::bigint as sum
       from course_teacher_payouts p
       join teachers t on t.id = p.teacher_id
       where t.user_id = $1 and p.status <> 'wallet_paid'`,
      [userId],
    ),
    pool.query<{ paid_at: string }>(
      `select paid_at::text as paid_at
       from teacher_wallet_withdrawals
       where teacher_user_id = $1 and status = 'paid'
       order by paid_at desc nulls last
       limit 1`,
      [userId],
    ),
  ]);

  const w = wallet.rows[0] as { balance_minor: string; currency: string } | undefined;
  const available = await getWalletAvailableMinor(userId);

  return c.json({
    balanceMinor: w ? Number(w.balance_minor) : 0,
    availableMinor: Number(available),
    currency: w?.currency ?? "TRY",
    pendingWithdrawalCount: pendingWd.rows[0]?.count ?? 0,
    pendingWithdrawalMinor: Number(pendingWd.rows[0]?.sum ?? 0),
    paidWithdrawalLast30Minor: Number(paid30.rows[0]?.sum ?? 0),
    pendingCoursePayoutCount: pendingCourse.rows[0]?.count ?? 0,
    pendingCoursePayoutMinor: Number(pendingCourse.rows[0]?.sum ?? 0),
    lastPaidWithdrawalAt: lastPaidWd.rows[0]?.paid_at ?? null,
    withdrawalSlaBusinessDays: TEACHER_WITHDRAWAL_SLA_BUSINESS_DAYS,
    withdrawalSlaLabel: withdrawalSlaLabelTr(),
  });
});

userWallet.post("/withdrawals", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "teacher") return c.json({ error: "forbidden_teacher_only" }, 403);
  const parsed = withdrawalSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const client = await pool.connect();
  try {
    await client.query("begin");
    const teacher = await client.query<{ id: string }>(`select id from teachers where user_id = $1 for update`, [userId]);
    const teacherId = teacher.rows[0]?.id;
    if (!teacherId) {
      await client.query("rollback");
      return c.json({ error: "teacher_profile_not_found" }, 404);
    }
    const available = await getWalletAvailableMinor(userId, client);
    if (available < BigInt(parsed.data.amountMinor)) {
      await client.query("rollback");
      return c.json({ error: "insufficient_available_balance", availableMinor: available.toString() }, 409);
    }
    const withdrawal = await client.query<{ id: string }>(
      `insert into teacher_wallet_withdrawals (
         teacher_id, teacher_user_id, amount_minor, currency, iban,
         account_holder_name, bank_name, status, metadata_jsonb
       )
       values ($1, $2, $3, 'TRY', $4, $5, $6, 'pending', $7::jsonb)
       returning id`,
      [
        teacherId,
        userId,
        parsed.data.amountMinor,
        parsed.data.iban,
        parsed.data.accountHolderName,
        parsed.data.bankName ?? null,
        JSON.stringify({ source: "teacher_wallet_withdrawal_request" }),
      ],
    );
    await applyWalletDelta({
      userId,
      deltaMinor: -parsed.data.amountMinor,
      kind: "teacher_withdrawal_reserved",
      refType: "teacher_wallet_withdrawal",
      refId: withdrawal.rows[0].id,
      metadata: {
        teacherId,
        ibanLast4: parsed.data.iban.slice(-4),
        accountHolderName: parsed.data.accountHolderName,
      },
      client,
    });
    const withdrawalId = withdrawal.rows[0].id as string;
    const autoSettings = await loadTeacherAutoWithdrawalSettings(client);
    const autoCtx = await loadAutoWithdrawalContext(client, userId, teacherId, parsed.data.iban);
    const autoEval = evaluateAutoWithdrawal({
      settings: autoSettings,
      verificationStatus: autoCtx.verificationStatus,
      amountMinor: parsed.data.amountMinor,
      iban: parsed.data.iban,
      priorPaidSameIbanCount: autoCtx.priorPaidSameIbanCount,
      openDisputeCount: autoCtx.openDisputeCount,
      autoApprovalsToday: autoCtx.autoApprovalsToday,
    });
    await client.query(
      `update teacher_wallet_withdrawals
       set metadata_jsonb = metadata_jsonb || $2::jsonb
       where id = $1`,
      [
        withdrawalId,
        JSON.stringify({
          autoWithdrawal: {
            eligible: autoEval.eligible,
            reasons: autoEval.reasons,
            evaluatedAt: new Date().toISOString(),
          },
        }),
      ],
    );

    let autoApproved = false;
    if (autoSettings.autoApproveEnabled && autoEval.eligible) {
      autoApproved = await autoApproveWithdrawalIfEligible(client, withdrawalId, autoSettings, null);
    }

    if (!autoApproved) {
      await client.query(
        `insert into user_notifications (
           recipient_user_id, channel, title, body, payload_jsonb, delivery_status, sent_at
         )
         values ($1, 'in_app', $2, $3, $4::jsonb, 'sent', now())`,
        [
          userId,
          "Para çekme talebi alındı",
          `${(parsed.data.amountMinor / 100).toFixed(2)} TRY para çekme talebiniz alındı. ${autoEval.eligible ? "Otomatik onay için uygunsunuz; yönetici veya kural işlemi tamamlar." : "Yönetici onayına gönderildi."}`,
          JSON.stringify({
            kind: "teacher_wallet_withdrawal_requested",
            withdrawalId,
            amountMinor: parsed.data.amountMinor,
            currency: "TRY",
            autoEligible: autoEval.eligible,
            href: "/teacher/cuzdan",
          }),
        ],
      );
    }
    await client.query("commit");
    const created = await pool.query(
      `select id, amount_minor, currency, iban, account_holder_name, bank_name,
              status, requested_at, decided_at, paid_at, admin_note, bank_receipt_ref,
              metadata_jsonb
       from teacher_wallet_withdrawals
       where id = $1`,
      [withdrawalId],
    );
    return c.json({ withdrawal: created.rows[0], autoWithdrawal: autoEval }, 201);
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
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
