import { Hono } from "hono";
import { z } from "zod";
import { pool } from "../db.js";
import type { AppVariables } from "../types.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { applyWalletDelta } from "../lib/wallet.js";
import { createWalletHold, getWalletAvailableMinor } from "../lib/walletHolds.js";
import { getActiveStudentSubscription } from "../lib/studentSub.js";

async function requestMessageParticipant(
  requestId: string,
  userId: string,
  role: string,
): Promise<"student" | "teacher" | null> {
  if (role === "student") {
    const r = await pool.query(
      `select 1
       from lesson_requests lr
       join students s on s.id = lr.student_id
       where lr.id = $1 and s.user_id = $2`,
      [requestId, userId],
    );
    return r.rowCount ? "student" : null;
  }
  if (role === "teacher") {
    const r = await pool.query(
      `select 1
       from lesson_offers o
       join teachers t on t.id = o.teacher_id
       where o.request_id = $1 and t.user_id = $2`,
      [requestId, userId],
    );
    return r.rowCount ? "teacher" : null;
  }
  return null;
}

export const lessonRequests = new Hono<{ Variables: AppVariables }>();

const createRequestSchema = z.object({
  branchId: z.number().int().positive(),
  topic: z.string().min(2).max(200),
  requestKind: z.enum(["regular", "demo"]).optional().default("regular"),
  targetTeacherId: z.string().uuid().nullable().optional(),
  deliveryMode: z.enum(["online", "in_person", "hybrid"]).optional(),
  cityId: z.number().int().positive().nullable().optional(),
  districtId: z.number().int().positive().nullable().optional(),
  budgetMin: z.number().int().nonnegative().nullable().optional(),
  budgetMax: z.number().int().nonnegative().nullable().optional(),
  availability: z.record(z.string(), z.unknown()).optional(),
  note: z.string().max(5000).nullable().optional(),
  imageUrls: z.array(z.string().min(1).max(2000)).max(8).optional().default([]),
  audioUrl: z.string().min(1).max(2000).nullable().optional(),
});

function shortlistTeacherIdsFromAvailability(value: Record<string, unknown> | undefined): string[] {
  const raw = value?.shortlistTeacherIds;
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  for (const item of raw) {
    const id = typeof item === "string" ? item.trim() : "";
    if (z.string().uuid().safeParse(id).success) seen.add(id);
  }
  return [...seen].slice(0, 10);
}

lessonRequests.post("/", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "student") {
    return c.json({ error: "forbidden_students_only" }, 403);
  }

  const parsed = createRequestSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { budgetMin, budgetMax } = parsed.data;
  const requestKind = parsed.data.requestKind;
  const targetTeacherId = parsed.data.targetTeacherId ?? null;
  const shortlistTeacherIds = shortlistTeacherIdsFromAvailability(parsed.data.availability);
  if (
    (budgetMin != null && budgetMax == null) ||
    (budgetMin == null && budgetMax != null)
  ) {
    return c.json({ error: "budget_min_max_both_required" }, 400);
  }
  if (budgetMin != null && budgetMax != null && budgetMin > budgetMax) {
    return c.json({ error: "budget_min_gt_max" }, 400);
  }
  if (requestKind === "demo" && !targetTeacherId) {
    return c.json({ error: "demo_request_target_teacher_required" }, 400);
  }

  const sub = await getActiveStudentSubscription(userId);
  if (!sub && requestKind !== "demo") {
    return c.json(
      {
        error: "student_platform_subscription_required",
        hint: "Detaylı ders ilanı vermek için aylık platform aboneliği gerekir. Konu (ders) alanı zorunludur.",
      },
      403,
    );
  }

  const sr = await pool.query(`select id from students where user_id = $1`, [
    userId,
  ]);
  if (!sr.rowCount) {
    return c.json({ error: "student_profile_missing" }, 400);
  }
  const studentId = sr.rows[0].id as string;

  if (targetTeacherId) {
    const tr = await pool.query(
      `select 1
       from teachers t
       join teacher_branches tb on tb.teacher_id = t.id
       where t.id = $1 and tb.branch_id = $2
       limit 1`,
      [targetTeacherId, parsed.data.branchId],
    );
    if (!tr.rowCount) {
      return c.json({ error: "target_teacher_branch_not_found" }, 400);
    }
  }

  const ins = await pool.query(
    `insert into lesson_requests (
       student_id, branch_id, city_id, district_id, delivery_mode,
       budget_hourly_range, availability_jsonb, note,
       topic_text, image_urls_jsonb, audio_url,
       request_kind, target_teacher_id
     ) values (
       $1, $2, $3, $4, $5::lesson_delivery_mode,
       case when $6::int is not null and $7::int is not null
            then int4range($6::int, $7::int, '[]')
            else null::int4range
       end,
       $8::jsonb, $9,
       $10, $11::jsonb, $12,
       $13, $14
     )
     returning id, status, created_at`,
    [
      studentId,
      parsed.data.branchId,
      parsed.data.cityId ?? null,
      parsed.data.districtId ?? null,
      parsed.data.deliveryMode ?? "online",
      parsed.data.budgetMin ?? null,
      parsed.data.budgetMax ?? null,
      JSON.stringify(parsed.data.availability ?? {}),
      parsed.data.note ?? null,
      parsed.data.topic.trim(),
      JSON.stringify(parsed.data.imageUrls ?? []),
      parsed.data.audioUrl?.trim() || null,
      requestKind,
      targetTeacherId,
    ],
  );

  const requestId = ins.rows[0].id as string;
  const notifyTeacherIds = [...new Set([...(targetTeacherId ? [targetTeacherId] : []), ...shortlistTeacherIds])];
  if (notifyTeacherIds.length > 0) {
    const recipients = await pool.query(
      `select distinct t.id as teacher_id, t.user_id, u.display_name
       from teachers t
       join users u on u.id = t.user_id
       join teacher_branches tb on tb.teacher_id = t.id
       where t.id = any($1::uuid[])
         and tb.branch_id = $2`,
      [notifyTeacherIds, parsed.data.branchId],
    );
    for (const recipient of recipients.rows as Array<{ teacher_id: string; user_id: string; display_name: string }>) {
      const isTargetDemo = requestKind === "demo" && recipient.teacher_id === targetTeacherId;
      await pool.query(
        `insert into parent_notifications (
           recipient_user_id, student_id, snapshot_id, channel,
           title, body, payload_jsonb, delivery_status, sent_at
         ) values ($1, $2, null, 'in_app', $3, $4, $5::jsonb, 'sent', now())`,
        [
          recipient.user_id,
          studentId,
          isTargetDemo ? "Yeni demo ders talebi" : "Kısa listeli ders talebi",
          isTargetDemo
            ? `"${parsed.data.topic.trim()}" için size özel demo ders talebi geldi.`
            : `"${parsed.data.topic.trim()}" talebinde öğrenci sizi kısa listesine aldı.`,
          JSON.stringify({
            kind: isTargetDemo ? "lesson_request_demo_targeted" : "lesson_request_shortlisted",
            requestId,
            branchId: parsed.data.branchId,
            teacherId: recipient.teacher_id,
          }),
        ],
      );
    }
  }

  return c.json({ request: ins.rows[0] }, 201);
});

/** Öğrenci: kendi taleplerim + teklif sayısı */
lessonRequests.get("/mine", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "student") {
    return c.json({ error: "forbidden_students_only" }, 403);
  }
  const sr = await pool.query(`select id from students where user_id = $1`, [
    userId,
  ]);
  if (!sr.rowCount) return c.json({ requests: [] });
  const studentId = sr.rows[0].id as string;

  const r = await pool.query(
    `select lr.id, lr.status, lr.branch_id, lr.city_id, lr.district_id, lr.delivery_mode,
            lr.request_kind, lr.target_teacher_id, lr.topic_text,
            tu.display_name as target_teacher_display_name,
            lr.created_at,
            (select count(*)::int from lesson_offers o where o.request_id = lr.id) as offers_count
     from lesson_requests lr
     left join teachers tt on tt.id = lr.target_teacher_id
     left join users tu on tu.id = tt.user_id
     where lr.student_id = $1
     order by lr.created_at desc
     limit 50`,
    [studentId],
  );
  return c.json({ requests: r.rows });
});

const listOpenSchema = z.object({
  branchId: z.coerce.number().int().positive().optional(),
  cityId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

/** Öğretmen: açık talepler (market inbox) */
lessonRequests.get("/open", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "teacher") {
    return c.json({ error: "forbidden_teachers_only" }, 403);
  }

  const parsed = listOpenSchema.safeParse({
    branchId: c.req.query("branchId"),
    cityId: c.req.query("cityId"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  const { branchId, cityId, limit, offset } = parsed.data;

  const tr = await pool.query(`select id from teachers where user_id = $1`, [
    userId,
  ]);
  if (!tr.rowCount) {
    return c.json({ requests: [], limit, offset });
  }
  const teacherId = tr.rows[0].id as string;

  const params: unknown[] = [teacherId];
  let i = 2;
  let where = `where lr.status = 'open'
    and (lr.target_teacher_id is null or lr.target_teacher_id = $1)`;
  if (branchId != null) {
    where += ` and lr.branch_id = $${i++}`;
    params.push(branchId);
  }
  if (cityId != null) {
    where += ` and lr.city_id = $${i++}`;
    params.push(cityId);
  }
  params.push(limit, offset);
  const limitPh = `$${i}`;
  const offsetPh = `$${i + 1}`;

  const sql = `
    select lr.id,
           lr.branch_id,
           b.name as branch_name,
           lr.city_id,
           lr.district_id,
           lr.delivery_mode,
           lr.request_kind,
           lr.target_teacher_id,
           lr.topic_text,
           lr.note,
           lr.created_at,
           (
             jsonb_typeof(coalesce(lr.availability_jsonb->'shortlistTeacherIds', '[]'::jsonb)) = 'array'
             and lr.availability_jsonb->'shortlistTeacherIds' ? $1::text
           ) as is_shortlisted_for_teacher,
           (select count(*)::int from lesson_offers o where o.request_id = lr.id) as offers_count
    from lesson_requests lr
    left join branches b on b.id = lr.branch_id
    ${where}
    order by is_shortlisted_for_teacher desc, lr.created_at desc
    limit ${limitPh} offset ${offsetPh}
  `;

  const r = await pool.query(sql, params);
  return c.json({ requests: r.rows, limit, offset });
});

const myOffersSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(30),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

/** Öğretmen: verdiğim teklifler (tüm talepler) */
lessonRequests.get("/my-offers", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "teacher") {
    return c.json({ error: "forbidden_teachers_only" }, 403);
  }

  const parsed = myOffersSchema.safeParse({
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  const { limit, offset } = parsed.data;

  const tr = await pool.query(`select id from teachers where user_id = $1`, [
    userId,
  ]);
  if (!tr.rowCount) {
    return c.json({ offers: [], limit, offset });
  }
  const teacherId = tr.rows[0].id as string;

  const r = await pool.query(
    `select o.id as offer_id,
            o.status as offer_status,
            o.message,
            o.proposed_hourly_rate_minor,
            o.created_at as offer_created_at,
            lr.id as request_id,
            lr.status as request_status,
            lr.branch_id,
            b.name as branch_name,
            lr.city_id,
            lr.delivery_mode,
            lr.request_kind,
            lr.target_teacher_id,
            left(coalesce(lr.note, ''), 220) as request_note_preview,
            lr.created_at as request_created_at,
            lp.id as package_id,
            lp.status::text as package_status,
            lp.payment_status::text as package_payment_status,
            ls.id as first_session_id,
            ls.status::text as first_session_status
     from lesson_offers o
     join lesson_requests lr on lr.id = o.request_id
     left join branches b on b.id = lr.branch_id
     left join lesson_packages lp on lp.source_request_id = lr.id and lp.teacher_id = o.teacher_id
     left join lesson_sessions ls on ls.package_id = lp.id and ls.session_index = 1
     where o.teacher_id = $1
     order by o.created_at desc
     limit $2 offset $3`,
    [teacherId, limit, offset],
  );
  return c.json({ offers: r.rows, limit, offset });
});

/** Öğrenci: açık talebi iptal et */
lessonRequests.post("/:requestId/cancel", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "student") {
    return c.json({ error: "forbidden_students_only" }, 403);
  }
  const requestId = c.req.param("requestId");

  const client = await pool.connect();
  try {
    await client.query("begin");

    const own = await client.query(
      `select lr.id, lr.status
       from lesson_requests lr
       join students s on s.id = lr.student_id
       where lr.id = $1 and s.user_id = $2
       for update`,
      [requestId, userId],
    );
    if (!own.rowCount) {
      await client.query("rollback");
      return c.json({ error: "forbidden_or_not_found" }, 403);
    }
    if (own.rows[0].status !== "open") {
      await client.query("rollback");
      return c.json({ error: "request_not_cancellable" }, 409);
    }

    await client.query(
      `update lesson_offers
       set status = 'rejected', updated_at = now()
       where request_id = $1 and status = 'sent'`,
      [requestId],
    );
    await client.query(
      `update lesson_requests
       set status = 'cancelled', updated_at = now()
       where id = $1`,
      [requestId],
    );

    await client.query("commit");
    return c.json({ ok: true });
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
});

const createOfferSchema = z.object({
  message: z.string().min(1).max(5000),
  proposedHourlyRateMinor: z.number().int().nonnegative().nullable().optional(),
});

/** Öğretmen: talebe teklif ver */
lessonRequests.post("/:requestId/offers", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "teacher") {
    return c.json({ error: "forbidden_teachers_only" }, 403);
  }

  const requestId = c.req.param("requestId");
  const parsed = createOfferSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  /** Varsayılan 1.000.000 TL/saat (kuruş); web öğretmen formu ile uyumlu. */
  const maxHourlyMinor = Number(
    process.env.MAX_PROPOSED_HOURLY_RATE_MINOR ?? "100000000",
  );
  if (
    parsed.data.proposedHourlyRateMinor != null &&
    parsed.data.proposedHourlyRateMinor > maxHourlyMinor
  ) {
    return c.json({ error: "proposed_hourly_rate_too_high" }, 400);
  }

  const tr = await pool.query(
    `select t.id, u.display_name
     from teachers t
     join users u on u.id = t.user_id
     where t.user_id = $1`,
    [userId],
  );
  if (!tr.rowCount) return c.json({ error: "teacher_profile_missing" }, 400);
  const teacherId = tr.rows[0].id as string;
  const teacherDisplayName = (tr.rows[0].display_name as string | undefined) ?? "Öğretmen";

  // Abonelik kontrolü: aktif abonelik varsa ücretsiz; yoksa teklif başına ücret (300 TL)
  const activeSub = await pool.query(
    `select 1
     from teacher_subscriptions s
     where s.teacher_id = $1
       and s.status = 'active'
       and s.expires_at > now()
     limit 1`,
    [teacherId],
  );
  const offerFeeMinor = Number(process.env.OFFER_FEE_MINOR ?? "30000"); // 300 TL
  if (!Number.isFinite(offerFeeMinor) || offerFeeMinor < 0 || offerFeeMinor > 1_000_000_00) {
    return c.json({ error: "offer_fee_invalid" }, 500);
  }

  const client = await pool.connect();
  try {
    await client.query("begin");

    const reqRow = await client.query(
      `select lr.id,
              lr.status,
              lr.request_kind,
              lr.target_teacher_id,
              lr.student_id,
              lr.branch_id,
              lr.topic_text,
              s.user_id as student_user_id
       from lesson_requests lr
       join students s on s.id = lr.student_id
       where lr.id = $1
       for update`,
      [requestId],
    );
    if (!reqRow.rowCount) {
      await client.query("rollback");
      return c.json({ error: "request_not_found" }, 404);
    }
    if (reqRow.rows[0].status !== "open") {
      await client.query("rollback");
      return c.json({ error: "request_not_open" }, 409);
    }
    const targetTeacherId = reqRow.rows[0].target_teacher_id as string | null;
    if (targetTeacherId != null && targetTeacherId !== teacherId) {
      await client.query("rollback");
      return c.json({ error: "request_targeted_to_another_teacher" }, 403);
    }
    const isTargetedDemo =
      reqRow.rows[0].request_kind === "demo" && targetTeacherId === teacherId;

    // Hedefli demo yanıtı ücretsiz; normal taleplerde abonelik yoksa teklif ücreti alınır.
    if (!isTargetedDemo && !activeSub.rowCount && offerFeeMinor > 0) {
      const available = await getWalletAvailableMinor(userId, client);
      if (available < BigInt(offerFeeMinor)) {
        await client.query("rollback");
        return c.json(
          { error: "insufficient_balance", neededMinor: offerFeeMinor },
          409,
        );
      }
      await applyWalletDelta({
        userId,
        deltaMinor: -offerFeeMinor,
        kind: "teacher_offer_fee",
        refType: "lesson_request",
        refId: requestId,
        metadata: { offerFeeMinor },
        client,
      });
    }

    const offer = await client.query(
      `insert into lesson_offers (request_id, teacher_id, message, proposed_hourly_rate_minor)
       values ($1, $2, $3, $4)
       returning id, status, created_at`,
      [
        requestId,
        teacherId,
        parsed.data.message,
        parsed.data.proposedHourlyRateMinor ?? null,
      ],
    );

    await client.query(
      `insert into lesson_request_messages (request_id, offer_id, role, sender_user_id, content)
       values ($1, $2, 'teacher', $3, $4)`,
      [requestId, offer.rows[0].id, userId, parsed.data.message],
    );

    await client.query(
      `insert into parent_notifications (
         recipient_user_id, student_id, snapshot_id, channel,
         title, body, payload_jsonb, delivery_status, sent_at
       ) values ($1, $2, null, 'in_app', $3, $4, $5::jsonb, 'sent', now())`,
      [
        reqRow.rows[0].student_user_id,
        reqRow.rows[0].student_id,
        isTargetedDemo ? "Demo ders yanıtı geldi" : "Yeni ders teklifi geldi",
        isTargetedDemo
          ? `${teacherDisplayName} demo ders talebinize yanıt verdi.`
          : `${teacherDisplayName}, "${reqRow.rows[0].topic_text ?? "ders talebiniz"}" için teklif gönderdi.`,
        JSON.stringify({
          kind: isTargetedDemo ? "lesson_demo_offer_received" : "lesson_offer_received",
          requestId,
          offerId: offer.rows[0].id,
          teacherId,
          branchId: reqRow.rows[0].branch_id,
        }),
      ],
    );

    await client.query("commit");
    return c.json(
      {
        offer: offer.rows[0],
        chargedOfferFeeMinor: !isTargetedDemo && !activeSub.rowCount ? offerFeeMinor : 0,
      },
      201,
    );
  } catch (e) {
    await client.query("rollback").catch(() => {});
    const err = e as { code?: string };
    if (err.code === "23505") {
      return c.json({ error: "offer_already_sent" }, 409);
    }
    throw e;
  } finally {
    client.release();
  }
});

/** Öğrenci: bir talebin teklifleri */
lessonRequests.get("/:requestId/offers", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  const requestId = c.req.param("requestId");
  if (role !== "student") {
    return c.json({ error: "forbidden_students_only" }, 403);
  }

  const own = await pool.query(
    `select 1
     from lesson_requests lr
     join students s on s.id = lr.student_id
     where lr.id = $1 and s.user_id = $2`,
    [requestId, userId],
  );
  if (!own.rowCount) return c.json({ error: "forbidden_or_not_found" }, 403);

  const r = await pool.query(
    `with enriched as (
       select o.id,
              o.teacher_id,
              o.status,
              o.message,
              o.proposed_hourly_rate_minor,
              o.created_at,
              u.display_name,
              t.rating_avg,
              t.rating_count,
              t.verification_status::text as verification_status,
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
                select count(*)::int
                from lesson_sessions ls
                join lesson_packages lp on lp.id = ls.package_id
                where lp.teacher_id = t.id and ls.status = 'completed'
              ) as completed_sessions_count,
              (
                jsonb_typeof(coalesce(lr.availability_jsonb->'shortlistTeacherIds', '[]'::jsonb)) = 'array'
                and lr.availability_jsonb->'shortlistTeacherIds' ? o.teacher_id::text
              ) as is_shortlisted_teacher,
              greatest(0, floor(extract(epoch from (o.created_at - lr.created_at)) / 60))::int as response_minutes,
              min(o.proposed_hourly_rate_minor) filter (where o.proposed_hourly_rate_minor is not null) over () as lowest_proposed_hourly_rate_minor
       from lesson_offers o
       join lesson_requests lr on lr.id = o.request_id
       join teachers t on t.id = o.teacher_id
       join users u on u.id = t.user_id
       where o.request_id = $1
     )
     select *,
            (
              (profile_quality_score * 0.45) +
              (coalesce(rating_avg, 3.5)::numeric * 8) +
              least(completed_sessions_count, 20) +
              case when verification_status = 'verified' then 8 else 0 end +
              case when has_video then 5 else 0 end +
              case when is_shortlisted_teacher then 6 else 0 end +
              case
                when proposed_hourly_rate_minor is not null
                 and lowest_proposed_hourly_rate_minor is not null
                 and proposed_hourly_rate_minor = lowest_proposed_hourly_rate_minor
                then 8
                else 0
              end +
              case
                when response_minutes <= 60 then 8
                when response_minutes <= 240 then 4
                else 0
              end
            )::int as comparison_score
     from enriched
     order by
       case status when 'sent' then 0 when 'accepted' then 1 else 2 end,
       comparison_score desc,
       created_at asc`,
    [requestId],
  );
  return c.json({ offers: r.rows });
});

const decideOfferSchema = z.object({
  decision: z.enum(["accept", "reject"]),
  packageLessonCount: z.number().int().min(1).max(60).optional(),
  lessonDurationMinutes: z.number().int().min(30).max(180).optional(),
});

/** Öğrenci: teklifi kabul/ret (kabul → request matched) */
lessonRequests.post("/:requestId/offers/:offerId/decide", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "student") {
    return c.json({ error: "forbidden_students_only" }, 403);
  }
  const requestId = c.req.param("requestId");
  const offerId = c.req.param("offerId");
  const parsed = decideOfferSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const client = await pool.connect();
  try {
    await client.query("begin");

    const own = await client.query(
      `select lr.id,
              lr.delivery_mode,
              lr.student_id,
              lr.request_kind,
              lr.topic_text,
              su.display_name as student_display_name
       from lesson_requests lr
       join students s on s.id = lr.student_id
       join users su on su.id = s.user_id
       where lr.id = $1 and s.user_id = $2
       for update`,
      [requestId, userId],
    );
    if (!own.rowCount) {
      await client.query("rollback");
      return c.json({ error: "forbidden_or_not_found" }, 403);
    }

    const offerRow = await client.query(
      `select o.id,
              o.status,
              o.teacher_id,
              o.proposed_hourly_rate_minor,
              t.user_id as teacher_user_id
       from lesson_offers o
       join teachers t on t.id = o.teacher_id
       where o.id = $1 and o.request_id = $2
       for update`,
      [offerId, requestId],
    );
    if (!offerRow.rowCount) {
      await client.query("rollback");
      return c.json({ error: "offer_not_found" }, 404);
    }
    if (offerRow.rows[0].status !== "sent") {
      await client.query("rollback");
      return c.json({ error: "offer_not_pending" }, 409);
    }

    const decision = parsed.data.decision;
    const studentDisplayName = (own.rows[0].student_display_name as string | undefined) ?? "Öğrenci";
    const requestTopic = (own.rows[0].topic_text as string | null) ?? "ders talebi";
    if (decision === "reject") {
      await client.query(
        `update lesson_offers set status = 'rejected', updated_at = now() where id = $1`,
        [offerId],
      );
      await client.query(
        `insert into parent_notifications (
           recipient_user_id, student_id, snapshot_id, channel,
           title, body, payload_jsonb, delivery_status, sent_at
         ) values ($1, $2, null, 'in_app', $3, $4, $5::jsonb, 'sent', now())`,
        [
          offerRow.rows[0].teacher_user_id,
          own.rows[0].student_id,
          "Teklifiniz reddedildi",
          `${studentDisplayName}, "${requestTopic}" teklifinizi reddetti.`,
          JSON.stringify({
            kind: "lesson_offer_rejected",
            requestId,
            offerId,
            teacherId: offerRow.rows[0].teacher_id,
          }),
        ],
      );
      await client.query("commit");
      return c.json({ ok: true });
    }

    await client.query(
      `update lesson_offers set status = 'accepted', updated_at = now() where id = $1`,
      [offerId],
    );
    await client.query(
      `update lesson_requests set status = 'matched', updated_at = now() where id = $1`,
      [requestId],
    );
    const autoRejectedOffers = await client.query(
      `update lesson_offers
       set status = 'rejected', updated_at = now()
       where request_id = $1 and id <> $2 and status = 'sent'`,
      [requestId, offerId],
    );

    // Kabul edilen teklif → ders paketi + ilk ders oturumu (online ders akışını başlatır)
    const isDemoRequest = own.rows[0].request_kind === "demo";
    const defaultTotal = Number(process.env.DEFAULT_PACKAGE_TOTAL_LESSONS ?? "4");
    const totalLessons =
      parsed.data.packageLessonCount ??
      (isDemoRequest ? 1 : Number.isFinite(defaultTotal) && defaultTotal > 0 ? defaultTotal : 4);
    const durationMinutes = parsed.data.lessonDurationMinutes ?? (isDemoRequest ? 30 : 60);

    const studentId = own.rows[0].student_id as string;
    const teacherId = offerRow.rows[0].teacher_id as string;
    const hourlyRateMinor = Number(offerRow.rows[0].proposed_hourly_rate_minor ?? 0);
    const totalAmountMinor =
      Number.isFinite(hourlyRateMinor) && hourlyRateMinor > 0
        ? Math.round(hourlyRateMinor * totalLessons * (durationMinutes / 60))
        : 0;
    const deliveryMode = (own.rows[0].delivery_mode as string) ?? "online";

    if (totalAmountMinor > 0) {
      const available = await getWalletAvailableMinor(userId, client);
      if (available < BigInt(totalAmountMinor)) {
        await client.query("rollback");
        return c.json(
          {
            error: "insufficient_wallet_available",
            requiredMinor: totalAmountMinor,
            availableMinor: available.toString(),
          },
          409,
        );
      }
    }

    const pkg = await client.query(
      `insert into lesson_packages (
         teacher_id, student_id, total_lessons, completed_lessons,
         status, payment_status, currency, total_amount_minor, escrow_release_policy_jsonb,
         source_request_id, request_kind
       ) values ($1, $2, $3, 0, 'active', $6::payment_status, 'TRY', $7, $8::jsonb, $4, $5)
       returning id`,
      [
        teacherId,
        studentId,
        totalLessons,
        requestId,
        isDemoRequest ? "demo" : "regular",
        totalAmountMinor > 0 ? "held_in_escrow" : "pending",
        totalAmountMinor,
        JSON.stringify({
          method: totalAmountMinor > 0 ? "student_wallet_hold" : "manual_followup",
          release: "per_completed_lesson",
          lessonDurationMinutes: durationMinutes,
          hourlyRateMinor,
        }),
      ],
    );
    const packageId = pkg.rows[0].id as string;

    let holdId: string | null = null;
    if (totalAmountMinor > 0) {
      const hold = await createWalletHold(
        {
          userId,
          amountMinor: totalAmountMinor,
          reason: "lesson_package_escrow",
          refType: "lesson_packages",
          refId: packageId,
        },
        client,
      );
      holdId = hold.holdId;
      await client.query(
        `insert into payment_ledger_entries (
           package_id, amount_minor, currency, entry_type, external_ref, metadata_jsonb
         ) values ($1, $2, 'TRY', 'wallet_hold_created', $3, $4::jsonb)`,
        [
          packageId,
          totalAmountMinor,
          holdId,
          JSON.stringify({
            offerId,
            requestId,
            hourlyRateMinor,
            totalLessons,
            durationMinutes,
          }),
        ],
      );
    }

    const sess = await client.query(
      `insert into lesson_sessions (
         package_id, session_index, scheduled_start, duration_minutes, delivery_mode, status
       ) values ($1, 1, null, $2, $3::lesson_delivery_mode, 'scheduled')
       returning id`,
      [packageId, durationMinutes, deliveryMode],
    );
    const lessonSessionId = sess.rows[0].id as string;

    await client.query(
      `insert into parent_notifications (
         recipient_user_id, student_id, snapshot_id, channel,
         title, body, payload_jsonb, delivery_status, sent_at
       ) values ($1, $2, null, 'in_app', $3, $4, $5::jsonb, 'sent', now())`,
      [
        offerRow.rows[0].teacher_user_id,
        studentId,
        isDemoRequest ? "Demo teklifiniz kabul edildi" : "Teklifiniz kabul edildi",
        `${studentDisplayName}, "${requestTopic}" teklifinizi kabul etti. Paket ve ilk ders oturumu oluşturuldu.`,
        JSON.stringify({
          kind: "lesson_offer_accepted",
          requestId,
          offerId,
          packageId,
          lessonSessionId,
          teacherId,
        }),
      ],
    );

    if ((autoRejectedOffers.rowCount ?? 0) > 0) {
      await client.query(
        `insert into parent_notifications (
           recipient_user_id, student_id, snapshot_id, channel,
           title, body, payload_jsonb, delivery_status, sent_at
         )
         select t.user_id,
                $2,
                null,
                'in_app',
                'Talep başka öğretmenle eşleşti',
                $3,
                jsonb_build_object(
                  'kind', 'lesson_offer_matched_elsewhere',
                  'requestId', $1::uuid,
                  'teacherId', o.teacher_id
                ),
                'sent',
                now()
         from lesson_offers o
         join teachers t on t.id = o.teacher_id
         where o.request_id = $1
           and o.id <> $4
           and o.status = 'rejected'
           and o.updated_at >= now() - interval '1 minute'`,
        [
          requestId,
          studentId,
          `${studentDisplayName}, "${requestTopic}" talebinde başka bir teklifi kabul etti.`,
          offerId,
        ],
      );
    }

    await client.query("commit");
    return c.json({
      ok: true,
      packageId,
      lessonSessionId,
      payment: {
        status: totalAmountMinor > 0 ? "held_in_escrow" : "pending",
        totalAmountMinor,
        holdId,
      },
      package: {
        totalLessons,
        durationMinutes,
      },
    });
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
});

/** Öğretmen: gönderilmiş teklifi geri çek (talep hâlâ açıksa) */
lessonRequests.post(
  "/:requestId/offers/:offerId/withdraw",
  requireAuth,
  async (c) => {
    const userId = c.get("userId");
    const role = c.get("userRole");
    if (role !== "teacher") {
      return c.json({ error: "forbidden_teachers_only" }, 403);
    }
    const requestId = c.req.param("requestId");
    const offerId = c.req.param("offerId");

    const client = await pool.connect();
    try {
      await client.query("begin");

      const tr = await client.query(
        `select id from teachers where user_id = $1 for update`,
        [userId],
      );
      if (!tr.rowCount) {
        await client.query("rollback");
        return c.json({ error: "teacher_profile_missing" }, 400);
      }
      const teacherId = tr.rows[0].id as string;

      const reqRow = await client.query(
        `select id, status from lesson_requests where id = $1 for update`,
        [requestId],
      );
      if (!reqRow.rowCount) {
        await client.query("rollback");
        return c.json({ error: "request_not_found" }, 404);
      }
      if (reqRow.rows[0].status !== "open") {
        await client.query("rollback");
        return c.json({ error: "request_not_open" }, 409);
      }

      const off = await client.query(
        `select id, status from lesson_offers
         where id = $1 and request_id = $2 and teacher_id = $3
         for update`,
        [offerId, requestId, teacherId],
      );
      if (!off.rowCount) {
        await client.query("rollback");
        return c.json({ error: "offer_not_found" }, 404);
      }
      if (off.rows[0].status !== "sent") {
        await client.query("rollback");
        return c.json({ error: "offer_not_withdrawable" }, 409);
      }

      await client.query(
        `update lesson_offers
         set status = 'withdrawn', updated_at = now()
         where id = $1`,
        [offerId],
      );

      await client.query("commit");
      return c.json({ ok: true });
    } catch (e) {
      await client.query("rollback").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  },
);

const postRequestMessageSchema = z.object({
  content: z.string().min(1).max(5000),
});

/** Öğrenci veya (teklif vermiş) öğretmen: talep mesaj thread'i */
lessonRequests.get("/:requestId/messages", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  const requestId = c.req.param("requestId");

  const part = await requestMessageParticipant(requestId, userId, role);
  if (!part) {
    return c.json({ error: "forbidden_or_not_found" }, 403);
  }

  const reqRow = await pool.query(`select id from lesson_requests where id = $1`, [
    requestId,
  ]);
  if (!reqRow.rowCount) return c.json({ error: "request_not_found" }, 404);

  const r = await pool.query(
    `select m.id,
            m.role,
            m.content,
            m.created_at,
            u.display_name as sender_display_name
     from lesson_request_messages m
     left join users u on u.id = m.sender_user_id
     where m.request_id = $1
     order by m.created_at asc`,
    [requestId],
  );
  return c.json({ messages: r.rows });
});

lessonRequests.post("/:requestId/messages", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  const requestId = c.req.param("requestId");
  const parsed = postRequestMessageSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const part = await requestMessageParticipant(requestId, userId, role);
  if (!part) {
    return c.json({ error: "forbidden_or_not_found" }, 403);
  }

  const st = await pool.query(`select status from lesson_requests where id = $1`, [
    requestId,
  ]);
  if (!st.rowCount) return c.json({ error: "request_not_found" }, 404);
  const status = st.rows[0].status as string;
  if (status !== "open" && status !== "matched") {
    return c.json({ error: "request_not_messageable" }, 409);
  }

  const msgRole = part === "student" ? "student" : "teacher";
  const ins = await pool.query(
    `insert into lesson_request_messages (request_id, offer_id, role, sender_user_id, content)
     values ($1, null, $2::request_message_role, $3, $4)
     returning id, role, content, created_at`,
    [requestId, msgRole, userId, parsed.data.content],
  );

  return c.json({ message: ins.rows[0] }, 201);
});

