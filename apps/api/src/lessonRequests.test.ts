import { describe, expect, it } from "vitest";
import { app } from "./app.js";
import { signAccessToken } from "./auth/jwt.js";
import { pool } from "./db.js";
import { applyWalletDelta } from "./lib/wallet.js";

async function lessonRequestTablesAvailable(): Promise<boolean> {
  const health = await app.request("http://localhost/health");
  if (health.status !== 200) return false;
  const r = await pool.query<{ exists: boolean }>(
    `select to_regclass('public.lesson_requests') is not null
        and to_regclass('public.lesson_offers') is not null
        and to_regclass('public.student_guardians') is not null
        and to_regclass('public.parent_notifications') is not null
        and to_regclass('public.teacher_subscriptions') is not null
        and exists (
          select 1 from information_schema.columns
          where table_schema = 'public'
            and table_name = 'lesson_requests'
            and column_name = 'topic_text'
        ) as exists`,
  );
  return r.rows[0]?.exists === true;
}

async function ensureBranch(suffix: string): Promise<number> {
  const r = await pool.query<{ id: number }>(
    `insert into branches (name, slug)
     values ($1, $2)
     on conflict (slug) do update set name = excluded.name
     returning id`,
    [`Armut Test ${suffix}`, `armut-test-${suffix}`],
  );
  return r.rows[0].id;
}

async function createUser(role: "student" | "guardian" | "teacher", suffix: string) {
  const r = await pool.query<{ id: string }>(
    `insert into users (email, display_name, role)
     values ($1, $2, $3)
     returning id`,
    [`armut-${role}-${suffix}@example.test`, `Armut ${role} ${suffix}`, role],
  );
  const userId = r.rows[0].id;
  const token = await signAccessToken({ userId, role });
  return { userId, token };
}

async function createStudent(suffix: string) {
  const user = await createUser("student", suffix);
  const r = await pool.query<{ id: string }>(
    `insert into students (user_id) values ($1) returning id`,
    [user.userId],
  );
  return { ...user, studentId: r.rows[0].id };
}

async function createGuardian(suffix: string) {
  return createUser("guardian", suffix);
}

async function createTeacher(suffix: string, branchId: number, activeSubscription = false) {
  const user = await createUser("teacher", suffix);
  const r = await pool.query<{ id: string }>(
    `insert into teachers (user_id, verification_status)
     values ($1, 'verified')
     returning id`,
    [user.userId],
  );
  const teacherId = r.rows[0].id;
  await pool.query(
    `insert into teacher_branches (teacher_id, branch_id)
     values ($1, $2)`,
    [teacherId, branchId],
  );
  if (activeSubscription) {
    await pool.query(
      `insert into teacher_subscriptions (
         teacher_id, plan_code, status, started_at, expires_at, promo_multiplier, paid_amount_minor, currency
       ) values ($1, 'teacher_6m', 'active', now(), now() + interval '1 year', 1, 0, 'TRY')`,
      [teacherId],
    );
  }
  return { ...user, teacherId };
}

async function createGuardianRequest(args: {
  token: string;
  studentId: string;
  branchId: number;
  topic: string;
}) {
  return app.request("http://localhost/v1/lesson-requests", {
    method: "POST",
    headers: {
      authorization: `Bearer ${args.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      studentId: args.studentId,
      branchId: args.branchId,
      topic: args.topic,
      deliveryMode: "online",
      note: "Veli test ilanı",
      imageUrls: [],
    }),
  });
}

async function cleanup(userIds: string[], studentIds: string[]) {
  await pool.query(`delete from lesson_requests where student_id = any($1::uuid[])`, [studentIds]);
  await pool.query(`delete from users where id = any($1::uuid[])`, [userIds]);
}

describe("lesson requests Armut flow", () => {
  it("lets a linked guardian create a request and notifies matching teachers", async () => {
    if (!(await lessonRequestTablesAvailable())) return;

    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const userIds: string[] = [];
    const studentIds: string[] = [];
    try {
      const branchId = await ensureBranch(suffix);
      const student = await createStudent(suffix);
      const guardian = await createGuardian(suffix);
      const teacher = await createTeacher(suffix, branchId);
      userIds.push(student.userId, guardian.userId, teacher.userId);
      studentIds.push(student.studentId);
      await pool.query(
        `insert into student_guardians (student_id, guardian_user_id, relationship, verified_at)
         values ($1, $2, 'parent', now())`,
        [student.studentId, guardian.userId],
      );

      const res = await createGuardianRequest({
        token: guardian.token,
        studentId: student.studentId,
        branchId,
        topic: "LGS matematik destek",
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as { request: { id: string } };

      const notification = await pool.query<{ count: string }>(
        `select count(*)::text as count
         from parent_notifications
         where recipient_user_id = $1
           and payload_jsonb->>'kind' = 'lesson_request_created_teacher'
           and payload_jsonb->>'requestId' = $2`,
        [teacher.userId, body.request.id],
      );
      expect(notification.rows[0]?.count).toBe("1");
    } finally {
      await cleanup(userIds, studentIds);
    }
  });

  it("rejects a guardian request for an unlinked student", async () => {
    if (!(await lessonRequestTablesAvailable())) return;

    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const userIds: string[] = [];
    const studentIds: string[] = [];
    try {
      const branchId = await ensureBranch(`${suffix}-unlinked`);
      const student = await createStudent(`${suffix}-unlinked`);
      const guardian = await createGuardian(`${suffix}-unlinked`);
      userIds.push(student.userId, guardian.userId);
      studentIds.push(student.studentId);

      const res = await createGuardianRequest({
        token: guardian.token,
        studentId: student.studentId,
        branchId,
        topic: "Bağsız öğrenci ilanı",
      });
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("forbidden_guardian_student");
    } finally {
      await cleanup(userIds, studentIds);
    }
  });

  it("charges non-subscribed teachers 500 TL and subscribed teachers 0 TL for offers", async () => {
    if (!(await lessonRequestTablesAvailable())) return;

    const previousOfferFee = process.env.OFFER_FEE_MINOR;
    delete process.env.OFFER_FEE_MINOR;
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const userIds: string[] = [];
    const studentIds: string[] = [];
    try {
      const branchId = await ensureBranch(`${suffix}-fee`);
      const student = await createStudent(`${suffix}-fee`);
      const guardian = await createGuardian(`${suffix}-fee`);
      const paidTeacher = await createTeacher(`${suffix}-paid`, branchId);
      const subscribedTeacher = await createTeacher(`${suffix}-sub`, branchId, true);
      userIds.push(student.userId, guardian.userId, paidTeacher.userId, subscribedTeacher.userId);
      studentIds.push(student.studentId);
      await pool.query(
        `insert into student_guardians (student_id, guardian_user_id, relationship, verified_at)
         values ($1, $2, 'parent', now())`,
        [student.studentId, guardian.userId],
      );
      const requestRes = await createGuardianRequest({
        token: guardian.token,
        studentId: student.studentId,
        branchId,
        topic: "TYT matematik teklif ücreti",
      });
      expect(requestRes.status).toBe(201);
      const requestBody = (await requestRes.json()) as { request: { id: string } };

      await applyWalletDelta({
        userId: paidTeacher.userId,
        deltaMinor: 50_000,
        kind: "test_wallet_grant",
      });

      const paidOffer = await app.request(`http://localhost/v1/lesson-requests/${requestBody.request.id}/offers`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${paidTeacher.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Bu derse teklif vermek istiyorum.", proposedHourlyRateMinor: 100_000 }),
      });
      expect(paidOffer.status).toBe(201);
      const paidBody = (await paidOffer.json()) as { chargedOfferFeeMinor: number };
      expect(paidBody.chargedOfferFeeMinor).toBe(50_000);

      const wallet = await pool.query<{ balance_minor: string }>(
        `select balance_minor from user_wallets where user_id = $1`,
        [paidTeacher.userId],
      );
      expect(wallet.rows[0]?.balance_minor).toBe("0");

      const subscribedOffer = await app.request(`http://localhost/v1/lesson-requests/${requestBody.request.id}/offers`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${subscribedTeacher.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Aktif abonelikle teklif veriyorum.", proposedHourlyRateMinor: 120_000 }),
      });
      expect(subscribedOffer.status).toBe(201);
      const subscribedBody = (await subscribedOffer.json()) as { chargedOfferFeeMinor: number };
      expect(subscribedBody.chargedOfferFeeMinor).toBe(0);
    } finally {
      if (previousOfferFee === undefined) delete process.env.OFFER_FEE_MINOR;
      else process.env.OFFER_FEE_MINOR = previousOfferFee;
      await cleanup(userIds, studentIds);
    }
  });
});
