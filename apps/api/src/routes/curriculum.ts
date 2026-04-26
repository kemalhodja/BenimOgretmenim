import { Hono } from "hono";
import { z } from "zod";
import { pool } from "../db.js";
import type { AppVariables } from "../types.js";
import { requireAuth } from "../middleware/requireAuth.js";

const saveDraftSchema = z.object({
  plan: z.record(z.string(), z.any()),
  sourceOnboardingSessionId: z.string().uuid().optional(),
});

export const curriculum = new Hono<{ Variables: AppVariables }>();

/** Öğretmen: taslak müfredat kaydet / güncelle (tek draft kuralı) */
curriculum.post("/draft", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "teacher") {
    return c.json({ error: "forbidden_teachers_only" }, 403);
  }

  const parsed = saveDraftSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const tr = await pool.query(`select id from teachers where user_id = $1`, [
    userId,
  ]);
  if (!tr.rowCount) {
    return c.json({ error: "teacher_profile_missing" }, 400);
  }
  const teacherId = tr.rows[0].id as string;

  const client = await pool.connect();
  try {
    await client.query("begin");

    const draft = await client.query(
      `select id, version from curriculum_plans
       where teacher_id = $1 and status = 'draft'
       limit 1
       for update`,
      [teacherId],
    );

    if (draft.rowCount) {
      const d = draft.rows[0] as { id: string; version: number };
      await client.query(
        `update curriculum_plans
         set plan_jsonb = $2::jsonb,
             source_onboarding_session_id = coalesce($3, source_onboarding_session_id),
             updated_at = now()
         where id = $1`,
        [
          d.id,
          JSON.stringify(parsed.data.plan),
          parsed.data.sourceOnboardingSessionId ?? null,
        ],
      );
      await client.query("commit");
      return c.json({ plan: { id: d.id, version: d.version, status: "draft" } });
    }

    const ver = await client.query(
      `select coalesce(max(version), 0) + 1 as v from curriculum_plans where teacher_id = $1`,
      [teacherId],
    );
    const version = ver.rows[0].v as number;

    const ins = await client.query(
      `insert into curriculum_plans (
         teacher_id, source_onboarding_session_id, version, status, plan_jsonb
       ) values ($1, $2, $3, 'draft', $4::jsonb)
       returning id, version, status, created_at`,
      [
        teacherId,
        parsed.data.sourceOnboardingSessionId ?? null,
        version,
        JSON.stringify(parsed.data.plan),
      ],
    );

    await client.query("commit");
    return c.json({ plan: ins.rows[0] }, 201);
  } catch (e) {
    await client.query("rollback").catch(() => {});
    const msg = e instanceof Error ? e.message : "save_failed";
    return c.json({ error: msg }, 400);
  } finally {
    client.release();
  }
});

curriculum.get("/mine", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "teacher") {
    return c.json({ error: "forbidden_teachers_only" }, 403);
  }

  const tr = await pool.query(`select id from teachers where user_id = $1`, [
    userId,
  ]);
  if (!tr.rowCount) {
    return c.json({ plans: [] });
  }
  const teacherId = tr.rows[0].id as string;

  const r = await pool.query(
    `select id, version, status, plan_jsonb, published_at, created_at, updated_at
     from curriculum_plans
     where teacher_id = $1
     order by version desc`,
    [teacherId],
  );
  return c.json({ plans: r.rows });
});
