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

export { notifyUserInApp, notifyUserInAppSmart } from "./inAppNotifications.js";
import { notifyUserInApp } from "./inAppNotifications.js";

const LESSON_VIDEO_PUBLISHED_KIND = "lesson_video_published";
const LESSON_VIDEO_DAILY_CAP = 3;

/** Video onayı: aynı video tekrar bildirilmez; kullanıcı başına günlük üst sınır. */
export async function notifyLessonVideoPublishedToGradeStudents(
  video: {
    id: string;
    title: string;
    gradeLevel: number;
    branchId: number;
    branchName: string;
  },
  client: Db = pool,
): Promise<{ notified: number; skipped: number }> {
  const title = `${video.gradeLevel}. sınıf ${video.branchName}: yeni video`;
  const body = `"${video.title}" izlemeye hazır.`;
  const payloadBase = {
    kind: LESSON_VIDEO_PUBLISHED_KIND,
    videoId: video.id,
    gradeLevel: video.gradeLevel,
    branchId: video.branchId,
    href: "/student/ders-videolari",
    dedupeKey: video.id,
    priority: "high" as const,
    actionLabel: "Videoyu aç",
  };

  const recipients = await client.query<{ user_id: string }>(
    `select u.id as user_id
     from students s
     join users u on u.id = s.user_id
     where s.grade_level = $1
       and u.account_status = 'active'
       and not exists (
         select 1 from user_notifications n
         where n.recipient_user_id = u.id
           and n.payload_jsonb->>'kind' = $2
           and n.payload_jsonb->>'videoId' = $3
       )
       and (
         select count(*)::int from user_notifications n2
         where n2.recipient_user_id = u.id
           and n2.payload_jsonb->>'kind' = $2
           and n2.sent_at > now() - interval '1 day'
       ) < $4
     limit 120`,
    [video.gradeLevel, LESSON_VIDEO_PUBLISHED_KIND, video.id, LESSON_VIDEO_DAILY_CAP],
  );

  await Promise.all(
    recipients.rows.map((row) => notifyUserInApp(row.user_id, title, body, payloadBase, client)),
  );

  const eligible = await client.query<{ c: number }>(
    `select count(*)::int as c
     from students s
     join users u on u.id = s.user_id
     where s.grade_level = $1 and u.account_status = 'active'`,
    [video.gradeLevel],
  );
  const totalEligible = Math.min(eligible.rows[0]?.c ?? 0, 120);
  const notified = recipients.rowCount ?? 0;
  return { notified, skipped: Math.max(0, totalEligible - notified) };
}
