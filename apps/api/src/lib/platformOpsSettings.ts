import { pool } from "../db.js";
import type { Pool, PoolClient } from "pg";

type Db = Pool | PoolClient;

export type TeacherAutoWithdrawalSettings = {
  enabled: boolean;
  autoApproveEnabled: boolean;
  maxAmountMinor: number;
  requireVerified: boolean;
  requireSameIbanAsLastPaid: boolean;
  minPriorPaidCount: number;
  maxDailyAutoApprovals: number;
};

export type SupportSlaSettings = {
  firstResponseHours: number;
  disputeFirstResponseHours: number;
};

const DEFAULT_AUTO_WITHDRAWAL: TeacherAutoWithdrawalSettings = {
  enabled: true,
  autoApproveEnabled: false,
  maxAmountMinor: 250_000,
  requireVerified: true,
  requireSameIbanAsLastPaid: true,
  minPriorPaidCount: 1,
  maxDailyAutoApprovals: 3,
};

const DEFAULT_SUPPORT_SLA: SupportSlaSettings = {
  firstResponseHours: 24,
  disputeFirstResponseHours: 24,
};

function parseAutoWithdrawal(raw: unknown): TeacherAutoWithdrawalSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_AUTO_WITHDRAWAL;
  const o = raw as Record<string, unknown>;
  return {
    enabled: o.enabled !== false,
    autoApproveEnabled: o.autoApproveEnabled === true,
    maxAmountMinor:
      typeof o.maxAmountMinor === "number" && o.maxAmountMinor >= 10_000
        ? Math.floor(o.maxAmountMinor)
        : DEFAULT_AUTO_WITHDRAWAL.maxAmountMinor,
    requireVerified: o.requireVerified !== false,
    requireSameIbanAsLastPaid: o.requireSameIbanAsLastPaid !== false,
    minPriorPaidCount:
      typeof o.minPriorPaidCount === "number" && o.minPriorPaidCount >= 0
        ? Math.floor(o.minPriorPaidCount)
        : DEFAULT_AUTO_WITHDRAWAL.minPriorPaidCount,
    maxDailyAutoApprovals:
      typeof o.maxDailyAutoApprovals === "number" && o.maxDailyAutoApprovals >= 0
        ? Math.floor(o.maxDailyAutoApprovals)
        : DEFAULT_AUTO_WITHDRAWAL.maxDailyAutoApprovals,
  };
}

function parseSupportSla(raw: unknown): SupportSlaSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_SUPPORT_SLA;
  const o = raw as Record<string, unknown>;
  return {
    firstResponseHours:
      typeof o.firstResponseHours === "number" && o.firstResponseHours > 0
        ? Math.floor(o.firstResponseHours)
        : DEFAULT_SUPPORT_SLA.firstResponseHours,
    disputeFirstResponseHours:
      typeof o.disputeFirstResponseHours === "number" && o.disputeFirstResponseHours > 0
        ? Math.floor(o.disputeFirstResponseHours)
        : DEFAULT_SUPPORT_SLA.disputeFirstResponseHours,
  };
}

export async function loadOpsSetting<T>(
  key: string,
  parse: (raw: unknown) => T,
  client: Db = pool,
): Promise<T> {
  try {
    const r = await client.query<{ value_jsonb: unknown }>(
      `select value_jsonb from platform_ops_settings where key = $1`,
      [key],
    );
    return parse(r.rows[0]?.value_jsonb);
  } catch {
    if (key === "teacher_auto_withdrawal") return parseAutoWithdrawal(null) as T;
    if (key === "support_sla") return parseSupportSla(null) as T;
    throw new Error(`unknown_ops_setting:${key}`);
  }
}

export async function saveOpsSetting(key: string, value: unknown, client: Db = pool): Promise<void> {
  await client.query(
    `insert into platform_ops_settings (key, value_jsonb, updated_at)
     values ($1, $2::jsonb, now())
     on conflict (key) do update
     set value_jsonb = excluded.value_jsonb,
         updated_at = now()`,
    [key, JSON.stringify(value)],
  );
}

export async function loadTeacherAutoWithdrawalSettings(client: Db = pool): Promise<TeacherAutoWithdrawalSettings> {
  return loadOpsSetting("teacher_auto_withdrawal", parseAutoWithdrawal, client);
}

export async function loadSupportSlaSettings(client: Db = pool): Promise<SupportSlaSettings> {
  return loadOpsSetting("support_sla", parseSupportSla, client);
}
