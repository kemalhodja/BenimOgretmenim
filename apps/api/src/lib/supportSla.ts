import type { Pool, PoolClient } from "pg";
import { loadSupportSlaSettings } from "./platformOpsSettings.js";

type Db = Pool | PoolClient;

export type SupportSlaDashboard = {
  settings: { firstResponseHours: number; disputeFirstResponseHours: number };
  supportThreads: {
    openCount: number;
    breachCount: number;
    breaches: Array<{
      id: string;
      user_id: string | null;
      visitor_email: string | null;
      context_path: string | null;
      created_at: string;
      hoursOpen: number;
    }>;
  };
  disputes: {
    openCount: number;
    breachCount: number;
    breaches: Array<{
      id: string;
      reason: string;
      status: string;
      priority: string;
      opened_by_user_id: string | null;
      created_at: string;
      hoursOpen: number;
    }>;
  };
};

export async function loadSupportSlaDashboard(client: Db): Promise<SupportSlaDashboard> {
  const settings = await loadSupportSlaSettings(client);

  const supportBreaches = await client.query(
    `select id, user_id, visitor_email, context_path, created_at,
            extract(epoch from (now() - created_at)) / 3600.0 as hours_open
     from support_threads
     where status = 'open'
       and created_at < now() - ($1::text || ' hours')::interval
     order by created_at asc
     limit 50`,
    [settings.firstResponseHours],
  ).catch(() => ({ rows: [] }));

  const supportOpen = await client.query<{ c: number }>(
    `select count(*)::int as c from support_threads where status = 'open'`,
  ).catch(() => ({ rows: [{ c: 0 }] }));

  const disputeBreaches = await client.query(
    `select id, reason, status, priority, opened_by_user_id, created_at,
            extract(epoch from (now() - created_at)) / 3600.0 as hours_open
     from platform_disputes
     where status in ('open', 'waiting_admin')
       and created_at < now() - ($1::text || ' hours')::interval
       and not exists (
         select 1 from platform_dispute_messages m
         where m.dispute_id = platform_disputes.id and m.sender_role = 'admin'
       )
     order by created_at asc
     limit 50`,
    [settings.disputeFirstResponseHours],
  ).catch(() => ({ rows: [] }));

  const disputeOpen = await client.query<{ c: number }>(
    `select count(*)::int as c from platform_disputes where status in ('open', 'waiting_admin', 'waiting_user')`,
  ).catch(() => ({ rows: [{ c: 0 }] }));

  return {
    settings,
    supportThreads: {
      openCount: supportOpen.rows[0]?.c ?? 0,
      breachCount: supportBreaches.rows.length,
      breaches: supportBreaches.rows.map((row) => ({
        id: String(row.id),
        user_id: row.user_id as string | null,
        visitor_email: row.visitor_email as string | null,
        context_path: row.context_path as string | null,
        created_at: String(row.created_at),
        hoursOpen: Math.round(Number(row.hours_open ?? 0)),
      })),
    },
    disputes: {
      openCount: disputeOpen.rows[0]?.c ?? 0,
      breachCount: disputeBreaches.rows.length,
      breaches: disputeBreaches.rows.map((row) => ({
        id: String(row.id),
        reason: String(row.reason),
        status: String(row.status),
        priority: String(row.priority),
        opened_by_user_id: row.opened_by_user_id as string | null,
        created_at: String(row.created_at),
        hoursOpen: Math.round(Number(row.hours_open ?? 0)),
      })),
    },
  };
}

export async function countCombinedSupportSlaBreaches(client: Db): Promise<number> {
  const dash = await loadSupportSlaDashboard(client);
  return dash.supportThreads.breachCount + dash.disputes.breachCount;
}
