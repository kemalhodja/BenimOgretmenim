import type { PoolClient } from "pg";
import { applyWalletDelta } from "./wallet.js";
import { writeAdminAudit } from "./adminAudit.js";
import type { TeacherAutoWithdrawalSettings } from "./platformOpsSettings.js";

export type AutoWithdrawalEvaluation = {
  eligible: boolean;
  reasons: string[];
};

export function normalizeIban(iban: string): string {
  return iban.replace(/\s+/g, "").toUpperCase();
}

export function evaluateAutoWithdrawal(input: {
  settings: TeacherAutoWithdrawalSettings;
  verificationStatus: string;
  amountMinor: number;
  iban: string;
  priorPaidSameIbanCount: number;
  openDisputeCount: number;
  autoApprovalsToday: number;
}): AutoWithdrawalEvaluation {
  const reasons: string[] = [];
  const { settings } = input;

  if (!settings.enabled) {
    return { eligible: false, reasons: ["Otomatik çekim kuralları kapalı"] };
  }
  if (input.amountMinor > settings.maxAmountMinor) {
    reasons.push(`Tutar üst limiti aşıyor (${settings.maxAmountMinor / 100} TL)`);
  }
  if (settings.requireVerified && input.verificationStatus !== "verified") {
    reasons.push("Öğretmen doğrulanmamış");
  }
  if (input.openDisputeCount > 0) {
    reasons.push("Açık itiraz kaydı var");
  }
  if (settings.requireSameIbanAsLastPaid && input.priorPaidSameIbanCount < settings.minPriorPaidCount) {
    reasons.push("Aynı IBAN ile önceki başarılı ödeme yok");
  }
  if (settings.maxDailyAutoApprovals > 0 && input.autoApprovalsToday >= settings.maxDailyAutoApprovals) {
    reasons.push("Günlük otomatik onay limiti doldu");
  }

  if (reasons.length === 0) {
    reasons.push("Doğrulanmış profil, limit içi tutar, temiz geçmiş");
    return { eligible: true, reasons };
  }
  return { eligible: false, reasons };
}

export async function loadAutoWithdrawalContext(
  client: PoolClient,
  teacherUserId: string,
  teacherId: string,
  iban: string,
): Promise<{
  verificationStatus: string;
  priorPaidSameIbanCount: number;
  openDisputeCount: number;
  autoApprovalsToday: number;
}> {
  const teacherR = await client.query<{ verification_status: string }>(
    `select verification_status::text as verification_status from teachers where id = $1`,
    [teacherId],
  );
  const normalized = normalizeIban(iban);
  const paidSameIban = await client.query<{ c: number }>(
    `select count(*)::int as c
     from teacher_wallet_withdrawals
     where teacher_user_id = $1
       and status = 'paid'
       and replace(upper(iban), ' ', '') = $2`,
    [teacherUserId, normalized],
  );
  const disputes = await client.query<{ c: number }>(
    `select count(*)::int as c
     from platform_disputes d
     join teachers t on t.id = d.teacher_id
     where t.user_id = $1
       and d.status in ('open', 'waiting_admin', 'waiting_user')`,
    [teacherUserId],
  ).catch(() => ({ rows: [{ c: 0 }] }));
  const autoToday = await client.query<{ c: number }>(
    `select count(*)::int as c
     from teacher_wallet_withdrawals
     where status = 'paid'
       and metadata_jsonb->>'autoApproved' = 'true'
       and paid_at >= date_trunc('day', now())`,
  );
  return {
    verificationStatus: teacherR.rows[0]?.verification_status ?? "unverified",
    priorPaidSameIbanCount: paidSameIban.rows[0]?.c ?? 0,
    openDisputeCount: disputes.rows[0]?.c ?? 0,
    autoApprovalsToday: autoToday.rows[0]?.c ?? 0,
  };
}

export async function autoApproveWithdrawalIfEligible(
  client: PoolClient,
  withdrawalId: string,
  settings: TeacherAutoWithdrawalSettings,
  actorUserId: string | null,
): Promise<boolean> {
  if (!settings.enabled || !settings.autoApproveEnabled) return false;

  const r = await client.query<{
    id: string;
    teacher_user_id: string;
    teacher_id: string;
    amount_minor: number;
    currency: string;
    iban: string;
    status: string;
  }>(
    `select id, teacher_user_id, teacher_id, amount_minor, currency, iban, status
     from teacher_wallet_withdrawals
     where id = $1
     for update`,
    [withdrawalId],
  );
  const row = r.rows[0];
  if (!row || row.status !== "pending") return false;

  const ctx = await loadAutoWithdrawalContext(client, row.teacher_user_id, row.teacher_id, row.iban);
  const evaluation = evaluateAutoWithdrawal({
    settings,
    verificationStatus: ctx.verificationStatus,
    amountMinor: Number(row.amount_minor),
    iban: row.iban,
    priorPaidSameIbanCount: ctx.priorPaidSameIbanCount,
    openDisputeCount: ctx.openDisputeCount,
    autoApprovalsToday: ctx.autoApprovalsToday,
  });
  if (!evaluation.eligible) return false;

  const receiptRef = `AUTO-${row.id.slice(0, 8).toUpperCase()}`;
  const updated = await client.query(
    `update teacher_wallet_withdrawals
     set status = 'paid',
         decided_at = now(),
         decided_by_admin_user_id = $2,
         paid_at = now(),
         admin_note = 'Otomatik kural ile onaylandı',
         bank_receipt_ref = $3,
         payout_provider = 'auto_rule',
         updated_at = now(),
         metadata_jsonb = metadata_jsonb || $4::jsonb
     where id = $1
     returning id`,
    [
      row.id,
      actorUserId,
      receiptRef,
      JSON.stringify({
        autoApproved: true,
        autoWithdrawalReasons: evaluation.reasons,
        autoApprovedAt: new Date().toISOString(),
      }),
    ],
  );
  if (!updated.rowCount) return false;

  await client.query(
    `insert into user_notifications (
       recipient_user_id, channel, title, body, payload_jsonb, delivery_status, sent_at
     )
     values ($1, 'in_app', $2, $3, $4::jsonb, 'sent', now())`,
    [
      row.teacher_user_id,
      "Para çekme otomatik onaylandı",
      `${(Number(row.amount_minor) / 100).toFixed(2)} ${row.currency} çekim talebiniz otomatik kural ile onaylandı; banka transferi SLA içinde tamamlanır.`,
      JSON.stringify({
        kind: "teacher_wallet_withdrawal_decision",
        withdrawalId: row.id,
        status: "paid",
        autoApproved: true,
        href: "/teacher/cuzdan",
      }),
    ],
  );

  if (actorUserId) {
    await writeAdminAudit(
      {
        actorUserId,
        actorRole: "admin",
        requestId: null,
        action: "teacher_wallet_withdrawal.auto_approve",
        entityType: "teacher_wallet_withdrawal",
        entityId: row.id,
        reason: evaluation.reasons.join("; "),
        before: { status: "pending" },
        after: { status: "paid", bankReceiptRef: receiptRef },
      },
      client,
    );
  }
  return true;
}

export async function rejectWithdrawalWithRefund(
  client: PoolClient,
  row: { id: string; teacher_user_id: string; teacher_id: string; amount_minor: number },
  note: string | null,
  adminUserId: string,
): Promise<void> {
  await applyWalletDelta({
    userId: row.teacher_user_id,
    deltaMinor: Number(row.amount_minor),
    kind: "teacher_withdrawal_rejected_refund",
    refType: "teacher_wallet_withdrawal",
    refId: row.id,
    metadata: { teacherId: row.teacher_id, reason: note, decidedByAdminUserId: adminUserId },
    client,
  });
}
