import { Hono } from "hono";
import { z } from "zod";
import { pool } from "../db.js";
import type { AppVariables } from "../types.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { listThreadsForUser } from "../lib/userMessaging.js";

export const userMessages = new Hono<{ Variables: AppVariables }>();

const postMessageSchema = z.object({
  bodyText: z.string().min(1).max(4000),
});

userMessages.get("/threads", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "student" && role !== "teacher") {
    return c.json({ error: "forbidden" }, 403);
  }
  const threads = await listThreadsForUser(userId, role);
  return c.json({ threads });
});

userMessages.get("/threads/:threadId", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  const threadId = c.req.param("threadId");
  if (!z.string().uuid().safeParse(threadId).success) {
    return c.json({ error: "invalid_thread_id" }, 400);
  }

  const access = await pool.query(
    `select t.id, t.kind, t.subject, t.last_message_at
     from user_message_threads t
     left join students s on s.id = t.student_id
     left join teachers tt on tt.id = t.teacher_id
     where t.id = $1
       and (
         ($2 = 'student' and s.user_id = $3)
         or ($2 = 'teacher' and tt.user_id = $3)
       )`,
    [threadId, role, userId],
  );
  if (!access.rowCount) return c.json({ error: "not_found" }, 404);

  const msgs = await pool.query(
    `select m.id, m.body_text, m.created_at, m.read_at,
            u.display_name as sender_display_name,
            (m.sender_user_id = $2) as is_mine
     from user_messages m
     join users u on u.id = m.sender_user_id
     where m.thread_id = $1
     order by m.created_at asc
     limit 200`,
    [threadId, userId],
  );

  await pool.query(
    `update user_messages
     set read_at = now()
     where thread_id = $1
       and sender_user_id <> $2
       and read_at is null`,
    [threadId, userId],
  );

  return c.json({ thread: access.rows[0], messages: msgs.rows });
});

userMessages.post("/threads/:threadId/messages", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  const threadId = c.req.param("threadId");
  if (!z.string().uuid().safeParse(threadId).success) {
    return c.json({ error: "invalid_thread_id" }, 400);
  }
  const parsed = postMessageSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const access = await pool.query(
    `select t.id
     from user_message_threads t
     left join students s on s.id = t.student_id
     left join teachers tt on tt.id = t.teacher_id
     where t.id = $1
       and (
         ($2 = 'student' and s.user_id = $3)
         or ($2 = 'teacher' and tt.user_id = $3)
       )`,
    [threadId, role, userId],
  );
  if (!access.rowCount) return c.json({ error: "not_found" }, 404);

  const ins = await pool.query(
    `insert into user_messages (thread_id, sender_user_id, body_text)
     values ($1, $2, $3)
     returning id, body_text, created_at`,
    [threadId, userId, parsed.data.bodyText.trim()],
  );
  await pool.query(
    `update user_message_threads set last_message_at = now() where id = $1`,
    [threadId],
  );

  return c.json({ message: ins.rows[0] }, 201);
});
