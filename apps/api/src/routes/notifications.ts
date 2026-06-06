import { Hono } from "hono";
import { z } from "zod";
import { pool } from "../db.js";
import type { AppVariables } from "../types.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const notifications = new Hono<{ Variables: AppVariables }>();

notifications.get("/", requireAuth, async (c) => {
  const userId = c.get("userId");
  const limit = Math.min(
    50,
    Math.max(1, Number(c.req.query("limit") ?? "30") || 30),
  );

  const r = await pool.query(
    `select id, student_id, snapshot_id, channel, title, body, payload_jsonb,
            delivery_status, sent_at, read_at, created_at, source
     from (
       select id, student_id, snapshot_id, channel::text as channel, title, body, payload_jsonb,
              delivery_status::text as delivery_status, sent_at, read_at, created_at, 'parent' as source
       from parent_notifications
       where recipient_user_id = $1
       union all
       select id, null::uuid as student_id, null::uuid as snapshot_id, channel::text as channel,
              title, body, payload_jsonb, delivery_status::text as delivery_status,
              sent_at, read_at, created_at, 'user' as source
       from user_notifications
       where recipient_user_id = $1
     ) notifications
     order by created_at desc
     limit $2`,
    [userId, limit],
  );
  return c.json({ notifications: r.rows });
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
