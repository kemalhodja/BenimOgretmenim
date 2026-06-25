import { Hono } from "hono";
import { z } from "zod";
import { pool } from "../db.js";
import type { AppVariables } from "../types.js";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  defaultActionLabelForKind,
  defaultPriorityForKind,
  notificationCategoryForKind,
} from "../lib/inAppNotifications.js";
import {
  fetchNotificationSummary,
  summarySignature,
} from "../lib/notificationStream.js";

export const notifications = new Hono<{ Variables: AppVariables }>();

const inboxUnionSql = `
  select id, student_id, snapshot_id, channel::text as channel, title, body, payload_jsonb,
         delivery_status::text as delivery_status, sent_at, read_at, created_at, 'parent' as source
  from parent_notifications
  where recipient_user_id = $1
  union all
  select id, null::uuid as student_id, null::uuid as snapshot_id, channel::text as channel,
         title, body, payload_jsonb, delivery_status::text as delivery_status,
         sent_at, read_at, created_at, 'user' as source
  from user_notifications
  where recipient_user_id = $1`;

function enrichRow(row: Record<string, unknown>) {
  const payload = (row.payload_jsonb ?? {}) as Record<string, unknown>;
  const kind = typeof payload.kind === "string" ? payload.kind : "";
  return {
    ...row,
    presentation: {
      kind,
      category: notificationCategoryForKind(kind),
      priority:
        (typeof payload.priority === "string" ? payload.priority : null) ??
        defaultPriorityForKind(kind),
      actionLabel:
        (typeof payload.actionLabel === "string" ? payload.actionLabel : null) ??
        defaultActionLabelForKind(kind),
    },
  };
}

notifications.get("/summary", requireAuth, async (c) => {
  const userId = c.get("userId");
  return c.json(await fetchNotificationSummary(userId));
});

notifications.get("/", requireAuth, async (c) => {
  const userId = c.get("userId");
  const limit = Math.min(
    50,
    Math.max(1, Number(c.req.query("limit") ?? "30") || 30),
  );
  const unreadOnly = c.req.query("unreadOnly") === "1" || c.req.query("unreadOnly") === "true";

  const r = await pool.query(
    `select id, student_id, snapshot_id, channel, title, body, payload_jsonb,
            delivery_status, sent_at, read_at, created_at, source
     from (${inboxUnionSql}) notifications
     ${unreadOnly ? "where read_at is null" : ""}
     order by created_at desc
     limit $2`,
    [userId, limit],
  );
  return c.json({ notifications: r.rows.map((row) => enrichRow(row)) });
});

notifications.patch("/read-all", requireAuth, async (c) => {
  const userId = c.get("userId");

  const parent = await pool.query(
    `update parent_notifications
     set read_at = coalesce(read_at, now()),
         delivery_status = case when delivery_status = 'sent' then 'read'::notification_delivery_status else delivery_status end
     where recipient_user_id = $1 and read_at is null
     returning id`,
    [userId],
  );
  const user = await pool.query(
    `update user_notifications
     set read_at = coalesce(read_at, now()),
         delivery_status = case when delivery_status = 'sent' then 'read'::notification_delivery_status else delivery_status end
     where recipient_user_id = $1 and read_at is null
     returning id`,
    [userId],
  );

  return c.json({ marked: (parent.rowCount ?? 0) + (user.rowCount ?? 0) });
});

/** SSE: okunmamış sayısı değişince anlık özet (polling yerine). */
notifications.get("/stream", requireAuth, (c) => {
  const userId = c.get("userId");
  const encoder = new TextEncoder();
  let closed = false;
  let interval: ReturnType<typeof setInterval> | null = null;
  let lastSig = "";

  const stream = new ReadableStream({
    start(controller) {
      const write = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const poll = async () => {
        if (closed) return;
        try {
          const summary = await fetchNotificationSummary(userId);
          const sig = summarySignature(summary);
          if (sig !== lastSig) {
            lastSig = sig;
            write("summary", summary);
          } else {
            write("ping", { t: Date.now() });
          }
        } catch {
          write("error", { message: "stream_poll_failed" });
        }
      };

      void poll().then(() => {
        write("connected", { ok: true });
      });

      interval = setInterval(() => {
        void poll();
      }, 8_000);

      c.req.raw.signal.addEventListener("abort", () => {
        closed = true;
        if (interval) clearInterval(interval);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      closed = true;
      if (interval) clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});

notifications.patch("/:id/read", requireAuth, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  if (!z.string().uuid().safeParse(id).success) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const parent = await pool.query(
    `update parent_notifications
     set read_at = coalesce(read_at, now()),
         delivery_status = case when delivery_status = 'sent' then 'read'::notification_delivery_status else delivery_status end
     where id = $1 and recipient_user_id = $2
     returning id, read_at, delivery_status`,
    [id, userId],
  );
  if (parent.rowCount) {
    return c.json({ notification: parent.rows[0] });
  }

  const user = await pool.query(
    `update user_notifications
     set read_at = coalesce(read_at, now()),
         delivery_status = case when delivery_status = 'sent' then 'read'::notification_delivery_status else delivery_status end
     where id = $1 and recipient_user_id = $2
     returning id, read_at, delivery_status`,
    [id, userId],
  );
  if (!user.rowCount) {
    return c.json({ error: "not_found" }, 404);
  }
  return c.json({ notification: user.rows[0] });
});
