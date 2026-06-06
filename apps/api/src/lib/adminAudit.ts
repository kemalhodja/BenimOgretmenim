import type { PoolClient } from "pg";
import { pool } from "../db.js";

type Queryable = PoolClient | typeof pool;

let lastPaymentReconciliationWriteFailure: {
  at: string;
  merchantOid: string;
  status: string;
  error: string;
} | null = null;

export function getLastPaymentReconciliationWriteFailure() {
  return lastPaymentReconciliationWriteFailure;
}

export async function writeAdminAudit(
  opts: {
    actorUserId?: string | null;
    actorRole?: string | null;
    requestId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    reason?: string | null;
    before?: unknown;
    after?: unknown;
    metadata?: unknown;
  },
  client?: PoolClient,
): Promise<void> {
  const db: Queryable = client ?? pool;
  try {
    await db.query(
      `insert into admin_audit_events (
         actor_user_id, actor_role, request_id, action, entity_type, entity_id,
         reason, before_jsonb, after_jsonb, metadata_jsonb
       ) values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb)`,
      [
        opts.actorUserId ?? null,
        opts.actorRole ?? null,
        opts.requestId ?? null,
        opts.action,
        opts.entityType,
        opts.entityId ?? null,
        opts.reason ?? null,
        JSON.stringify(opts.before ?? {}),
        JSON.stringify(opts.after ?? {}),
        JSON.stringify(opts.metadata ?? {}),
      ],
    );
  } catch {
    // Audit must not break the primary admin operation during phased migrations.
  }
}

export async function writePaymentReconciliationEvent(
  opts: {
    merchantOid: string;
    paymentTable?: string | null;
    paymentId?: string | null;
    expectedAmountMinor?: number | null;
    receivedAmountMinor?: number | null;
    status: "matched" | "amount_mismatch" | "unknown_merchant_oid" | "failed";
    details?: unknown;
  },
  client?: PoolClient,
): Promise<void> {
  const db: Queryable = client ?? pool;
  try {
    await db.query(
      `insert into payment_reconciliation_events (
         provider, merchant_oid, payment_table, payment_id, expected_amount_minor,
         received_amount_minor, status, details_jsonb
       ) values ('paytr', $1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        opts.merchantOid,
        opts.paymentTable ?? null,
        opts.paymentId ?? null,
        opts.expectedAmountMinor ?? null,
        opts.receivedAmountMinor ?? null,
        opts.status,
        JSON.stringify(opts.details ?? {}),
      ],
    );
    lastPaymentReconciliationWriteFailure = null;
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    lastPaymentReconciliationWriteFailure = {
      at: new Date().toISOString(),
      merchantOid: opts.merchantOid,
      status: opts.status,
      error,
    };
    console.error("[payment-reconciliation] write failed", lastPaymentReconciliationWriteFailure);
    if (opts.status !== "matched") {
      throw new Error("payment_reconciliation_write_failed");
    }
  }
}
