import type { Pool, PoolClient } from "pg";
import { pool } from "../db.js";

type Db = Pool | PoolClient | Pick<Pool, "query">;

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export type InAppNotificationPayload = Record<string, unknown> & {
  kind?: string;
  href?: string;
  priority?: NotificationPriority;
  actionLabel?: string;
  dedupeKey?: string;
};

export type NotifyInAppOptions = {
  /** payload.kind yerine kullanılabilir */
  kind?: string;
  /** Aynı kullanıcı + kind + dedupeKey için tekrar gönderilmez */
  dedupeKey?: string;
  /** kind başına günlük üst sınır (dedupeKey yokken) */
  dailyCap?: number;
};

export async function notifyUserInApp(
  userId: string,
  title: string,
  body: string,
  payload: InAppNotificationPayload,
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

/**
 * Akıllı in-app bildirim: dedup + günlük cap. Gönderildiyse true döner.
 */
export async function notifyUserInAppSmart(
  userId: string,
  title: string,
  body: string,
  payload: InAppNotificationPayload,
  opts: NotifyInAppOptions = {},
  client: Db = pool,
): Promise<boolean> {
  const kind = opts.kind ?? (typeof payload.kind === "string" ? payload.kind : "general");
  const dedupeKey = opts.dedupeKey ?? (typeof payload.dedupeKey === "string" ? payload.dedupeKey : null);

  if (dedupeKey) {
    const dup = await client.query<{ exists: boolean }>(
      `select exists (
         select 1 from user_notifications
         where recipient_user_id = $1
           and payload_jsonb->>'kind' = $2
           and payload_jsonb->>'dedupeKey' = $3
       ) as exists`,
      [userId, kind, dedupeKey],
    );
    if (dup.rows[0]?.exists) return false;
  }

  if (opts.dailyCap != null && opts.dailyCap > 0) {
    const cap = await client.query<{ c: number }>(
      `select count(*)::int as c
       from user_notifications
       where recipient_user_id = $1
         and payload_jsonb->>'kind' = $2
         and sent_at > now() - interval '1 day'`,
      [userId, kind],
    );
    if ((cap.rows[0]?.c ?? 0) >= opts.dailyCap) return false;
  }

  const enriched: InAppNotificationPayload = {
    ...payload,
    kind,
    ...(dedupeKey ? { dedupeKey } : {}),
    priority: payload.priority ?? defaultPriorityForKind(kind),
    actionLabel: payload.actionLabel ?? defaultActionLabelForKind(kind),
  };

  await notifyUserInApp(userId, title, body, enriched, client);
  return true;
}

export function defaultPriorityForKind(kind: string): NotificationPriority {
  if (
    kind.includes("reminder_2h") ||
    kind === "account_suspended" ||
    kind === "homework_sla_breach"
  ) {
    return "urgent";
  }
  if (
    kind.includes("offer") ||
    kind.includes("homework") ||
    kind.includes("lesson_video") ||
    kind.includes("direct_booking") ||
    kind.includes("instant_lesson")
  ) {
    return "high";
  }
  if (kind.includes("digest") || kind.includes("weekly")) return "low";
  return "normal";
}

export function defaultActionLabelForKind(kind: string): string {
  if (kind.includes("lesson_video")) return "Videoyu aç";
  if (kind.includes("homework")) return "Gönderiyi aç";
  if (kind.includes("offer") || kind.includes("lesson_request")) return "Teklifi gör";
  if (kind.includes("lesson") || kind.includes("classroom")) return "Derse git";
  if (kind.includes("course")) return "Kursa git";
  if (kind.includes("group")) return "Grup dersi";
  if (kind.includes("direct_booking")) return "Rezervasyon";
  if (kind.includes("campaign")) return "Kampanyayı gör";
  if (kind.includes("account")) return "Hesabı gör";
  return "Detaya git";
}

export function notificationCategoryForKind(kind: string): string {
  if (kind.includes("homework")) return "homework";
  if (kind.includes("lesson_video")) return "video";
  if (kind.includes("lesson") || kind.includes("classroom")) return "lesson";
  if (kind.includes("course")) return "course";
  if (kind.includes("group")) return "group";
  if (kind.includes("direct_booking") || kind.includes("instant")) return "booking";
  if (kind.includes("offer") || kind.includes("request")) return "offer";
  if (kind.includes("campaign")) return "campaign";
  if (kind.includes("account") || kind.includes("wallet") || kind.includes("payment")) return "account";
  if (kind.includes("curriculum")) return "study";
  return "general";
}

/** parent_notifications payload: href, öncelik ve aksiyon etiketi ekler. */
export function enrichParentNotificationPayload(
  payload: InAppNotificationPayload,
): InAppNotificationPayload {
  const kind = typeof payload.kind === "string" ? payload.kind : "general";
  const href =
    (typeof payload.href === "string" && payload.href.startsWith("/")
      ? payload.href
      : null) ??
    (typeof payload.actionHref === "string" && payload.actionHref.startsWith("/")
      ? payload.actionHref
      : null) ??
    (typeof payload.classroomHref === "string" && payload.classroomHref.startsWith("/")
      ? payload.classroomHref
      : null) ??
    defaultHrefForKind(kind, payload);

  return {
    ...payload,
    kind,
    ...(href ? { href } : {}),
    priority: payload.priority ?? defaultPriorityForKind(kind),
    actionLabel: payload.actionLabel ?? defaultActionLabelForKind(kind),
    ...(typeof payload.dedupeKey === "string" ? { dedupeKey: payload.dedupeKey } : {}),
  };
}

export function defaultHrefForKind(
  kind: string,
  payload: Record<string, unknown>,
): string | null {
  const requestId = typeof payload.requestId === "string" ? payload.requestId : null;
  const homeworkPostId = typeof payload.homeworkPostId === "string" ? payload.homeworkPostId : null;
  const offerId = typeof payload.offerId === "string" ? payload.offerId : null;

  if (kind.includes("lesson_video")) return "/student/ders-videolari";
  if (kind === "lesson_offer_accepted" || kind === "lesson_offer_rejected") {
    return requestId ? `/teacher/requests/${requestId}` : "/teacher/requests";
  }
  if (kind.includes("lesson_request") || kind.includes("lesson_offer")) {
    if (kind.includes("received") || kind.includes("demo_offer")) {
      return requestId ? `/student/requests/${requestId}` : "/student/requests";
    }
    return requestId ? `/teacher/requests?requestId=${requestId}` : "/teacher/requests";
  }
  if (kind.includes("homework") && !kind.endsWith("_guardian")) {
    if (kind.includes("new_post") || kind.includes("claimed") || kind.includes("answer")) {
      return homeworkPostId ? `/teacher/odev-havuzu` : "/teacher/odev-havuzu";
    }
    return homeworkPostId ? `/student/odev-sor/${homeworkPostId}` : "/student/odev-sor";
  }
  if (kind.includes("homework") && kind.endsWith("_guardian")) return "/guardian#bildirimler";
  if (kind.includes("curriculum") || kind === "guardian_weekly_report") return "/guardian#haftalik-ozet";
  if (kind.includes("reminder") || kind.includes("lesson_scheduled") || kind.includes("lesson_completed")) {
    if (typeof payload.classroomHref === "string") return payload.classroomHref;
    if (kind.includes("teacher") || payload.recipientKind === "teacher") return "/teacher/dersler";
    return "/student/dersler";
  }
  if (kind.includes("course")) return kind.includes("teacher") ? "/teacher/kurslar" : "/student/kurslar";
  if (kind.includes("group")) return kind.includes("teacher") ? "/teacher/grup-dersler" : "/student/grup-dersler";
  if (kind.includes("direct_booking")) {
    return kind.includes("teacher") ? "/teacher/dogrudan-dersler" : "/student/dogrudan-dersler";
  }
  if (kind.includes("campaign")) return "/teacher/kampanyalar";
  if (kind === "account_suspended") return "/hesap-askida";
  if (offerId && requestId) return `/student/requests/${requestId}`;
  return null;
}

export type NotifyParentOptions = {
  studentId?: string | null;
  dedupeKey?: string | null;
  reminderKind?: string | null;
  scheduledFor?: string | null;
};

/** parent_notifications — dedupe_key kolonu ile tekrar gönderimi engeller. */
export async function notifyParentInApp(
  recipientUserId: string,
  title: string,
  body: string,
  payload: InAppNotificationPayload,
  opts: NotifyParentOptions = {},
  client: Db = pool,
): Promise<{ sent: boolean; id?: string }> {
  const enriched = enrichParentNotificationPayload(payload);
  const dedupeKey = opts.dedupeKey ?? enriched.dedupeKey ?? null;

  if (dedupeKey) {
    const dup = await client.query<{ exists: boolean }>(
      `select exists (
         select 1 from parent_notifications where dedupe_key = $1
       ) as exists`,
      [dedupeKey],
    );
    if (dup.rows[0]?.exists) return { sent: false };
  }

  const r = await client.query<{ id: string }>(
    `insert into parent_notifications (
       recipient_user_id, student_id, snapshot_id, channel,
       title, body, payload_jsonb, delivery_status, sent_at,
       dedupe_key, reminder_kind, scheduled_for
     ) values ($1, $2, null, 'in_app', $3, $4, $5::jsonb, 'sent', now(), $6, $7, $8)
     returning id`,
    [
      recipientUserId,
      opts.studentId ?? null,
      title,
      body,
      JSON.stringify(enriched),
      dedupeKey,
      opts.reminderKind ?? null,
      opts.scheduledFor ?? null,
    ],
  );
  return { sent: true, id: r.rows[0]?.id };
}

/** Bulk insert helper: recipients subquery must return recipient_user_id, student_id */
export async function notifyParentInAppBulk(
  client: Db,
  recipientsSql: string,
  sqlParams: unknown[],
  title: string,
  body: string,
  payload: InAppNotificationPayload,
): Promise<number> {
  const enriched = enrichParentNotificationPayload(payload);
  const titleIdx = sqlParams.length + 1;
  const bodyIdx = sqlParams.length + 2;
  const payloadIdx = sqlParams.length + 3;
  const r = await client.query<{ c: number }>(
    `with ins as (
       insert into parent_notifications (
         recipient_user_id, student_id, snapshot_id, channel,
         title, body, payload_jsonb, delivery_status, sent_at
       )
       select recipient_user_id, student_id, null, 'in_app',
              $${titleIdx}, $${bodyIdx}, $${payloadIdx}::jsonb, 'sent', now()
       from (${recipientsSql}) recipients
       returning 1
     )
     select count(*)::int as c from ins`,
    [...sqlParams, title, body, JSON.stringify(enriched)],
  );
  return r.rows[0]?.c ?? 0;
}

export function serializeParentPayload(payload: InAppNotificationPayload): string {
  return JSON.stringify(enrichParentNotificationPayload(payload));
}
