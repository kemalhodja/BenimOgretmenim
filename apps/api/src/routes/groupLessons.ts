import { Hono } from "hono";
import { z } from "zod";
import type { AppVariables } from "../types.js";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { applyWalletDelta } from "../lib/wallet.js";
import {
  createWalletHold,
  getWalletAvailableMinor,
  reduceWalletHoldAmount,
} from "../lib/walletHolds.js";

export const groupLessons = new Hono<{ Variables: AppVariables }>();

const TOTAL_PRICE_MINOR = 100_000; // 1000 TL
const PLATFORM_FEE_BPS = 500; // %5

function ceilDiv(a: number, b: number): number {
  return Math.floor((a + b - 1) / b);
}

groupLessons.get("/teacher/open", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "teacher") return c.json({ error: "forbidden_teachers_only" }, 403);

  const tr = await pool.query(`select id from teachers where user_id = $1`, [userId]);
  if (!tr.rowCount) return c.json({ requests: [] });
  const teacherId = tr.rows[0].id as string;

  const r = await pool.query(
    `select r.id, r.branch_id, b.name as branch_name, r.topic_text, r.teacher_id,
            r.total_price_minor, r.currency, r.planned_start, r.status,
            (select count(*)::int from group_lesson_participants p where p.request_id = r.id) as participants_count
     from group_lesson_requests r
     left join branches b on b.id = r.branch_id
     where r.status in ('open', 'teacher_assigned', 'scheduled')
       and r.planned_start > now()
       and (r.teacher_id is null or r.teacher_id = $1)
     order by r.planned_start asc
     limit 80`,
    [teacherId],
  );

  return c.json({ requests: r.rows });
});

groupLessons.post("/:id/teacher-accept", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "teacher") return c.json({ error: "forbidden_teachers_only" }, 403);

  const requestId = c.req.param("id");
  const client = await pool.connect();
  try {
    await client.query("begin");
    const tr = await client.query(`select id from teachers where user_id = $1`, [userId]);
    if (!tr.rowCount) return c.json({ error: "teacher_profile_missing" }, 400);
    const teacherId = tr.rows[0].id as string;

    const rr = await client.query(
      `select id, teacher_id, status
       from group_lesson_requests
       where id = $1
       for update`,
      [requestId],
    );
    if (!rr.rowCount) return c.json({ error: "not_found" }, 404);
    const row = rr.rows[0] as { teacher_id: string | null; status: string };

    if (!["open", "teacher_assigned", "scheduled"].includes(row.status)) {
      await client.query("rollback");
      return c.json({ error: "not_accepting" }, 409);
    }

    if (row.teacher_id && row.teacher_id !== teacherId) {
      await client.query("rollback");
      return c.json({ error: "forbidden_teacher_mismatch" }, 403);
    }

    await client.query(
      `update group_lesson_requests
       set teacher_id = coalesce(teacher_id, $2),
           status = case when status = 'open' then 'teacher_assigned' else status end,
           updated_at = now()
       where id = $1`,
      [requestId, teacherId],
    );
    await client.query("commit");
    return c.json({ ok: true }, 200);
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
});

const createSchema = z.object({
  branchId: z.number().int().positive(),
  topic: z.string().min(2).max(200),
  teacherId: z.string().uuid().optional().nullable(),
  plannedStart: z.string().min(10), // ISO string
});

groupLessons.post("/", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "student") return c.json({ error: "forbidden_students_only" }, 403);

  const parsed = createSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const planned = new Date(parsed.data.plannedStart);
  if (!Number.isFinite(planned.getTime())) return c.json({ error: "planned_start_invalid" }, 400);

  const client = await pool.connect();
  try {
    await client.query("begin");

    const sr = await client.query(`select id from students where user_id = $1`, [userId]);
    if (!sr.rowCount) return c.json({ error: "student_profile_missing" }, 400);
    const studentId = sr.rows[0].id as string;

    let teacherId: string | null = parsed.data.teacherId?.trim() || null;
    if (teacherId) {
      const tr = await client.query(
        `select 1
         from teachers t join users u on u.id = t.user_id
         where t.id = $1 and u.role = 'teacher'`,
        [teacherId],
      );
      if (!tr.rowCount) teacherId = null;
    }

    const reqIns = await client.query(
      `insert into group_lesson_requests (
         created_by_student_id, branch_id, topic_text, teacher_id,
         total_price_minor, planned_start, status
       ) values ($1, $2, $3, $4, $5, $6, $7)
       returning id, status, planned_start, total_price_minor, currency`,
      [
        studentId,
        parsed.data.branchId,
        parsed.data.topic.trim(),
        teacherId,
        TOTAL_PRICE_MINOR,
        planned.toISOString(),
        teacherId ? "teacher_assigned" : "open",
      ],
    );
    const requestId = reqIns.rows[0].id as string;

    // Oluşturan öğrenci otomatik katılır: 1 kişi → pay = 1000 TL
    const share = TOTAL_PRICE_MINOR;
    const available = await getWalletAvailableMinor(userId, client);
    if (available < BigInt(share)) {
      await client.query("rollback");
      return c.json({ error: "insufficient_balance", neededMinor: share }, 409);
    }
    const hold = await createWalletHold(
      {
        userId,
        amountMinor: share,
        reason: "group_lesson_join",
        refType: "group_lesson_request",
        refId: requestId,
      },
      client,
    );
    await client.query(
      `insert into group_lesson_participants (
         request_id, student_id, hold_id, hold_amount_minor
       ) values ($1, $2, $3, $4::bigint)`,
      [requestId, studentId, hold.holdId, String(share)],
    );

    await client.query("commit");
    return c.json({ request: reqIns.rows[0], participant: { shareMinor: share } }, 201);
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
});

groupLessons.get("/open", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "student") return c.json({ error: "forbidden_students_only" }, 403);
  const r = await pool.query(
    `select r.id, r.branch_id, b.name as branch_name, r.topic_text, r.teacher_id,
            r.total_price_minor, r.currency, r.planned_start, r.status,
            (select count(*)::int from group_lesson_participants p where p.request_id = r.id) as participants_count
     from group_lesson_requests r
     left join branches b on b.id = r.branch_id
     where r.status in ('open', 'teacher_assigned', 'scheduled')
       and r.planned_start > now()
     order by r.planned_start asc
     limit 50`,
  );
  // userId currently unused; keep for potential personalization
  void userId;
  return c.json({ requests: r.rows });
});

groupLessons.post("/:id/join", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "student") return c.json({ error: "forbidden_students_only" }, 403);

  const requestId = c.req.param("id");

  const client = await pool.connect();
  try {
    await client.query("begin");

    const sr = await client.query(`select id from students where user_id = $1`, [userId]);
    if (!sr.rowCount) return c.json({ error: "student_profile_missing" }, 400);
    const studentId = sr.rows[0].id as string;

    const reqRow = await client.query(
      `select id, status, total_price_minor, planned_start
       from group_lesson_requests
       where id = $1
       for update`,
      [requestId],
    );
    if (!reqRow.rowCount) return c.json({ error: "not_found" }, 404);
    const status = reqRow.rows[0].status as string;
    if (!["open", "teacher_assigned", "scheduled"].includes(status)) {
      return c.json({ error: "not_joinable" }, 409);
    }
    // Derse 1 saat kala katılım kapanır (tahsilat penceresi)
    const plannedStart = new Date(String(reqRow.rows[0].planned_start));
    if (!Number.isFinite(plannedStart.getTime())) {
      return c.json({ error: "planned_start_invalid" }, 400);
    }
    if (plannedStart.getTime() <= Date.now() + 60 * 60 * 1000) {
      return c.json({ error: "join_closed" }, 409);
    }

    const already = await client.query(
      `select 1 from group_lesson_participants where request_id = $1 and student_id = $2`,
      [requestId, studentId],
    );
    if (already.rowCount) {
      await client.query("rollback");
      return c.json({ ok: true, alreadyJoined: true });
    }

    const cnt = await client.query(
      `select count(*)::int as c from group_lesson_participants where request_id = $1`,
      [requestId],
    );
    const current = Number(cnt.rows[0].c ?? 0);
    const nAfter = current + 1;
    const total = Number(reqRow.rows[0].total_price_minor ?? TOTAL_PRICE_MINOR);
    const share = ceilDiv(total, nAfter);

    const available = await getWalletAvailableMinor(userId, client);
    if (available < BigInt(share)) {
      await client.query("rollback");
      return c.json({ error: "insufficient_balance", neededMinor: share }, 409);
    }

    const hold = await createWalletHold(
      {
        userId,
        amountMinor: share,
        reason: "group_lesson_join",
        refType: "group_lesson_request",
        refId: requestId,
      },
      client,
    );
    await client.query(
      `insert into group_lesson_participants (
         request_id, student_id, hold_id, hold_amount_minor
       ) values ($1, $2, $3, $4::bigint)`,
      [requestId, studentId, hold.holdId, String(share)],
    );

    await client.query("commit");
    return c.json({ ok: true, shareMinor: share }, 201);
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
});

/**
 * Ders bitti: blokajları serbest bırak.
 * Not: Tahsilat (1 gün önce) yapılmışsa hold tutarı kalan blokajı temsil eder.
 */
groupLessons.post("/:id/complete", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  const requestId = c.req.param("id");

  const client = await pool.connect();
  try {
    await client.query("begin");

    const rr = await client.query(
      `select id, teacher_id, status
       from group_lesson_requests
       where id = $1
       for update`,
      [requestId],
    );
    if (!rr.rowCount) return c.json({ error: "not_found" }, 404);
    const row = rr.rows[0] as { teacher_id: string | null; status: string };

    let canComplete = false;
    if (role === "admin") {
      canComplete = true;
    } else if (role === "teacher") {
      const tr = await client.query(`select id from teachers where user_id = $1`, [userId]);
      const teacherId = tr.rows[0]?.id as string | undefined;
      if (teacherId && row.teacher_id && teacherId === row.teacher_id) {
        canComplete = true;
      }
    }
    if (!canComplete) return c.json({ error: "forbidden" }, 403);

    if (row.status === "completed") {
      await client.query("rollback");
      return c.json({ ok: true, alreadyCompleted: true });
    }

    await client.query(
      `update group_lesson_requests
       set status = 'completed', updated_at = now()
       where id = $1`,
      [requestId],
    );

    // Tüm aktif hold'ları serbest bırak (kalan blokaj dahil).
    await client.query(
      `update user_wallet_holds h
       set status = 'released', updated_at = now()
       where h.status = 'active'
         and h.id in (
           select p.hold_id
           from group_lesson_participants p
           where p.request_id = $1
         )`,
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

/**
 * Tahsilat: planlanan dersten 1 gün önce çalışacak job tarafından çağrılır.
 * - Final katılımcı sayısına göre pay = ceil(total / n)
 * - Her katılımcının hold'u >= bu pay (n artar, pay azalır)
 * - Pay kadar cüzdandan düşülür (ledger)
 * - Hold, ders bitimine kadar kalkmasın: (held - pay) kadar blokaj aktif kalır
 */
export async function settleGroupLessonRequest(requestId: string) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const rr = await client.query(
      `select id, total_price_minor, charged_at
       from group_lesson_requests
       where id = $1
       for update`,
      [requestId],
    );
    if (!rr.rowCount) {
      await client.query("rollback");
      return { ok: false as const, error: "not_found" as const };
    }
    if (rr.rows[0].charged_at) {
      await client.query("rollback");
      return { ok: true as const, alreadyCharged: true as const };
    }

    const participants = await client.query(
      `select p.id as participant_id, p.student_id, p.hold_id, p.hold_amount_minor,
              u.id as user_id
       from group_lesson_participants p
       join students s on s.id = p.student_id
       join users u on u.id = s.user_id
       where p.request_id = $1
       for update`,
      [requestId],
    );
    const n = participants.rowCount ?? 0;
    if (n <= 0) {
      await client.query("rollback");
      return { ok: false as const, error: "no_participants" as const };
    }
    const total = Number(rr.rows[0].total_price_minor ?? TOTAL_PRICE_MINOR);
    const share = ceilDiv(total, n);
    const platformFeeMinor = Math.round((total * PLATFORM_FEE_BPS) / 10_000);
    const teacherNetMinor = Math.max(0, total - platformFeeMinor);

    let chargedTotal = 0;
    for (const row of participants.rows as Array<Record<string, unknown>>) {
      const userId = String(row.user_id);
      const holdId = String(row.hold_id);
      const held = BigInt(String(row.hold_amount_minor));
      const needed = BigInt(share);

      if (held < needed) {
        throw new Error("hold_insufficient_for_share");
      }

      // Hold'u tükettiğimizi işaretle (charged) ve cüzdandan düş
      await applyWalletDelta({
        userId,
        deltaMinor: -share,
        kind: "group_lesson_charge",
        refType: "group_lesson_request",
        refId: requestId,
        metadata: {
          participants: n,
          shareMinor: share,
          totalPriceMinor: total,
          platformFeeBps: PLATFORM_FEE_BPS,
          platformFeeMinor,
          teacherNetMinor,
        },
        client,
      });
      chargedTotal += share;
      // Ders bitimine kadar blokaj kalsın: fazla tutarı (held - share) aktif tut.
      // Share kadar tahsil edildiği için hold amount'u azaltıyoruz.
      await reduceWalletHoldAmount({ holdId, newAmountMinor: held - needed }, client);

      await client.query(
        `update group_lesson_participants
         set charged_at = now(), charged_amount_minor = $2::bigint
         where id = $1`,
        [String(row.participant_id), String(share)],
      );
    }

    await client.query(
      `update group_lesson_requests
       set charged_at = now(), charged_total_minor = $2, updated_at = now()
       where id = $1`,
      [requestId, chargedTotal],
    );
    await client.query("commit");
    return {
      ok: true as const,
      participants: n,
      shareMinor: share,
      chargedTotalMinor: chargedTotal,
      platformFeeMinor,
      teacherNetMinor,
      platformFeeBps: PLATFORM_FEE_BPS,
    };
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

