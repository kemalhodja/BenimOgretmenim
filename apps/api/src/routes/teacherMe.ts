import { Hono } from "hono";
import { z } from "zod";
import { pool } from "../db.js";
import type { AppVariables } from "../types.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const teacherMe = new Hono<{ Variables: AppVariables }>();

const patchMeSchema = z.object({
  displayName: z.string().min(1).max(120).optional(),
  phone: z.string().max(40).nullable().optional(),
  bioRaw: z.string().max(20000).nullable().optional(),
  videoUrl: z
    .union([z.string().url().max(2000), z.literal(""), z.null()])
    .optional(),
  instagramUrl: z
    .union([z.string().url().max(2000), z.literal(""), z.null()])
    .optional(),
  platformLinks: z
    .array(
      z.object({
        title: z.string().min(1).max(80),
        url: z.string().url().max(2000),
      }),
    )
    .max(20)
    .optional(),
  examDocs: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        url: z.string().url().max(2000),
        kind: z.enum(["yazili_hazirlik", "dokuman", "platform"]).optional(),
      }),
    )
    .max(50)
    .optional(),
  cityId: z.number().int().positive().nullable().optional(),
  districtId: z.number().int().positive().nullable().optional(),
  availability: z.record(z.string(), z.unknown()).optional(),
});

const branchRowSchema = z.object({
  branchId: z.number().int().positive(),
  yearsExperience: z.number().int().min(0).max(80).nullable().optional(),
  isPrimary: z.boolean().optional(),
  hourlyRateMin: z.number().int().nonnegative().nullable().optional(),
  hourlyRateMax: z.number().int().nonnegative().nullable().optional(),
});

const putBranchesSchema = z.object({
  branches: z.array(branchRowSchema).max(40),
});

function availabilityHasSlots(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return Object.keys(value as object).length > 0;
}

/** Öğretmen: panel için tam profil + tamamlanma checklist’i */
teacherMe.get("/me", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "teacher") {
    return c.json({ error: "forbidden_teachers_only" }, 403);
  }

  const r = await pool.query(
    `select
       t.id as teacher_id,
       u.id as user_id,
       u.email,
       u.display_name,
       u.phone,
       t.verification_status,
       t.bio_raw,
       t.bio_ai_generated,
       t.video_url,
       t.instagram_url,
       t.platform_links_jsonb,
       t.exam_docs_jsonb,
       t.city_id,
       t.district_id,
       t.rating_avg,
       t.rating_count,
       lower(t.hourly_rate_range) as hourly_rate_min,
       upper(t.hourly_rate_range) as hourly_rate_max,
       t.availability_jsonb,
       t.teaching_style_jsonb,
       t.teaching_style_model_version,
       t.teaching_style_confidence,
       t.created_at,
       t.updated_at,
       coalesce(
         (
           select jsonb_agg(
             jsonb_build_object(
               'branchId', tb.branch_id,
               'name', b.name,
               'slug', b.slug,
               'yearsExperience', tb.years_experience,
               'isPrimary', tb.is_primary,
               'hourlyRateMin', lower(tb.hourly_rate_range),
               'hourlyRateMax', upper(tb.hourly_rate_range)
             )
             order by tb.is_primary desc, b.sort_order, b.name
           )
           from teacher_branches tb
           join branches b on b.id = tb.branch_id
           where tb.teacher_id = t.id
         ),
         '[]'::jsonb
       ) as branches,
       exists (
         select 1 from teacher_onboarding_sessions s
         where s.teacher_id = t.id and s.status = 'completed'
       ) as onboarding_completed,
       exists (
         select 1 from curriculum_plans p where p.teacher_id = t.id
       ) as has_curriculum_plan
     from teachers t
     join users u on u.id = t.user_id
     where t.user_id = $1`,
    [userId],
  );

  if (!r.rowCount) {
    return c.json({ error: "teacher_profile_missing" }, 400);
  }

  const row = r.rows[0] as Record<string, unknown>;
  const branches = (row.branches as unknown[]) ?? [];
  const bio =
    (typeof row.bio_raw === "string" ? row.bio_raw : "") ||
    (typeof row.bio_ai_generated === "string" ? row.bio_ai_generated : "");

  const checklist = {
    branchesSelected: branches.length > 0,
    citySet: row.city_id != null,
    districtSet: row.district_id != null,
    availabilitySet: availabilityHasSlots(row.availability_jsonb),
    bioFilled: bio.trim().length >= 40,
    videoLinked:
      typeof row.video_url === "string" && row.video_url.trim().length > 0,
    instagramLinked:
      typeof row.instagram_url === "string" &&
      row.instagram_url.trim().length > 0,
    platformLinksAdded:
      Array.isArray(row.platform_links_jsonb) &&
      row.platform_links_jsonb.length > 0,
    examDocsAdded:
      Array.isArray(row.exam_docs_jsonb) && row.exam_docs_jsonb.length > 0,
    onboardingInterviewDone: row.onboarding_completed === true,
    curriculumStarted: row.has_curriculum_plan === true,
  };

  const completionScore = Math.round(
    (Object.values(checklist).filter(Boolean).length /
      Object.keys(checklist).length) *
      100,
  );

  return c.json({
    teacher: {
      id: row.teacher_id,
      userId: row.user_id,
      email: row.email,
      displayName: row.display_name,
      phone: row.phone,
      verificationStatus: row.verification_status,
      bioRaw: row.bio_raw,
      bioAiGenerated: row.bio_ai_generated,
      videoUrl: row.video_url,
      instagramUrl: row.instagram_url,
      platformLinks: row.platform_links_jsonb,
      examDocs: row.exam_docs_jsonb,
      cityId: row.city_id,
      districtId: row.district_id,
      ratingAvg: row.rating_avg,
      ratingCount: row.rating_count,
      hourlyRateMin: row.hourly_rate_min,
      hourlyRateMax: row.hourly_rate_max,
      availability: row.availability_jsonb,
      teachingStyle: row.teaching_style_jsonb,
      teachingStyleModelVersion: row.teaching_style_model_version,
      teachingStyleConfidence: row.teaching_style_confidence,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      branches,
    },
    checklist,
    completionScore,
  });
});

/** Öğretmen: profil güncelle (yapılandırılmış alanlar) */
teacherMe.patch("/me", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "teacher") {
    return c.json({ error: "forbidden_teachers_only" }, 403);
  }

  const parsed = patchMeSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const tr = await pool.query(`select id from teachers where user_id = $1`, [
    userId,
  ]);
  if (!tr.rowCount) {
    return c.json({ error: "teacher_profile_missing" }, 400);
  }

  const body = parsed.data;
  const client = await pool.connect();
  try {
    await client.query("begin");

    if (body.displayName !== undefined || body.phone !== undefined) {
      const sets: string[] = [];
      const vals: unknown[] = [];
      let i = 1;
      if (body.displayName !== undefined) {
        sets.push(`display_name = $${i++}`);
        vals.push(body.displayName);
      }
      if (body.phone !== undefined) {
        sets.push(`phone = $${i++}`);
        vals.push(body.phone);
      }
      vals.push(userId);
      await client.query(
        `update users set ${sets.join(", ")}, updated_at = now() where id = $${i}`,
        vals,
      );
    }

    const tSets: string[] = [];
    const tVals: unknown[] = [];
    let ti = 1;
    if (body.bioRaw !== undefined) {
      tSets.push(`bio_raw = $${ti++}`);
      tVals.push(body.bioRaw);
    }
    if (body.videoUrl !== undefined) {
      const v =
        body.videoUrl === "" || body.videoUrl === null ? null : body.videoUrl;
      tSets.push(`video_url = $${ti++}`);
      tVals.push(v);
    }
    if (body.instagramUrl !== undefined) {
      const v =
        body.instagramUrl === "" || body.instagramUrl === null ? null : body.instagramUrl;
      tSets.push(`instagram_url = $${ti++}`);
      tVals.push(v);
    }
    if (body.platformLinks !== undefined) {
      tSets.push(`platform_links_jsonb = $${ti++}::jsonb`);
      tVals.push(JSON.stringify(body.platformLinks ?? []));
    }
    if (body.examDocs !== undefined) {
      tSets.push(`exam_docs_jsonb = $${ti++}::jsonb`);
      tVals.push(JSON.stringify(body.examDocs ?? []));
    }
    if (body.cityId !== undefined) {
      tSets.push(`city_id = $${ti++}`);
      tVals.push(body.cityId);
    }
    if (body.districtId !== undefined) {
      tSets.push(`district_id = $${ti++}`);
      tVals.push(body.districtId);
    }
    if (body.availability !== undefined) {
      tSets.push(`availability_jsonb = $${ti++}::jsonb`);
      tVals.push(JSON.stringify(body.availability));
    }

    if (tSets.length) {
      tSets.push("updated_at = now()");
      tVals.push(userId);
      await client.query(
        `update teachers set ${tSets.join(", ")} where user_id = $${ti}`,
        tVals,
      );
    }

    await client.query("commit");
  } catch (e) {
    await client.query("rollback").catch(() => {});
    const err = e as { code?: string };
    if (err.code === "23503") {
      return c.json({ error: "invalid_city_or_district_reference" }, 400);
    }
    throw e;
  } finally {
    client.release();
  }

  return c.json({ ok: true });
});

/** Öğretmen: branş listesini atomik olarak yenile (arama / analitik için ID’li veri) */
teacherMe.put("/me/branches", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "teacher") {
    return c.json({ error: "forbidden_teachers_only" }, 403);
  }

  const parsed = putBranchesSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  for (const b of parsed.data.branches) {
    const { hourlyRateMin, hourlyRateMax } = b;
    if (
      (hourlyRateMin != null && hourlyRateMax == null) ||
      (hourlyRateMin == null && hourlyRateMax != null)
    ) {
      return c.json({ error: "hourly_rate_min_max_both_required" }, 400);
    }
    if (
      hourlyRateMin != null &&
      hourlyRateMax != null &&
      hourlyRateMin > hourlyRateMax
    ) {
      return c.json({ error: "hourly_rate_min_gt_max" }, 400);
    }
  }

  const tr = await pool.query(`select id from teachers where user_id = $1`, [
    userId,
  ]);
  if (!tr.rowCount) {
    return c.json({ error: "teacher_profile_missing" }, 400);
  }
  const teacherId = tr.rows[0].id as string;

  const branchIds = parsed.data.branches.map((b) => b.branchId);
  if (branchIds.length > 0) {
    const uniq = new Set(branchIds);
    if (uniq.size !== branchIds.length) {
      return c.json({ error: "duplicate_branch_ids" }, 400);
    }
  }

  const client = await pool.connect();
  try {
    await client.query("begin");

    if (branchIds.length > 0) {
      const valid = await client.query(
        `select count(*)::int as c from branches where id = any($1::int[]) and is_active = true`,
        [branchIds],
      );
      const cnt = valid.rows[0].c as number;
      if (cnt !== branchIds.length) {
        await client.query("rollback");
        return c.json({ error: "unknown_or_inactive_branch_id" }, 400);
      }
    }

    await client.query(`delete from teacher_branches where teacher_id = $1`, [
      teacherId,
    ]);

    if (parsed.data.branches.length === 0) {
      await client.query("commit");
      return c.json({ ok: true });
    }

    const explicitPrimary = parsed.data.branches.findIndex(
      (b) => b.isPrimary === true,
    );
    const primaryIndex = explicitPrimary >= 0 ? explicitPrimary : 0;

    for (let i = 0; i < parsed.data.branches.length; i++) {
      const b = parsed.data.branches[i];
      const isPrimary = i === primaryIndex;
      await client.query(
        `insert into teacher_branches (
           teacher_id, branch_id, years_experience, is_primary, hourly_rate_range
         ) values (
           $1, $2, $3, $4,
           case
             when $5::int is not null and $6::int is not null
             then int4range($5::int, $6::int, '[]')
             else null::int4range
           end
         )`,
        [
          teacherId,
          b.branchId,
          b.yearsExperience ?? null,
          isPrimary,
          b.hourlyRateMin ?? null,
          b.hourlyRateMax ?? null,
        ],
      );
    }

    await client.query("commit");
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  return c.json({ ok: true });
});

/** Öğretmen: pano — paket, ders oturumu ve ödeme durumu özetleri */
teacherMe.get("/dashboard", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "teacher") {
    return c.json({ error: "forbidden_teachers_only" }, 403);
  }

  const tr = await pool.query(`select id from teachers where user_id = $1`, [
    userId,
  ]);
  if (!tr.rowCount) {
    return c.json({ error: "teacher_profile_missing" }, 400);
  }
  const teacherId = tr.rows[0].id as string;

  const r = await pool.query(
    `select
       (select count(*)::int from lesson_packages lp
        where lp.teacher_id = $1 and lp.status = 'active') as active_packages,
       (select count(*)::int from lesson_packages lp
        where lp.teacher_id = $1 and lp.status = 'completed') as completed_packages,
       (select count(*)::int from lesson_sessions ls
        join lesson_packages lp on lp.id = ls.package_id
        where lp.teacher_id = $1
          and ls.status = 'scheduled'
          and ls.scheduled_start is not null
          and ls.scheduled_start >= now()) as upcoming_scheduled_sessions,
       (select count(*)::int from lesson_sessions ls
        join lesson_packages lp on lp.id = ls.package_id
        where lp.teacher_id = $1
          and ls.status = 'completed'
          and coalesce(ls.actual_end, ls.updated_at) >= now() - interval '30 days') as sessions_completed_last_30d,
       (select coalesce(sum(lp.completed_lessons), 0)::int from lesson_packages lp
        where lp.teacher_id = $1) as lifetime_completed_lessons_in_packages,
       (select count(*)::int from lesson_packages lp
        where lp.teacher_id = $1 and lp.payment_status = 'held_in_escrow') as packages_payment_held,
       (select count(*)::int from lesson_packages lp
        where lp.teacher_id = $1 and lp.status = 'dispute') as packages_in_dispute`,
    [teacherId],
  );

  const row = r.rows[0] as Record<string, number>;

  const rev = await pool.query(
    `select r.rating,
            left(coalesce(r.comment, ''), 220) as comment_preview,
            r.created_at,
            ls.session_index,
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
     limit 10`,
    [teacherId],
  );

  const recentReviews = rev.rows.map((x) => ({
    rating: Number(x.rating),
    commentPreview:
      typeof x.comment_preview === "string" && x.comment_preview.length > 0
        ? x.comment_preview
        : null,
    createdAt: x.created_at,
    sessionIndex: Number(x.session_index),
    reviewerLabel: x.reviewer_label as string,
  }));

  return c.json({
    activePackages: row.active_packages,
    completedPackages: row.completed_packages,
    upcomingScheduledSessions: row.upcoming_scheduled_sessions,
    sessionsCompletedLast30d: row.sessions_completed_last_30d,
    lifetimeCompletedLessonsInPackages: row.lifetime_completed_lessons_in_packages,
    packagesPaymentHeldInEscrow: row.packages_payment_held,
    packagesInDispute: row.packages_in_dispute,
    recentReviews,
  });
});
