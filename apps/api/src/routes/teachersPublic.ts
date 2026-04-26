import { Hono } from "hono";
import { z } from "zod";
import { pool } from "../db.js";

function escapeLikePattern(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

const querySchema = z.object({
  branchId: z.coerce.number().int().positive().optional(),
  cityId: z.coerce.number().int().positive().optional(),
  q: z.string().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const teachersPublic = new Hono();

/** Genel öğretmen listesi (herkese açık arama) */
teachersPublic.get("/", async (c) => {
  const parsed = querySchema.safeParse({
    branchId: c.req.query("branchId"),
    cityId: c.req.query("cityId"),
    q: c.req.query("q"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { branchId, cityId, limit, offset } = parsed.data;
  const qTrim = parsed.data.q?.trim() ?? "";

  const params: unknown[] = [];
  let i = 1;
  let where = "where true";
  if (branchId !== undefined) {
    where += ` and exists (
      select 1 from teacher_branches tb
      where tb.teacher_id = t.id and tb.branch_id = $${i}
    )`;
    params.push(branchId);
    i++;
  }
  if (cityId !== undefined) {
    where += ` and t.city_id = $${i}`;
    params.push(cityId);
    i++;
  }
  if (qTrim.length > 0) {
    const pat = `%${escapeLikePattern(qTrim)}%`;
    where += ` and (
      u.display_name ilike $${i} escape '\\'
      or coalesce(t.bio_raw, '') ilike $${i} escape '\\'
    )`;
    params.push(pat);
    i++;
  }
  const limitPh = `$${i}`;
  const offsetPh = `$${i + 1}`;
  params.push(limit, offset);

  const sql = `
    select t.id,
           u.display_name,
           t.rating_avg,
           t.rating_count,
           t.city_id,
           c.name as city_name,
           t.verification_status,
           t.created_at
    from teachers t
    join users u on u.id = t.user_id
    left join cities c on c.id = t.city_id
    ${where}
    order by t.rating_avg desc nulls last, t.created_at desc
    limit ${limitPh} offset ${offsetPh}
  `;

  const r = await pool.query(sql, params);
  return c.json({ teachers: r.rows, limit, offset });
});

const uuidParam = z.string().uuid();

/** Genel öğretmen profili (detay) — e-posta dönmez */
teachersPublic.get("/:teacherId", async (c) => {
  const teacherId = c.req.param("teacherId");
  if (!uuidParam.safeParse(teacherId).success) {
    return c.json({ error: "invalid_teacher_id" }, 400);
  }

  const tr = await pool.query(
    `select t.id,
            u.display_name,
            t.bio_raw,
            t.video_url,
            t.instagram_url,
            t.platform_links_jsonb,
            t.exam_docs_jsonb,
            t.verification_status,
            t.city_id,
            c.name as city_name,
            d.name as district_name,
            t.rating_avg,
            t.rating_count,
            t.created_at
     from teachers t
     join users u on u.id = t.user_id
     left join cities c on c.id = t.city_id
     left join districts d on d.id = t.district_id
     where t.id = $1`,
    [teacherId],
  );
  if (!tr.rowCount) {
    return c.json({ error: "teacher_not_found" }, 404);
  }

  const br = await pool.query(
    `select tb.branch_id,
            b.name as branch_name,
            tb.years_experience,
            tb.is_primary,
            lower(tb.hourly_rate_range)::int as hourly_rate_min_minor,
            upper(tb.hourly_rate_range)::int as hourly_rate_max_minor
     from teacher_branches tb
     join branches b on b.id = tb.branch_id
     where tb.teacher_id = $1
     order by tb.is_primary desc, b.name`,
    [teacherId],
  );

  const rw = await pool.query(
    `select r.rating,
            r.comment,
            r.created_at,
            case
              when coalesce(trim(u.display_name), '') = '' then 'Öğrenci'
              when position(' ' in trim(u.display_name)) > 0 then
                split_part(trim(u.display_name), ' ', 1) || ' ' ||
                left(split_part(trim(u.display_name), ' ', 2), 1) || '.'
              else left(trim(u.display_name), 1) || '.'
            end as reviewer_label
     from reviews r
     join lesson_sessions ls on ls.id = r.lesson_session_id
     join lesson_packages lp on lp.id = ls.package_id
     join users u on u.id = r.reviewer_user_id
     where lp.teacher_id = $1
     order by r.created_at desc
     limit 25`,
    [teacherId],
  );

  return c.json({
    teacher: tr.rows[0],
    branches: br.rows,
    reviews: rw.rows,
  });
});
