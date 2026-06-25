import type { Pool } from "pg";
import { pool } from "../db.js";

const inboxUnionSql = `
  select read_at, created_at, payload_jsonb
  from parent_notifications
  where recipient_user_id = $1
  union all
  select read_at, created_at, payload_jsonb
  from user_notifications
  where recipient_user_id = $1`;

export type NotificationStreamSummary = {
  unread: number;
  total: number;
  latestAt: string | null;
  byCategory: Record<string, number>;
};

export async function fetchNotificationSummary(userId: string): Promise<NotificationStreamSummary> {
  const counts = await pool.query<{ unread: number; total: number; latest_at: string | null }>(
    `select
       count(*) filter (where read_at is null)::int as unread,
       count(*)::int as total,
       max(created_at)::text as latest_at
     from (${inboxUnionSql}) inbox`,
    [userId],
  );

  const byCat = await pool.query<{ category: string; c: number }>(
    `select
       case
         when coalesce(payload_jsonb->>'kind', '') like '%homework%' then 'homework'
         when coalesce(payload_jsonb->>'kind', '') like '%lesson_video%' then 'video'
         when coalesce(payload_jsonb->>'kind', '') like '%lesson%' then 'lesson'
         when coalesce(payload_jsonb->>'kind', '') like '%course%' then 'course'
         when coalesce(payload_jsonb->>'kind', '') like '%group%' then 'group'
         when coalesce(payload_jsonb->>'kind', '') like '%direct%' or coalesce(payload_jsonb->>'kind', '') like '%instant%' then 'booking'
         when coalesce(payload_jsonb->>'kind', '') like '%offer%' or coalesce(payload_jsonb->>'kind', '') like '%request%' then 'offer'
         when coalesce(payload_jsonb->>'kind', '') like '%account%' or coalesce(payload_jsonb->>'kind', '') like '%wallet%' then 'account'
         else 'general'
       end as category,
       count(*)::int as c
     from (${inboxUnionSql}) inbox
     where read_at is null
     group by 1`,
    [userId],
  );

  const byCategory: Record<string, number> = {};
  for (const row of byCat.rows) {
    byCategory[row.category] = row.c;
  }

  const row = counts.rows[0];
  return {
    unread: row?.unread ?? 0,
    total: row?.total ?? 0,
    latestAt: row?.latest_at ?? null,
    byCategory,
  };
}

export function summarySignature(summary: NotificationStreamSummary): string {
  return `${summary.unread}:${summary.latestAt ?? ""}:${summary.total}`;
}
