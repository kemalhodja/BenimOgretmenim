import { pool } from "../db.js";
import type { Pool, PoolClient } from "pg";

export type UserAccountStatus = "active" | "suspended" | "deletion_requested";

export type UserAccountRow = {
  account_status: UserAccountStatus;
  suspension_reason: string | null;
  suspended_at: string | null;
  deletion_requested_at: string | null;
  deletion_reason: string | null;
};

export const ACCOUNT_STATUS_EXEMPT_PATH_PREFIXES = [
  "/v1/auth/",
  "/v1/support/",
  "/health",
] as const;

export function isAccountStatusExemptPath(path: string): boolean {
  const p = path.split("?")[0] ?? path;
  return ACCOUNT_STATUS_EXEMPT_PATH_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix));
}

type Db = Pool | PoolClient;

export async function loadUserAccountStatus(userId: string, client: Db = pool): Promise<UserAccountRow | null> {
  try {
    const r = await client.query<UserAccountRow>(
      `select account_status::text as account_status,
              suspension_reason,
              suspended_at::text as suspended_at,
              deletion_requested_at::text as deletion_requested_at,
              deletion_reason
       from users where id = $1`,
      [userId],
    );
    return r.rows[0] ?? null;
  } catch (e) {
    const code = (e as { code?: string }).code;
    // Migration öncesi, DB kapalı veya erişim hatası: auth akışını kırma.
    if (
      code === "42703" ||
      code === "ECONNREFUSED" ||
      code === "ENOTFOUND" ||
      code === "57P01" ||
      code === "28P01" ||
      code === "22P02"
    ) {
      if (code === "22P02") return null;
      return {
        account_status: "active",
        suspension_reason: null,
        suspended_at: null,
        deletion_requested_at: null,
        deletion_reason: null,
      };
    }
    throw e;
  }
}

export function accountStatusBlocksAccess(status: UserAccountStatus): boolean {
  return status === "suspended" || status === "deletion_requested";
}

export async function notifyUserInApp(
  userId: string,
  title: string,
  body: string,
  payload: Record<string, unknown>,
  client: Db = pool,
): Promise<void> {
  await client.query(
    `insert into user_notifications (
       recipient_user_id, channel, title, body, payload_jsonb, delivery_status, sent_at
     )
     values ($1, 'in_app', $2, $3, $4::jsonb, 'sent', now())`,
    [userId, title, body, JSON.stringify(payload)],
  );
}
