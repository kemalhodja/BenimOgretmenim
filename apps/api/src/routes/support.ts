import { Hono } from "hono";
import { z } from "zod";
import { pool } from "../db.js";
import type { AppVariables } from "../types.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const support = new Hono<{ Variables: AppVariables }>();

const messageBodySchema = z.object({
  content: z.string().min(1).max(4000),
  pagePath: z.string().max(500).optional(),
});

async function ensureOpenThread(userId: string, contextPath: string) {
  const path = contextPath.trim().slice(0, 500);
  const r = await pool.query<{
    id: string;
    user_id: string;
    context_path: string;
    status: string;
    created_at: string;
    updated_at: string;
  }>(
    `insert into support_threads (user_id, context_path, status)
     values ($1, $2, 'open')
     on conflict (user_id) where (status = 'open')
     do update set
       context_path = case when length($2::text) > 0 then $2 else support_threads.context_path end,
       updated_at = now()
     returning id, user_id, context_path, status::text as status, created_at, updated_at`,
    [userId, path],
  );
  return r.rows[0];
}

support.get("/me", requireAuth, async (c) => {
  const userId = c.get("userId");
  const pagePath = (c.req.query("pagePath") ?? "").trim();
  const thread = await ensureOpenThread(userId, pagePath);
  const msgs = await pool.query<{
    id: string;
    sender: string;
    body: string;
    created_at: string;
  }>(
    `select id::text as id, sender, body, created_at
     from support_messages where thread_id = $1 order by created_at asc`,
    [thread.id],
  );
  return c.json({ thread, messages: msgs.rows });
});

support.post("/me/messages", requireAuth, async (c) => {
  const userId = c.get("userId");
  const parsed = messageBodySchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const { content, pagePath } = parsed.data;
  const thread = await ensureOpenThread(userId, pagePath?.trim() ?? "");
  await pool.query(
    `insert into support_messages (thread_id, sender, body) values ($1, 'user', $2)`,
    [thread.id, content.trim()],
  );
  await pool.query(`update support_threads set updated_at = now() where id = $1`, [thread.id]);
  const msgs = await pool.query<{
    id: string;
    sender: string;
    body: string;
    created_at: string;
  }>(
    `select id::text as id, sender, body, created_at
     from support_messages where thread_id = $1 order by created_at asc`,
    [thread.id],
  );
  return c.json({ ok: true, thread, messages: msgs.rows });
});
