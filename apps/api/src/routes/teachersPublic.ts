import { Hono } from "hono";
import { z } from "zod";
import { pool } from "../db.js";
import { generateSlotsFromAvailability } from "../lib/availabilitySlots.js";
import type { AppVariables } from "../types.js";
import { requireAuth } from "../middleware/requireAuth.js";

function escapeLikePattern(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

const querySchema = z.object({
  branchId: z.coerce.number().int().positive().optional(),
  cityId: z.coerce.number().int().positive().optional(),
  q: z.string().max(120).optional(),
  sort: z.enum(["recommended", "rating", "newest", "price_asc", "experience"]).optional().default("recommended"),
  verifiedOnly: z.preprocess((v) => v === "1" || v === "true", z.boolean()).optional(),
  hasVideo: z.preprocess((v) => v === "1" || v === "true", z.boolean()).optional(),
  hasDocs: z.preprocess((v) => v === "1" || v === "true", z.boolean()).optional(),
  minRating: z.coerce.number().min(1).max(5).optional(),
  maxHourlyRateMinor: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

const teacherIdsSchema = z
  .array(z.string().uuid())
  .min(1)
  .max(20)
  .transform((ids) => [...new Set(ids)]);

export const teachersPublic = new Hono<{ Variables: AppVariables }>();

const shortlistPatchSchema = z.object({
  teacherId: z.string().uuid(),
  action: z.enum(["add", "remove"]),
});

teachersPublic.get("/shortlist", requireAuth, async (c) => {
  const userId = c.get("userId");
  const r = await pool.query(
    `select t.id,
            u.display_name,
            t.rating_avg,
            t.rating_count,
            t.city_id,
            c.name as city_name,
            t.verification_status,
            (select count(*)::int from teacher_branches tb where tb.teacher_id = t.id) as branch_count,
            ts.created_at as shortlisted_at
     from teacher_shortlists ts
     join teachers t on t.id = ts.teacher_id
     join users u on u.id = t.user_id
     left join cities c on c.id = t.city_id
     where ts.user_id = $1
     order by ts.created_at desc
     limit 100`,
    [userId],
  );
  return c.json({ teachers: r.rows });
});

teachersPublic.patch("/shortlist", requireAuth, async (c) => {
  const userId = c.get("userId");
  const parsed = shortlistPatchSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  if (parsed.data.action === "add") {
    const exists = await pool.query(`select 1 from teachers where id = $1`, [parsed.data.teacherId]);
    if (!exists.rowCount) return c.json({ error: "teacher_not_found" }, 404);
    await pool.query(
      `insert into teacher_shortlists (user_id, teacher_id)
       values ($1, $2)
       on conflict (user_id, teacher_id) do nothing`,
      [userId, parsed.data.teacherId],
    );
  } else {
    await pool.query(`delete from teacher_shortlists where user_id = $1 and teacher_id = $2`, [
      userId,
      parsed.data.teacherId,
    ]);
  }

  const ids = await pool.query<{ teacher_id: string }>(
    `select teacher_id from teacher_shortlists where user_id = $1 order by created_at desc`,
    [userId],
  );
  return c.json({ teacherIds: ids.rows.map((row) => row.teacher_id) });
});

/** Genel öğretmen listesi (herkese açık arama) */
teachersPublic.get("/", async (c) => {
  const parsed = querySchema.safeParse({
    branchId: c.req.query("branchId"),
    cityId: c.req.query("cityId"),
    q: c.req.query("q"),
    sort: c.req.query("sort"),
    verifiedOnly: c.req.query("verifiedOnly"),
    hasVideo: c.req.query("hasVideo"),
    hasDocs: c.req.query("hasDocs"),
    minRating: c.req.query("minRating"),
    maxHourlyRateMinor: c.req.query("maxHourlyRateMinor"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const {
    branchId,
    cityId,
    sort,
    verifiedOnly,
    hasVideo,
    hasDocs,
    minRating,
    maxHourlyRateMinor,
    limit,
    offset,
  } = parsed.data;
  const qTrim = parsed.data.q?.trim() ?? "";

  const params: unknown[] = [];
  const countParams: unknown[] = [];
  let i = 1;
  let where = "where true";
  if (branchId !== undefined) {
    where += ` and exists (
      select 1 from teacher_branches tb
      where tb.teacher_id = t.id and tb.branch_id = $${i}
    )`;
    params.push(branchId);
    countParams.push(branchId);
    i++;
  }
  if (cityId !== undefined) {
    where += ` and t.city_id = $${i}`;
    params.push(cityId);
    countParams.push(cityId);
    i++;
  }
  if (verifiedOnly) {
    where += ` and t.verification_status = 'verified'`;
  }
  if (hasVideo) {
    where += ` and coalesce(trim(t.video_url), '') <> ''`;
  }
  if (hasDocs) {
    where += ` and jsonb_typeof(coalesce(t.exam_docs_jsonb, '[]'::jsonb)) = 'array'
      and jsonb_array_length(coalesce(t.exam_docs_jsonb, '[]'::jsonb)) > 0`;
  }
  if (minRating !== undefined) {
    where += ` and coalesce(t.rating_avg, 0) >= $${i}`;
    params.push(minRating);
    countParams.push(minRating);
    i++;
  }
  if (maxHourlyRateMinor !== undefined) {
    where += ` and exists (
      select 1 from teacher_branches tbrate
      where tbrate.teacher_id = t.id
        and tbrate.hourly_rate_range is not null
        and lower(tbrate.hourly_rate_range)::int <= $${i}
    )`;
    params.push(maxHourlyRateMinor);
    countParams.push(maxHourlyRateMinor);
    i++;
  }
  let patIdx = 0;
  let exactIdx = 0;
  let prefixIdx = 0;
  if (qTrim.length > 0) {
    const pat = `%${escapeLikePattern(qTrim)}%`;
    const prefix = `${escapeLikePattern(qTrim)}%`;
    where += ` and (
      u.display_name ilike $${i} escape '\\'
      or coalesce(t.bio_raw, '') ilike $${i} escape '\\'
    )`;
    params.push(pat);
    countParams.push(pat);
    patIdx = i;
    i++;
    params.push(qTrim);
    exactIdx = i;
    i++;
    params.push(prefix);
    prefixIdx = i;
    i++;
  }
  const limitPh = `$${i}`;
  const offsetPh = `$${i + 1}`;
  params.push(limit, offset);

  /** Tek yıldızlı 5.0 gibi gürültüyü azaltmak için Bayesian ortalama (öncül 3.5, ağırlık 4). */
  const bayesExpr = `(coalesce(t.rating_count,0)::numeric * coalesce(t.rating_avg,0)::numeric + 14.0)
    / (coalesce(t.rating_count,0)::numeric + 4.0)`;
  const verifiedExpr = `(case when t.verification_status = 'verified' then 1 else 0 end)`;
  const minRateExpr = `(
    select min(lower(tbrate.hourly_rate_range)::int)
    from teacher_branches tbrate
    where tbrate.teacher_id = t.id and tbrate.hourly_rate_range is not null
  )`;
  const completedExpr = `(
    select count(*)::int
    from lesson_sessions ls
    join lesson_packages lp on lp.id = ls.package_id
    where lp.teacher_id = t.id and ls.status = 'completed'
  )`;
  const qualityExpr = `(
    (case when t.verification_status = 'verified' then 15 else 0 end) +
    (case when t.city_id is not null then 10 else 0 end) +
    (case when length(trim(coalesce(t.bio_raw, ''))) >= 80 then 20
          when length(trim(coalesce(t.bio_raw, ''))) >= 40 then 10
          else 0 end) +
    (case when coalesce(trim(t.video_url), '') <> '' then 15 else 0 end) +
    (case when exists (select 1 from teacher_branches tbq where tbq.teacher_id = t.id) then 15 else 0 end) +
    (case when jsonb_typeof(coalesce(t.exam_docs_jsonb, '[]'::jsonb)) = 'array'
            and jsonb_array_length(coalesce(t.exam_docs_jsonb, '[]'::jsonb)) > 0 then 10 else 0 end) +
    (case when jsonb_typeof(coalesce(t.platform_links_jsonb, '[]'::jsonb)) = 'array'
            and jsonb_array_length(coalesce(t.platform_links_jsonb, '[]'::jsonb)) > 0 then 5 else 0 end) +
    (case when coalesce(t.rating_count, 0) > 0 then 10 else 0 end)
  )`;

  const relevanceOrder =
    qTrim.length > 0
      ? `
      case
        when lower(btrim(u.display_name)) = lower(btrim($${exactIdx}::text)) then 40
        when u.display_name ilike $${prefixIdx} escape '\\' then 30
        when u.display_name ilike $${patIdx} escape '\\' then 20
        when coalesce(t.bio_raw, '') ilike $${patIdx} escape '\\' then 10
        else 0
      end desc,`
      : "";

  const sortOrder: Record<typeof sort, string> = {
    recommended: `${relevanceOrder} ${bayesExpr} desc, ${verifiedExpr} desc, ${qualityExpr} desc, t.created_at desc`,
    rating: `${relevanceOrder} coalesce(t.rating_avg, 0) desc, coalesce(t.rating_count, 0) desc, ${qualityExpr} desc, t.created_at desc`,
    newest: `${relevanceOrder} t.created_at desc, ${qualityExpr} desc`,
    price_asc: `${relevanceOrder} ${minRateExpr} asc nulls last, ${qualityExpr} desc, ${bayesExpr} desc`,
    experience: `${relevanceOrder} ${completedExpr} desc, ${qualityExpr} desc, ${bayesExpr} desc, t.created_at desc`,
  };

  const orderBy = `order by ${sortOrder[sort]}`;

  const sql = `
    select t.id,
           u.display_name,
           t.rating_avg,
           t.rating_count,
           t.city_id,
           c.name as city_name,
           t.verification_status,
           ${qualityExpr}::int as profile_quality_score,
           coalesce(trim(t.video_url), '') <> '' as has_video,
           (
             jsonb_typeof(coalesce(t.exam_docs_jsonb, '[]'::jsonb)) = 'array'
             and jsonb_array_length(coalesce(t.exam_docs_jsonb, '[]'::jsonb)) > 0
           ) as has_exam_docs,
           (
             jsonb_typeof(coalesce(t.platform_links_jsonb, '[]'::jsonb)) = 'array'
             and jsonb_array_length(coalesce(t.platform_links_jsonb, '[]'::jsonb)) > 0
           ) as has_platform_links,
           (select count(*)::int from teacher_branches tb where tb.teacher_id = t.id) as branch_count,
           ${minRateExpr} as min_hourly_rate_minor,
           (
             select max(upper(tbrate.hourly_rate_range)::int)
             from teacher_branches tbrate
             where tbrate.teacher_id = t.id and tbrate.hourly_rate_range is not null
           ) as max_hourly_rate_minor,
           (
             select tb.branch_id
             from teacher_branches tb
             join branches b on b.id = tb.branch_id
             where tb.teacher_id = t.id
             order by tb.is_primary desc, b.name
             limit 1
           ) as primary_branch_id,
           (
             select b.name
             from teacher_branches tb
             join branches b on b.id = tb.branch_id
             where tb.teacher_id = t.id
             order by tb.is_primary desc, b.name
             limit 1
           ) as primary_branch_name,
           ${completedExpr} as completed_sessions_count,
           t.created_at
    from teachers t
    join users u on u.id = t.user_id
    left join cities c on c.id = t.city_id
    ${where}
    ${orderBy}
    limit ${limitPh} offset ${offsetPh}
  `;

  const countSql = `
    select count(*)::int as total
    from teachers t
    join users u on u.id = t.user_id
    left join cities c on c.id = t.city_id
    ${where}
  `;

  const [r, total] = await Promise.all([pool.query(sql, params), pool.query(countSql, countParams)]);
  return c.json({ teachers: r.rows, total: total.rows[0]?.total ?? 0, limit, offset, sort });
});

const uuidParam = z.string().uuid();

function minorRangeLabel(min: number | null, max: number | null): string {
  if (min == null && max == null) return "Ücret demo/teklif sonrası netleşir";
  const left = min != null ? `${Math.round(min / 100)} TL` : "—";
  const right = max != null ? `${Math.round(max / 100)} TL` : "—";
  if (left === right) return `${left} / saat`;
  return `${left} - ${right} / saat`;
}

function availabilitySummary(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "Müsaitlik demo talebinden sonra birlikte netleşir";
  }
  const keys = Object.keys(value as Record<string, unknown>);
  if (keys.length === 0) return "Müsaitlik demo talebinden sonra birlikte netleşir";
  if (keys.some((key) => /saturday|sunday|hafta sonu/i.test(key))) {
    return "Hafta içi ve hafta sonu için müsaitlik seçenekleri var";
  }
  return "Hafta içi düzenli ders saatleri planlanabilir";
}

function teachingStyleSummary(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "Seviye tespiti, canlı anlatım ve ders sonu takip notu ile ilerler";
  }
  const record = value as Record<string, unknown>;
  const labels = Object.values(record)
    .flatMap((item) => (Array.isArray(item) ? item : [item]))
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 3);
  return labels.length
    ? labels.join(" · ")
    : "Seviye tespiti, canlı anlatım ve ders sonu takip notu ile ilerler";
}

/** Favori/karşılaştırma gibi istemci listelerini güncel özet verisiyle doldurur. */
teachersPublic.get("/batch", async (c) => {
  const rawIds = (c.req.query("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const parsed = teacherIdsSchema.safeParse(rawIds);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  const ids = parsed.data;

  const r = await pool.query(
    `select t.id,
            u.display_name,
            t.rating_avg,
            t.rating_count,
            t.city_id,
            c.name as city_name,
            t.verification_status,
            (
              (case when t.verification_status = 'verified' then 15 else 0 end) +
              (case when t.city_id is not null then 10 else 0 end) +
              (case when length(trim(coalesce(t.bio_raw, ''))) >= 80 then 20
                    when length(trim(coalesce(t.bio_raw, ''))) >= 40 then 10
                    else 0 end) +
              (case when coalesce(trim(t.video_url), '') <> '' then 15 else 0 end) +
              (case when exists (select 1 from teacher_branches tbq where tbq.teacher_id = t.id) then 15 else 0 end) +
              (case when jsonb_typeof(coalesce(t.exam_docs_jsonb, '[]'::jsonb)) = 'array'
                      and jsonb_array_length(coalesce(t.exam_docs_jsonb, '[]'::jsonb)) > 0 then 10 else 0 end) +
              (case when jsonb_typeof(coalesce(t.platform_links_jsonb, '[]'::jsonb)) = 'array'
                      and jsonb_array_length(coalesce(t.platform_links_jsonb, '[]'::jsonb)) > 0 then 5 else 0 end) +
              (case when coalesce(t.rating_count, 0) > 0 then 10 else 0 end)
            )::int as profile_quality_score,
            coalesce(trim(t.video_url), '') <> '' as has_video,
            (
              jsonb_typeof(coalesce(t.exam_docs_jsonb, '[]'::jsonb)) = 'array'
              and jsonb_array_length(coalesce(t.exam_docs_jsonb, '[]'::jsonb)) > 0
            ) as has_exam_docs,
            (
              jsonb_typeof(coalesce(t.platform_links_jsonb, '[]'::jsonb)) = 'array'
              and jsonb_array_length(coalesce(t.platform_links_jsonb, '[]'::jsonb)) > 0
            ) as has_platform_links,
            (select count(*)::int from teacher_branches tb where tb.teacher_id = t.id) as branch_count,
            (
              select min(lower(tbrate.hourly_rate_range)::int)
              from teacher_branches tbrate
              where tbrate.teacher_id = t.id and tbrate.hourly_rate_range is not null
            ) as min_hourly_rate_minor,
            (
              select max(upper(tbrate.hourly_rate_range)::int)
              from teacher_branches tbrate
              where tbrate.teacher_id = t.id and tbrate.hourly_rate_range is not null
            ) as max_hourly_rate_minor,
            (
              select tb.branch_id
              from teacher_branches tb
              join branches b on b.id = tb.branch_id
              where tb.teacher_id = t.id
              order by tb.is_primary desc, b.name
              limit 1
            ) as primary_branch_id,
            (
              select b.name
              from teacher_branches tb
              join branches b on b.id = tb.branch_id
              where tb.teacher_id = t.id
              order by tb.is_primary desc, b.name
              limit 1
            ) as primary_branch_name,
            (
              select count(*)::int
              from lesson_sessions ls
              join lesson_packages lp on lp.id = ls.package_id
              where lp.teacher_id = t.id and ls.status = 'completed'
            ) as completed_sessions_count,
            t.created_at
     from teachers t
     join users u on u.id = t.user_id
     left join cities c on c.id = t.city_id
     where t.id = any($1::uuid[])
     order by array_position($1::uuid[], t.id)`,
    [ids],
  );
  return c.json({ teachers: r.rows, total: r.rowCount ?? 0 });
});

/** Öğretmen müsaitlik slotları (takvim rezervasyonu için) */
teachersPublic.get("/instant-ready", async (c) => {
  const branchId = c.req.query("branchId") ? Number(c.req.query("branchId")) : null;
  const branchSlug = c.req.query("branchSlug")?.trim() || null;

  const args: unknown[] = [];
  let join = "";
  if (branchId && Number.isFinite(branchId)) {
    args.push(branchId);
    join = `join teacher_branches tb on tb.teacher_id = t.id and tb.branch_id = $1`;
  } else if (branchSlug) {
    args.push(branchSlug);
    join = `join teacher_branches tb on tb.teacher_id = t.id
            join branches b on b.id = tb.branch_id and b.slug = $1`;
  }

  try {
    const r = await pool.query(
      `select t.id,
              u.display_name,
              t.rating_avg,
              t.rating_count,
              t.instant_ready_until,
              c.name as city_name
       from teachers t
       join users u on u.id = t.user_id
       left join cities c on c.id = t.city_id
       ${join}
       where t.instant_lesson_available = true
         and t.verification_status = 'verified'
         and (t.instant_ready_until is null or t.instant_ready_until > now())
       order by t.last_presence_at desc nulls last, t.rating_avg desc nulls last
       limit 24`,
      args,
    );
    return c.json({ teachers: r.rows });
  } catch {
    return c.json({ teachers: [], note: "Anlık ders listesi şu an kullanılamıyor." });
  }
});

/** Öğretmen müsaitlik slotları (takvim rezervasyonu için) */
teachersPublic.get("/:teacherId/availability-slots", async (c) => {
  const teacherId = c.req.param("teacherId");
  if (!uuidParam.safeParse(teacherId).success) {
    return c.json({ error: "invalid_teacher_id" }, 400);
  }
  const days = Math.min(21, Math.max(3, Number(c.req.query("days") ?? 14) || 14));

  const tr = await pool.query(
    `select t.availability_jsonb
     from teachers t
     where t.id = $1`,
    [teacherId],
  );
  if (!tr.rowCount) return c.json({ error: "not_found" }, 404);

  const offers = generateSlotsFromAvailability(tr.rows[0].availability_jsonb, { daysAhead: days });
  if (!offers.length) {
    return c.json({ teacherId, slots: [], message: "Müsaitlik tanımlı değil; demo talebiyle netleştirin." });
  }

  const busy = await pool.query(
    `select scheduled_start, scheduled_end
     from direct_lesson_bookings
     where teacher_id = $1
       and scheduled_start is not null
       and status in ('pending_funding', 'funded')
       and scheduled_start >= now()
     union all
     select ls.scheduled_start, ls.scheduled_end
     from lesson_sessions ls
     join lesson_packages lp on lp.id = ls.package_id
     where lp.teacher_id = $1
       and ls.status = 'scheduled'
       and ls.scheduled_start is not null
       and ls.scheduled_start >= now()`,
    [teacherId],
  ).catch(() => ({ rows: [] as Array<{ scheduled_start: string; scheduled_end: string | null }> }));

  const busyRanges = busy.rows.map((row) => ({
    start: new Date(row.scheduled_start).getTime(),
    end: row.scheduled_end
      ? new Date(row.scheduled_end).getTime()
      : new Date(row.scheduled_start).getTime() + 60 * 60 * 1000,
  }));

  const slots = offers.filter((slot) => {
    const start = new Date(slot.start).getTime();
    const end = new Date(slot.end).getTime();
    return !busyRanges.some((b) => start < b.end && end > b.start);
  });

  return c.json({ teacherId, slots });
});

/** Genel öğretmen profili (detay) — e-posta dönmez */
teachersPublic.get("/:teacherId", async (c) => {
  const teacherId = c.req.param("teacherId");
  if (!uuidParam.safeParse(teacherId).success) {
    return c.json({ error: "invalid_teacher_id" }, 400);
  }

  const tr = await pool.query(
    `select t.id,
            u.display_name,
            case
              when t.contact_public = true
               and coalesce(trim(u.phone), '') <> ''
               and exists (
                 select 1
                 from teacher_subscriptions s
                 where s.teacher_id = t.id
                   and s.status = 'active'
                   and s.expires_at > now()
               )
              then u.phone
              else null
            end as contact_phone,
            t.contact_public,
            t.bio_raw,
            t.video_url,
            t.instagram_url,
            t.platform_links_jsonb,
            t.exam_docs_jsonb,
            t.availability_jsonb,
            t.teaching_style_jsonb,
            t.verification_status,
            t.city_id,
            c.name as city_name,
            d.name as district_name,
            t.rating_avg,
            t.rating_count,
            exists (
              select 1
              from teacher_subscriptions s
              where s.teacher_id = t.id
                and s.status = 'active'
                and s.expires_at > now()
            ) as has_active_subscription,
            (
              (case when t.verification_status = 'verified' then 15 else 0 end) +
              (case when t.city_id is not null then 10 else 0 end) +
              (case when length(trim(coalesce(t.bio_raw, ''))) >= 80 then 20
                    when length(trim(coalesce(t.bio_raw, ''))) >= 40 then 10
                    else 0 end) +
              (case when coalesce(trim(t.video_url), '') <> '' then 15 else 0 end) +
              (case when exists (select 1 from teacher_branches tbq where tbq.teacher_id = t.id) then 15 else 0 end) +
              (case when jsonb_typeof(coalesce(t.exam_docs_jsonb, '[]'::jsonb)) = 'array'
                      and jsonb_array_length(coalesce(t.exam_docs_jsonb, '[]'::jsonb)) > 0 then 10 else 0 end) +
              (case when jsonb_typeof(coalesce(t.platform_links_jsonb, '[]'::jsonb)) = 'array'
                      and jsonb_array_length(coalesce(t.platform_links_jsonb, '[]'::jsonb)) > 0 then 5 else 0 end) +
              (case when coalesce(t.rating_count, 0) > 0 then 10 else 0 end)
            )::int as profile_quality_score,
            coalesce(trim(t.video_url), '') <> '' as has_video,
            (
              jsonb_typeof(coalesce(t.exam_docs_jsonb, '[]'::jsonb)) = 'array'
              and jsonb_array_length(coalesce(t.exam_docs_jsonb, '[]'::jsonb)) > 0
            ) as has_exam_docs,
            (
              jsonb_typeof(coalesce(t.platform_links_jsonb, '[]'::jsonb)) = 'array'
              and jsonb_array_length(coalesce(t.platform_links_jsonb, '[]'::jsonb)) > 0
            ) as has_platform_links,
            (select count(*)::int from teacher_branches tb where tb.teacher_id = t.id) as branch_count,
            (
              select count(*)::int
              from lesson_sessions ls
              join lesson_packages lp on lp.id = ls.package_id
              where lp.teacher_id = t.id and ls.status = 'completed'
            ) as completed_sessions_count,
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

  const teacher = tr.rows[0] as Record<string, unknown>;
  const hasActiveSubscription = teacher.has_active_subscription === true;
  if (!hasActiveSubscription) {
    const primaryBranch = br.rows.find((row) => row.is_primary) ?? br.rows[0] ?? null;
    const limitedBranches = br.rows.map((row) => ({
      branch_id: row.branch_id,
      branch_name: row.branch_name,
      years_experience: null,
      is_primary: row.is_primary,
      hourly_rate_min_minor: null,
      hourly_rate_max_minor: null,
    }));
    return c.json({
      teacher: {
        id: teacher.id,
        display_name: teacher.display_name,
        bio_raw: null,
        video_url: null,
        instagram_url: null,
        platform_links_jsonb: [],
        exam_docs_jsonb: [],
        availability_jsonb: {},
        teaching_style_jsonb: {},
        verification_status: "limited",
        city_id: null,
        city_name: null,
        district_name: null,
        rating_avg: null,
        rating_count: null,
        profile_quality_score: 0,
        has_video: false,
        has_exam_docs: false,
        has_platform_links: false,
        branch_count: limitedBranches.length,
        completed_sessions_count: 0,
        contact_phone: null,
        contact_public: false,
        has_active_subscription: false,
        created_at: teacher.created_at,
        profile_site: {
          headline: `${teacher.display_name} · ${primaryBranch?.branch_name ?? "Öğretmen"} profili`,
          subheadline:
            "Bu öğretmen henüz aboneliğini tamamlamadığı için profilde yalnızca temel ad ve branş bilgileri gösterilir.",
          primaryBranchName: primaryBranch?.branch_name ?? null,
          locationLabel: "Abonelik sonrası açılır",
          priceLabel: "Abonelik sonrası açılır",
          ratingLabel: "Abonelik sonrası açılır",
          trustBadges: ["Sınırlı profil"],
          stats: [
            { label: "Profil durumu", value: "Sınırlı" },
            { label: "Uzmanlık", value: primaryBranch?.branch_name ?? "Branş bilgisi" },
          ],
          methodSteps: [],
          availabilitySummary: "Abonelik sonrası görünür",
          proofSummary: [],
          faq: [],
          ctaReasons: ["Abonelik sonrası detaylı profil açılır"],
        },
      },
      branches: limitedBranches,
      reviews: [],
    });
  }
  const rates = br.rows
    .flatMap((row) => [row.hourly_rate_min_minor, row.hourly_rate_max_minor])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const trustSummary = {
    verificationStatus: teacher.verification_status ?? "unverified",
    verificationLabel:
      teacher.verification_status === "verified"
        ? "Platform doğrulaması tamamlandı"
        : "Profil doğrulaması sınırlı; demo ve ek bilgi önerilir",
    evidence: {
      hasExamDocs: Boolean(teacher.has_exam_docs),
      hasPlatformLinks: Boolean(teacher.has_platform_links),
      hasVideo: Boolean(teacher.has_video),
      branchCount: Number(teacher.branch_count ?? 0),
      completedSessionsCount: Number(teacher.completed_sessions_count ?? 0),
      reviewCount: Number(teacher.rating_count ?? 0),
    },
    pricing: {
      minHourlyRateMinor: rates.length ? Math.min(...rates) : null,
      maxHourlyRateMinor: rates.length ? Math.max(...rates) : null,
      currency: "TRY",
      note: "Net ücret; seviye, hedef, sıklık ve paket kapsamı netleşmeden tahsil edilmez.",
    },
    paymentProtection:
      "Platform içi ödeme, ders kaydı, öğretmen notu ve destek kayıtları birlikte incelenir.",
  };
  const primaryBranch = br.rows.find((row) => row.is_primary) ?? br.rows[0] ?? null;
  const locationLabel = [teacher.district_name, teacher.city_name].filter(Boolean).join(", ") || "Online / Türkiye";
  const priceLabel = minorRangeLabel(trustSummary.pricing.minHourlyRateMinor, trustSummary.pricing.maxHourlyRateMinor);
  const ratingLabel =
    Number(teacher.rating_count ?? 0) > 0
      ? `${Number(teacher.rating_avg ?? 0).toFixed(1)} puan · ${Number(teacher.rating_count ?? 0)} yorum`
      : "Yeni yorum bekleniyor";
  const profileSite = {
    headline: `${teacher.display_name} ile ${primaryBranch?.branch_name ?? "özel ders"} için net hedef, güvenli ders akışı`,
    subheadline:
      typeof teacher.bio_raw === "string" && teacher.bio_raw.trim().length > 80
        ? teacher.bio_raw.trim().replace(/\s+/g, " ").slice(0, 180)
        : "Demo ders, güvenli ödeme, canlı sınıf ve ders sonu takip notlarıyla öğrencinin ilerlemesini görünür kılan öğretmen profili.",
    primaryBranchName: primaryBranch?.branch_name ?? null,
    locationLabel,
    priceLabel,
    ratingLabel,
    trustBadges: [
      teacher.verification_status === "verified" ? "Doğrulanmış profil" : "Demo ile beklenti netleştirin",
      Number(teacher.completed_sessions_count ?? 0) > 0
        ? `${Number(teacher.completed_sessions_count)} tamamlanan ders`
        : "Yeni ders adayı",
      Boolean(teacher.has_video) ? "Video tanıtım hazır" : "Tanışma görüşmesi önerilir",
      Boolean(teacher.has_exam_docs) ? "Doküman / başarı kanıtı var" : "Ek doküman isteyebilirsiniz",
    ],
    stats: [
      { label: "Profil kalitesi", value: `${Number(teacher.profile_quality_score ?? 0)}/100` },
      { label: "Uzmanlık", value: primaryBranch?.branch_name ?? "Branş profilde" },
      { label: "Konum", value: locationLabel },
      { label: "Ücret", value: priceLabel },
    ],
    methodSteps: [
      {
        title: "Seviye ve hedef analizi",
        body: "İlk görüşmede öğrencinin sınıf, sınav hedefi ve zorlandığı kazanımlar netleşir.",
      },
      {
        title: "Canlı ders ve ortak çalışma",
        body: teachingStyleSummary(teacher.teaching_style_jsonb),
      },
      {
        title: "Ders sonu takip",
        body: "Ödev, tekrar konusu ve veliye görünür ilerleme notu ile süreç kayıt altında kalır.",
      },
    ],
    availabilitySummary: availabilitySummary(teacher.availability_jsonb),
    proofSummary: [
      Boolean(teacher.has_video) ? "Tanıtım videosu" : null,
      Boolean(teacher.has_exam_docs) ? "Doküman / sınav içeriği" : null,
      Boolean(teacher.has_platform_links) ? "Harici platform kanıtları" : null,
      Number(teacher.rating_count ?? 0) > 0 ? ratingLabel : null,
    ].filter(Boolean),
    faq: [
      {
        question: "Derse başlamadan önce öğretmeni tanıyabilir miyim?",
        answer: "Evet. Demo talebiyle öğretmenin anlatım yöntemi, seviye tespiti ve ders planı önce netleşir.",
      },
      {
        question: "Ödeme nasıl güvenceye alınır?",
        answer: "Platform içi cüzdan ve ders kayıtlarıyla ödeme, ders tamamlanma ve destek süreçleri birlikte takip edilir.",
      },
      {
        question: "Veli ilerlemeyi görebilir mi?",
        answer: "Ders sonu notları, ödev ve gelişim sinyalleri veli panelinde takip edilebilir.",
      },
    ],
    ctaReasons: [
      "Demo ile beklentiyi netleştir",
      "Branş ve fiyatı karşılaştır",
      "Güvenli ödeme ve takip akışına geç",
    ],
  };

  return c.json({
    teacher: { ...teacher, trust_summary: trustSummary, profile_site: profileSite },
    branches: br.rows,
    reviews: rw.rows,
  });
});
