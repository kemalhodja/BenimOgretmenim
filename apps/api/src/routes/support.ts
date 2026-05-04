import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import { pool } from "../db.js";
import type { AppVariables } from "../types.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { rateLimit } from "../middleware/rateLimit.js";

export const support = new Hono<{ Variables: AppVariables }>();

const messageBodySchema = z.object({
  content: z.string().min(1).max(4000),
  pagePath: z.string().max(500).optional(),
});

const guestBootstrapSchema = z.object({
  email: z.string().email().max(320),
  pagePath: z.string().max(500).optional(),
});

const guestBootstrapLimit = rateLimit({
  name: "support_guest_bootstrap",
  limit: 12,
  windowMs: 60_000,
});

const guestRwLimit = rateLimit({
  name: "support_guest_rw",
  limit: 100,
  windowMs: 60_000,
});

function normalizeVisitorEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

async function ensureOpenThread(userId: string, contextPath: string) {
  const path = contextPath.trim().slice(0, 500);
  const r = await pool.query<{
    id: string;
    user_id: string | null;
    context_path: string;
    status: string;
    created_at: string;
    updated_at: string;
  }>(
    `insert into support_threads (user_id, context_path, status)
     values ($1, $2, 'open')
     on conflict (user_id) where (status = 'open' and user_id is not null)
     do update set
       context_path = case when length($2::text) > 0 then $2 else support_threads.context_path end,
       updated_at = now()
     returning id, user_id, context_path, status::text as status, created_at, updated_at`,
    [userId, path],
  );
  return r.rows[0];
}

async function messagesForThread(threadId: string) {
  const msgs = await pool.query<{
    id: string;
    sender: string;
    body: string;
    created_at: string;
  }>(
    `select id::text as id, sender, body, created_at
     from support_messages where thread_id = $1 order by created_at asc`,
    [threadId],
  );
  return msgs.rows;
}

support.get("/me", requireAuth, async (c) => {
  const userId = c.get("userId");
  const pagePath = (c.req.query("pagePath") ?? "").trim();
  const thread = await ensureOpenThread(userId, pagePath);
  const messages = await messagesForThread(thread.id);
  return c.json({ thread, messages });
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
  const messages = await messagesForThread(thread.id);
  return c.json({ ok: true, thread, messages });
});

support.post("/guest/session", guestBootstrapLimit, async (c) => {
  const parsed = guestBootstrapSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const email = normalizeVisitorEmail(parsed.data.email);
  const path = (parsed.data.pagePath ?? "").trim().slice(0, 500);

  const existing = await pool.query<{
    id: string;
    guest_token: string;
    context_path: string;
    status: string;
    created_at: string;
    updated_at: string;
    visitor_email: string;
  }>(
    `select id, guest_token::text as guest_token, context_path, status::text as status,
            created_at, updated_at, visitor_email
     from support_threads
     where user_id is null and status = 'open' and lower(btrim(visitor_email)) = $1`,
    [email],
  );
  if (existing.rowCount) {
    const row = existing.rows[0];
    if (path.length > 0) {
      await pool.query(
        `update support_threads set context_path = $2, updated_at = now() where id = $1`,
        [row.id, path],
      );
    }
    const messages = await messagesForThread(row.id);
    const thread = {
      id: row.id,
      context_path: path.length > 0 ? path : row.context_path,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
    return c.json({
      guestToken: row.guest_token,
      thread,
      visitorEmail: row.visitor_email,
      messages,
    });
  }

  const guestToken = randomUUID();
  try {
    const ins = await pool.query<{
      id: string;
      context_path: string;
      status: string;
      created_at: string;
      updated_at: string;
      visitor_email: string;
    }>(
      `insert into support_threads (user_id, visitor_email, guest_token, context_path, status)
       values (null, $1, $2::uuid, $3, 'open')
       returning id, context_path, status::text as status, created_at, updated_at, visitor_email`,
      [email, guestToken, path],
    );
    if (!ins.rowCount) return c.json({ error: "create_failed" }, 500);
    const row = ins.rows[0];
    return c.json({
      guestToken,
      thread: {
        id: row.id,
        context_path: row.context_path,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      visitorEmail: row.visitor_email,
      messages: [],
    });
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? (e as { code?: string }).code : undefined;
    if (code !== "23505") throw e;
    const again = await pool.query<{
      id: string;
      guest_token: string;
      context_path: string;
      status: string;
      created_at: string;
      updated_at: string;
      visitor_email: string;
    }>(
      `select id, guest_token::text as guest_token, context_path, status::text as status,
              created_at, updated_at, visitor_email
       from support_threads
       where user_id is null and status = 'open' and lower(btrim(visitor_email)) = $1`,
      [email],
    );
    if (!again.rowCount) throw e;
    const row = again.rows[0];
    if (path.length > 0) {
      await pool.query(
        `update support_threads set context_path = $2, updated_at = now() where id = $1`,
        [row.id, path],
      );
    }
    const messages = await messagesForThread(row.id);
    return c.json({
      guestToken: row.guest_token,
      thread: {
        id: row.id,
        context_path: path.length > 0 ? path : row.context_path,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      visitorEmail: row.visitor_email,
      messages,
    });
  }
});

async function guestThreadFromHeader(c: { req: { header: (n: string) => string | undefined } }) {
  const raw = c.req.header("x-support-guest-token")?.trim();
  if (!raw || !z.string().uuid().safeParse(raw).success) return null;
  const r = await pool.query<{
    id: string;
    context_path: string;
    status: string;
    created_at: string;
    updated_at: string;
    visitor_email: string;
  }>(
    `select id, context_path, status::text as status, created_at, updated_at, visitor_email
     from support_threads
     where guest_token = $1::uuid and user_id is null`,
    [raw],
  );
  if (!r.rowCount) return null;
  return { guestToken: raw, row: r.rows[0] };
}

support.get("/guest/me", guestRwLimit, async (c) => {
  const gt = await guestThreadFromHeader(c);
  if (!gt) return c.json({ error: "invalid_guest_token" }, 401);
  const pagePath = (c.req.query("pagePath") ?? "").trim().slice(0, 500);
  if (pagePath.length > 0) {
    await pool.query(
      `update support_threads set context_path = $2, updated_at = now() where id = $1`,
      [gt.row.id, pagePath],
    );
  }
  const messages = await messagesForThread(gt.row.id);
  const thread = {
    id: gt.row.id,
    context_path: pagePath.length > 0 ? pagePath : gt.row.context_path,
    status: gt.row.status,
    created_at: gt.row.created_at,
    updated_at: gt.row.updated_at,
  };
  return c.json({ thread, visitorEmail: gt.row.visitor_email, messages });
});

support.post("/guest/messages", guestRwLimit, async (c) => {
  const gt = await guestThreadFromHeader(c);
  if (!gt) return c.json({ error: "invalid_guest_token" }, 401);
  const parsed = messageBodySchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const { content, pagePath } = parsed.data;
  const threadId = gt.row.id;
  if (pagePath?.trim()) {
    await pool.query(
      `update support_threads set context_path = $2, updated_at = now() where id = $1`,
      [threadId, pagePath.trim().slice(0, 500)],
    );
  }
  await pool.query(
    `insert into support_messages (thread_id, sender, body) values ($1, 'user', $2)`,
    [threadId, content.trim()],
  );
  await pool.query(`update support_threads set updated_at = now() where id = $1`, [threadId]);
  const messages = await messagesForThread(threadId);
  const th = await pool.query<{
    id: string;
    context_path: string;
    status: string;
    created_at: string;
    updated_at: string;
    visitor_email: string;
  }>(
    `select id, context_path, status::text as status, created_at, updated_at, visitor_email
     from support_threads where id = $1`,
    [threadId],
  );
  const tr = th.rows[0];
  return c.json({
    ok: true,
    thread: {
      id: tr.id,
      context_path: tr.context_path,
      status: tr.status,
      created_at: tr.created_at,
      updated_at: tr.updated_at,
    },
    visitorEmail: tr.visitor_email,
    messages,
  });
});
