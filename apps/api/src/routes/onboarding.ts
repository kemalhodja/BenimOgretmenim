import { Hono } from "hono";
import { z } from "zod";
import { pool } from "../db.js";
import type { AppVariables } from "../types.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const onboarding = new Hono<{ Variables: AppVariables }>();

const appendMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(20000),
  toolCalls: z.any().optional(),
});

/** Yeni AI mülakat oturumu (JWT: ilgili öğretmen) */
onboarding.post("/sessions", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "teacher") {
    return c.json({ error: "forbidden_teacher_only" }, 403);
  }

  const tr = await pool.query(`select id from teachers where user_id = $1`, [userId]);
  if (!tr.rowCount) {
    return c.json({ error: "teacher_profile_missing" }, 400);
  }
  const teacherId = tr.rows[0].id as string;

  const session = await pool.query(
    `insert into teacher_onboarding_sessions (teacher_id)
     values ($1)
     returning id, teacher_id, status, started_at`,
    [teacherId],
  );
  return c.json({ session: session.rows[0] }, 201);
});

/** Oturuma mesaj ekle (JWT: oturum sahibi öğretmen) */
onboarding.post("/sessions/:sessionId/messages", requireAuth, async (c) => {
  const userId = c.get("userId");
  const sessionId = c.req.param("sessionId");
  const parsed = appendMessageSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const own = await pool.query(
    `select 1
     from teacher_onboarding_sessions s
     join teachers t on t.id = s.teacher_id
     where s.id = $1 and t.user_id = $2`,
    [sessionId, userId],
  );
  if (!own.rowCount) {
    return c.json({ error: "forbidden_or_unknown_session" }, 403);
  }

  const client = await pool.connect();
  try {
    const nextSeq = await client.query(
      `select coalesce(max(seq), 0) + 1 as next_seq
       from onboarding_messages
       where session_id = $1`,
      [sessionId],
    );
    const seq = nextSeq.rows[0].next_seq as number;

    const row = await client.query(
      `insert into onboarding_messages (session_id, seq, role, content, tool_calls_jsonb)
       values ($1, $2, $3::chat_message_role, $4, $5::jsonb)
       returning id, session_id, seq, role, content, created_at`,
      [
        sessionId,
        seq,
        parsed.data.role,
        parsed.data.content,
        parsed.data.toolCalls === undefined
          ? null
          : JSON.stringify(parsed.data.toolCalls),
      ],
    );

    return c.json({ message: row.rows[0] }, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "insert_failed";
    return c.json({ error: msg }, 400);
  } finally {
    client.release();
  }
});

/** Mesaj geçmişi (JWT: oturum sahibi öğretmen) */
onboarding.get("/sessions/:sessionId/messages", requireAuth, async (c) => {
  const userId = c.get("userId");
  const sessionId = c.req.param("sessionId");

  const own = await pool.query(
    `select 1
     from teacher_onboarding_sessions s
     join teachers t on t.id = s.teacher_id
     where s.id = $1 and t.user_id = $2`,
    [sessionId, userId],
  );
  if (!own.rowCount) {
    return c.json({ error: "forbidden_or_unknown_session" }, 403);
  }

  const r = await pool.query(
    `select id, seq, role, content, tool_calls_jsonb, created_at
     from onboarding_messages
     where session_id = $1
     order by seq asc`,
    [sessionId],
  );
  return c.json({ messages: r.rows });
});

/** Öğretmen: mülakat oturumları (panel listesi) */
onboarding.get("/sessions", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "teacher") {
    return c.json({ error: "forbidden_teacher_only" }, 403);
  }

  const r = await pool.query(
    `select s.id, s.status, s.started_at, s.completed_at, s.ai_model
     from teacher_onboarding_sessions s
     join teachers t on t.id = s.teacher_id
     where t.user_id = $1
     order by s.started_at desc
     limit 30`,
    [userId],
  );
  return c.json({ sessions: r.rows });
});

const patchSessionSchema = z.object({
  status: z.enum(["completed", "abandoned"]),
});

/** Öğretmen: oturumu tamamla / bırak (yalnızca in_progress) */
onboarding.patch("/sessions/:sessionId", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "teacher") {
    return c.json({ error: "forbidden_teacher_only" }, 403);
  }

  const sessionId = c.req.param("sessionId");
  const parsed = patchSessionSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const status =
    parsed.data.status === "completed" ? "completed" : "abandoned";

  const upd = await pool.query(
    `update teacher_onboarding_sessions s
     set status = $3::teacher_onboarding_status,
         completed_at = coalesce(s.completed_at, now())
     from teachers t
     where s.id = $1
       and s.teacher_id = t.id
       and t.user_id = $2
       and s.status = 'in_progress'
     returning s.id, s.status, s.completed_at`,
    [sessionId, userId, status],
  );

  if (!upd.rowCount) {
    return c.json({ error: "not_found_or_not_in_progress" }, 409);
  }

  return c.json({ session: upd.rows[0] });
});
