import { Hono } from "hono";
import { z } from "zod";
import { pool } from "../db.js";
import type { AppVariables } from "../types.js";
import { requireAuth } from "../middleware/requireAuth.js";

/** Zigo flywheel: öğretmen ipuçları / formüller (ileri entegrasyon için açık uç) */
export const zigo = new Hono<{ Variables: AppVariables }>();

zigo.get("/teacher-feed", async (c) => {
  const branchSlug = c.req.query("branchSlug")?.trim() || null;
  const targetExam = c.req.query("targetExam")?.trim() || null;
  const args: unknown[] = [];
  const filters: string[] = [];
  if (branchSlug) {
    args.push(branchSlug);
    filters.push(`l.branch_slug = $${args.length}`);
  }
  if (targetExam) {
    args.push(targetExam);
    filters.push(`l.target_exam = $${args.length}`);
  }
  const where = filters.length ? `where ${filters.join(" and ")}` : "";

  try {
    const r = await pool.query(
      `select l.id, l.title, l.content_kind, l.external_url, l.branch_slug, l.target_exam,
              l.published_at, u.display_name as teacher_display_name, t.id as teacher_id
       from teacher_zigo_content_links l
       join teachers t on t.id = l.teacher_id
       join users u on u.id = t.user_id
       ${where}
       order by l.published_at desc
       limit 40`,
      args,
    );
    return c.json({ items: r.rows, integration: "zigo_feed_v1" });
  } catch {
    return c.json({ items: [], integration: "zigo_feed_v1", note: "Syndication tablosu henüz boş veya migration bekliyor." });
  }
});

const publishSchema = z.object({
  title: z.string().min(3).max(160),
  contentKind: z.enum(["tip", "formula", "video", "post"]).optional().default("tip"),
  externalUrl: z.string().url().max(2000).optional().nullable(),
  branchSlug: z.string().max(80).optional().nullable(),
  targetExam: z.string().max(40).optional().nullable(),
});

zigo.post("/teacher-content", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "teacher") return c.json({ error: "forbidden_teachers_only" }, 403);
  const parsed = publishSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const tr = await pool.query(`select id from teachers where user_id = $1`, [userId]);
  if (!tr.rowCount) return c.json({ error: "teacher_profile_missing" }, 400);

  try {
    const ins = await pool.query(
      `insert into teacher_zigo_content_links (
         teacher_id, title, content_kind, external_url, branch_slug, target_exam
       ) values ($1, $2, $3, $4, $5, $6)
       returning id, title, content_kind, published_at`,
      [
        tr.rows[0].id,
        parsed.data.title.trim(),
        parsed.data.contentKind,
        parsed.data.externalUrl ?? null,
        parsed.data.branchSlug ?? null,
        parsed.data.targetExam ?? null,
      ],
    );
    return c.json({ item: ins.rows[0] }, 201);
  } catch {
    return c.json({ error: "zigo_syndication_not_available" }, 503);
  }
});
