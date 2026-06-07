import { Hono } from "hono";
import type { PoolClient } from "pg";
import { z } from "zod";
import { pool } from "../db.js";
import type { AppVariables } from "../types.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { applyWalletDelta } from "../lib/wallet.js";
import { getWalletAvailableMinor } from "../lib/walletHolds.js";
import { assertAdminGate } from "../lib/adminGate.js";
import { writeAdminAudit } from "../lib/adminAudit.js";

export const teacherCampaigns = new Hono<{ Variables: AppVariables }>();

const LISTING_FEE_MINOR = 100_000;

const uuidSchema = z.string().uuid();

const createCampaignSchema = z.object({
  title: z.string().min(3).max(140),
  description: z.string().min(20).max(10_000),
  branchId: z.number().int().positive().nullable().optional(),
  cityId: z.number().int().positive().nullable().optional(),
  districtId: z.number().int().positive().nullable().optional(),
  deliveryMode: z.enum(["online", "in_person", "hybrid"]).optional(),
  lessonCount: z.number().int().positive().max(1000).nullable().optional(),
  priceMinor: z.number().int().min(0).max(10_000_000_000).optional(),
  currency: z.string().length(3).optional(),
  capacity: z.number().int().positive().max(10_000).nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  billingModel: z.enum(["listing_fee", "success_fee"]).optional(),
});

const patchStatusSchema = z.object({
  status: z.enum(["pending_review", "paused", "archived"]),
});

const adminPatchStatusSchema = z.object({
  status: z.enum(["pending_review", "published", "paused", "archived", "rejected"]),
  note: z.string().max(1000).optional(),
});

const applySchema = z.object({
  message: z.string().max(2000).nullable().optional(),
});

const patchApplicationSchema = z.object({
  status: z.enum(["new", "contacted", "closed"]),
});

const listSchema = z.object({
  q: z.string().max(120).optional(),
  branchId: z.coerce.number().int().positive().optional(),
  cityId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(24),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

async function teacherIdForUser(userId: string): Promise<string | null> {
  const r = await pool.query<{ id: string }>(`select id from teachers where user_id = $1`, [userId]);
  return r.rows[0]?.id ?? null;
}

async function studentIdForUser(userId: string): Promise<string | null> {
  const r = await pool.query<{ id: string }>(`select id from students where user_id = $1`, [userId]);
  return r.rows[0]?.id ?? null;
}

async function hasActiveTeacherSubscription(teacherId: string): Promise<boolean> {
  const r = await pool.query(
    `select 1
     from teacher_subscriptions
     where teacher_id = $1
       and status = 'active'
       and expires_at > now()
     limit 1`,
    [teacherId],
  );
  return !!r.rowCount;
}

async function lockTeacherCampaignEntitlement(teacherId: string, client: PoolClient) {
  await client.query(
    `select pg_advisory_xact_lock(hashtext($1), hashtext($2))`,
    ["teacher_campaign_entitlement", teacherId],
  );
}

/** Teacher: list own campaigns with application counts. */
teacherCampaigns.get("/mine", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "teacher") return c.json({ error: "forbidden_teachers_only" }, 403);

  const teacherId = await teacherIdForUser(userId);
  if (!teacherId) return c.json({ campaigns: [], listingFeeMinor: LISTING_FEE_MINOR });

  const r = await pool.query(
    `select tc.id,
            tc.title,
            tc.description,
            tc.status,
            tc.delivery_mode,
            tc.lesson_count,
            tc.price_minor,
            tc.currency,
            tc.billing_model,
            tc.success_fee_bps,
            tc.capacity,
            tc.starts_at,
            tc.listing_fee_minor,
            tc.billing_model,
            tc.success_fee_bps,
            tc.free_listing_used,
            tc.review_note,
            tc.reviewed_at,
            tc.created_at,
            tc.updated_at,
            b.name as branch_name,
            ci.name as city_name,
            (
              select count(*)::int
              from teacher_campaign_applications a
              where a.campaign_id = tc.id
            ) as application_count,
            (
              select count(*)::int
              from teacher_campaign_applications a
              where a.campaign_id = tc.id and a.status = 'new'
            ) as new_application_count
     from teacher_campaigns tc
     left join branches b on b.id = tc.branch_id
     left join cities ci on ci.id = tc.city_id
     where tc.teacher_id = $1
     order by tc.created_at desc
     limit 100`,
    [teacherId],
  );

  return c.json({ campaigns: r.rows, listingFeeMinor: LISTING_FEE_MINOR });
});

/** Teacher: create a campaign advertisement for admin review. */
teacherCampaigns.post("/", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "teacher") return c.json({ error: "forbidden_teachers_only" }, 403);

  const parsed = createCampaignSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const teacherId = await teacherIdForUser(userId);
  if (!teacherId) return c.json({ error: "teacher_profile_missing" }, 400);
  if (!(await hasActiveTeacherSubscription(teacherId))) {
    return c.json({ error: "teacher_subscription_required" }, 403);
  }

  const body = parsed.data;
  const currency = (body.currency ?? "TRY").toUpperCase();
  if (currency !== "TRY") return c.json({ error: "currency_not_supported" }, 409);
    const billingModel = body.billingModel ?? "listing_fee";

  const client = await pool.connect();
  try {
    await client.query("begin");
    await lockTeacherCampaignEntitlement(teacherId, client);

    const createdCount = await client.query<{ c: number }>(
      `select count(*)::int as c
       from teacher_campaigns
       where teacher_id = $1`,
      [teacherId],
    );
    const isFirstListing = Number(createdCount.rows[0]?.c ?? 0) === 0;
    const listingFeeMinor = billingModel === "success_fee" || isFirstListing ? 0 : LISTING_FEE_MINOR;

    if (listingFeeMinor > 0) {
      const available = await getWalletAvailableMinor(userId, client);
      if (available < BigInt(listingFeeMinor)) {
        await client.query("rollback");
        return c.json({ error: "insufficient_balance", neededMinor: listingFeeMinor }, 409);
      }
    }

    const ins = await client.query(
      `insert into teacher_campaigns (
         teacher_id, branch_id, city_id, district_id, title, description,
         delivery_mode, lesson_count, price_minor, currency, capacity, starts_at,
         status, listing_fee_minor, listing_fee_currency, billing_model, success_fee_bps, free_listing_used, published_at
       ) values (
         $1, $2, $3, $4, $5, $6,
         $7::lesson_delivery_mode, $8, $9, $10, $11, $12,
         'pending_review', $13, 'TRY', $14, 1000, $15, null
       )
       returning id, title, status, listing_fee_minor, billing_model, success_fee_bps, free_listing_used, created_at`,
      [
        teacherId,
        body.branchId ?? null,
        body.cityId ?? null,
        body.districtId ?? null,
        body.title.trim(),
        body.description.trim(),
        body.deliveryMode ?? "online",
        body.lessonCount ?? null,
        body.priceMinor ?? 0,
        currency,
        body.capacity ?? null,
        body.startsAt ? new Date(body.startsAt) : null,
        listingFeeMinor,
        billingModel,
        isFirstListing,
      ],
    );

    const campaignId = ins.rows[0].id as string;
    if (listingFeeMinor > 0) {
      await applyWalletDelta({
        userId,
        deltaMinor: -listingFeeMinor,
        kind: "teacher_campaign_listing_fee",
        refType: "teacher_campaign",
        refId: campaignId,
        metadata: {
          campaignId,
          amountMinor: listingFeeMinor,
          currency: "TRY",
        },
        client,
      });
    }

    await client.query("commit");
    return c.json({ campaign: ins.rows[0] }, 201);
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
});

/** Teacher: pause, archive, or resubmit campaign for review. */
teacherCampaigns.patch("/:campaignId/status", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "teacher") return c.json({ error: "forbidden_teachers_only" }, 403);

  const campaignId = c.req.param("campaignId");
  if (!uuidSchema.safeParse(campaignId).success) return c.json({ error: "invalid_campaign_id" }, 400);

  const parsed = patchStatusSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const teacherId = await teacherIdForUser(userId);
  if (!teacherId) return c.json({ error: "teacher_profile_missing" }, 400);

  const r = await pool.query(
    `update teacher_campaigns
     set status = $3::teacher_campaign_status,
         updated_at = now(),
         published_at = case
           when $3::teacher_campaign_status = 'pending_review' then null
           else published_at
         end,
         review_note = case
           when $3::teacher_campaign_status = 'pending_review' then null
           else review_note
         end,
         reviewed_at = case
           when $3::teacher_campaign_status = 'pending_review' then null
           else reviewed_at
         end
     where id = $1 and teacher_id = $2
     returning id, status, updated_at`,
    [campaignId, teacherId, parsed.data.status],
  );
  if (!r.rowCount) return c.json({ error: "not_found_or_forbidden" }, 404);
  return c.json({ campaign: r.rows[0] });
});

/** Teacher: applications for own campaign. */
teacherCampaigns.get("/:campaignId/applications", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "teacher") return c.json({ error: "forbidden_teachers_only" }, 403);

  const campaignId = c.req.param("campaignId");
  if (!uuidSchema.safeParse(campaignId).success) return c.json({ error: "invalid_campaign_id" }, 400);

  const teacherId = await teacherIdForUser(userId);
  if (!teacherId) return c.json({ applications: [] });

  const own = await pool.query(`select 1 from teacher_campaigns where id = $1 and teacher_id = $2`, [
    campaignId,
    teacherId,
  ]);
  if (!own.rowCount) return c.json({ error: "not_found_or_forbidden" }, 404);

  const r = await pool.query(
    `select a.id,
            a.campaign_id,
            a.message,
            a.status,
            a.created_at,
            a.updated_at,
            s.id as student_id,
            u.display_name as student_display_name,
            u.email as student_email
     from teacher_campaign_applications a
     join students s on s.id = a.student_id
     join users u on u.id = s.user_id
     where a.campaign_id = $1
     order by a.created_at desc
     limit 200`,
    [campaignId],
  );
  return c.json({ applications: r.rows });
});

/** Teacher: mark application follow-up status. */
teacherCampaigns.patch("/:campaignId/applications/:applicationId", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "teacher") return c.json({ error: "forbidden_teachers_only" }, 403);

  const campaignId = c.req.param("campaignId");
  const applicationId = c.req.param("applicationId");
  if (!uuidSchema.safeParse(campaignId).success) return c.json({ error: "invalid_campaign_id" }, 400);
  if (!uuidSchema.safeParse(applicationId).success) return c.json({ error: "invalid_application_id" }, 400);

  const parsed = patchApplicationSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const teacherId = await teacherIdForUser(userId);
  if (!teacherId) return c.json({ error: "teacher_profile_missing" }, 400);

  const r = await pool.query(
    `update teacher_campaign_applications a
     set status = $4::teacher_campaign_application_status,
         updated_at = now()
     from teacher_campaigns tc
     where a.id = $1
       and a.campaign_id = $2
       and tc.id = a.campaign_id
       and tc.teacher_id = $3
     returning a.id, a.status, a.updated_at`,
    [applicationId, campaignId, teacherId, parsed.data.status],
  );
  if (!r.rowCount) return c.json({ error: "not_found_or_forbidden" }, 404);
  return c.json({ application: r.rows[0] });
});

/** Admin: campaign moderation queue. */
teacherCampaigns.get("/admin/moderation", requireAuth, async (c) => {
  const denied = assertAdminGate(c);
  if (denied) return denied;

  const statusRaw = c.req.query("status")?.trim();
  const status = z
    .enum(["pending_review", "published", "paused", "archived", "rejected"])
    .safeParse(statusRaw || "pending_review");
  if (!status.success) return c.json({ error: "invalid_status" }, 400);
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? "40") || 40));
  const offset = Math.max(0, Number(c.req.query("offset") ?? "0") || 0);

  const rows = await pool.query(
    `select tc.id,
            tc.status::text as status,
            tc.title,
            tc.description,
            tc.delivery_mode::text as delivery_mode,
            tc.lesson_count,
            tc.price_minor,
            tc.currency,
            tc.billing_model,
            tc.success_fee_bps,
            tc.capacity,
            tc.starts_at,
            tc.listing_fee_minor,
            tc.free_listing_used,
            tc.review_note,
            tc.created_at,
            tc.reviewed_at,
            b.name as branch_name,
            ci.name as city_name,
            u.display_name as teacher_name,
            u.email as teacher_email
     from teacher_campaigns tc
     join teachers t on t.id = tc.teacher_id
     join users u on u.id = t.user_id
     left join branches b on b.id = tc.branch_id
     left join cities ci on ci.id = tc.city_id
     where tc.status = $1::teacher_campaign_status
     order by tc.created_at desc
     limit $2 offset $3`,
    [status.data, limit, offset],
  );
  const total = await pool.query<{ c: number }>(
    `select count(*)::int as c from teacher_campaigns where status = $1::teacher_campaign_status`,
    [status.data],
  );
  return c.json({ campaigns: rows.rows, total: total.rows[0]?.c ?? 0, limit, offset });
});

/** Admin: approve/reject/pause campaign. */
teacherCampaigns.patch("/admin/:campaignId/status", requireAuth, async (c) => {
  const denied = assertAdminGate(c);
  if (denied) return denied;

  const actorUserId = c.get("userId");
  const role = c.get("userRole");
  const campaignId = c.req.param("campaignId");
  if (!uuidSchema.safeParse(campaignId).success) return c.json({ error: "invalid_campaign_id" }, 400);

  const parsed = adminPatchStatusSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const before = await pool.query(
    `select id, status::text as status, title, review_note
     from teacher_campaigns
     where id = $1`,
    [campaignId],
  );
  if (!before.rowCount) return c.json({ error: "campaign_not_found" }, 404);

  const client = await pool.connect();
  try {
    await client.query("begin");
    const updated = await client.query(
      `update teacher_campaigns
       set status = $2::teacher_campaign_status,
           reviewed_by_user_id = $3,
           reviewed_at = now(),
           review_note = $4,
           published_at = case
             when $2::teacher_campaign_status = 'published' then coalesce(published_at, now())
             when $2::teacher_campaign_status in ('pending_review', 'rejected') then null
             else published_at
           end,
           updated_at = now()
       where id = $1
       returning id, status::text as status, reviewed_at, review_note, published_at`,
      [campaignId, parsed.data.status, actorUserId, parsed.data.note?.trim() || null],
    );

    await writeAdminAudit(
      {
        actorUserId,
        actorRole: role,
        requestId: c.req.header("x-request-id") ?? null,
        action: "teacher_campaign.moderation.update",
        entityType: "teacher_campaign",
        entityId: campaignId,
        reason: "teacher_campaign_admin_moderation",
        before: before.rows[0] as Record<string, unknown>,
        after: updated.rows[0] as Record<string, unknown>,
      },
      client,
    );

    await client.query("commit");
    return c.json({ campaign: updated.rows[0] });
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
});

/** Student: apply/contact for a published campaign. */
teacherCampaigns.post("/:campaignId/applications", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "student") return c.json({ error: "forbidden_students_only" }, 403);

  const campaignId = c.req.param("campaignId");
  if (!uuidSchema.safeParse(campaignId).success) return c.json({ error: "invalid_campaign_id" }, 400);

  const parsed = applySchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const studentId = await studentIdForUser(userId);
  if (!studentId) return c.json({ error: "student_profile_missing" }, 400);

  const campaign = await pool.query<{ teacher_id: string; teacher_user_id: string; title: string }>(
    `select tc.teacher_id, t.user_id as teacher_user_id, tc.title
     from teacher_campaigns tc
     join teachers t on t.id = tc.teacher_id
     where tc.id = $1 and tc.status = 'published'`,
    [campaignId],
  );
  if (!campaign.rowCount) return c.json({ error: "not_found" }, 404);

  try {
    const ins = await pool.query(
      `insert into teacher_campaign_applications (campaign_id, student_id, message)
       values ($1, $2, $3)
       returning id, campaign_id, status, created_at`,
      [campaignId, studentId, parsed.data.message?.trim() || null],
    );

    await pool.query(
      `insert into parent_notifications (
         recipient_user_id, student_id, snapshot_id, channel,
         title, body, payload_jsonb, delivery_status, sent_at
       ) values ($1, $2, null, 'in_app', $3, $4, $5::jsonb, 'sent', now())`,
      [
        campaign.rows[0].teacher_user_id,
        studentId,
        "Yeni kampanya başvurusu",
        `"${campaign.rows[0].title}" kampanyanıza yeni bir öğrenci ilgi kaydı bıraktı.`,
        JSON.stringify({
          kind: "teacher_campaign_application",
          campaignId,
          applicationId: ins.rows[0].id,
        }),
      ],
    );

    return c.json({ application: ins.rows[0] }, 201);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "23505") return c.json({ error: "already_applied" }, 409);
    throw e;
  }
});

/** Public/student: published campaigns list. */
teacherCampaigns.get("/", async (c) => {
  const parsed = listSchema.safeParse({
    q: c.req.query("q") || undefined,
    branchId: c.req.query("branchId"),
    cityId: c.req.query("cityId"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const { q, branchId, cityId, limit, offset } = parsed.data;
  const params: unknown[] = [];
  let i = 1;
  let where = `where tc.status = 'published'`;
  if (q?.trim()) {
    where += ` and (tc.title ilike $${i} or tc.description ilike $${i})`;
    params.push(`%${q.trim()}%`);
    i++;
  }
  if (branchId != null) {
    where += ` and tc.branch_id = $${i++}`;
    params.push(branchId);
  }
  if (cityId != null) {
    where += ` and tc.city_id = $${i++}`;
    params.push(cityId);
  }
  params.push(limit, offset);
  const limitPh = `$${i}`;
  const offsetPh = `$${i + 1}`;

  const r = await pool.query(
    `select tc.id,
            tc.title,
            tc.description,
            tc.delivery_mode,
            tc.lesson_count,
            tc.price_minor,
            tc.currency,
            tc.capacity,
            tc.starts_at,
            tc.created_at,
            b.name as branch_name,
            ci.name as city_name,
            t.id as teacher_id,
            u.display_name as teacher_display_name,
            t.rating_avg,
            t.rating_count
     from teacher_campaigns tc
     join teachers t on t.id = tc.teacher_id
     join users u on u.id = t.user_id
     left join branches b on b.id = tc.branch_id
     left join cities ci on ci.id = tc.city_id
     ${where}
     order by tc.created_at desc
     limit ${limitPh} offset ${offsetPh}`,
    params,
  );

  return c.json({ campaigns: r.rows, limit, offset });
});

/** Public/student: published campaign detail. */
teacherCampaigns.get("/:campaignId", async (c) => {
  const campaignId = c.req.param("campaignId");
  if (!uuidSchema.safeParse(campaignId).success) return c.json({ error: "invalid_campaign_id" }, 400);

  const r = await pool.query(
    `select tc.id,
            tc.title,
            tc.description,
            tc.delivery_mode,
            tc.lesson_count,
            tc.price_minor,
            tc.currency,
            tc.capacity,
            tc.starts_at,
            tc.created_at,
            b.name as branch_name,
            ci.name as city_name,
            d.name as district_name,
            t.id as teacher_id,
            u.display_name as teacher_display_name,
            t.rating_avg,
            t.rating_count,
            t.verification_status,
            t.bio_raw
     from teacher_campaigns tc
     join teachers t on t.id = tc.teacher_id
     join users u on u.id = t.user_id
     left join branches b on b.id = tc.branch_id
     left join cities ci on ci.id = tc.city_id
     left join districts d on d.id = tc.district_id
     where tc.id = $1 and tc.status = 'published'`,
    [campaignId],
  );
  if (!r.rowCount) return c.json({ error: "not_found" }, 404);
  return c.json({ campaign: r.rows[0] });
});
