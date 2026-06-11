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
  requestKind?: "regular" | "demo";
  targetTeacherId?: string;
  availability?: Record<string, unknown>;
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
      requestKind: args.requestKind ?? "regular",
      targetTeacherId: args.targetTeacherId,
      deliveryMode: "online",
      availability: args.availability ?? {},
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
      const unrelatedBranchId = await ensureBranch(`${suffix}-unrelated`);
      const student = await createStudent(suffix);
      const guardian = await createGuardian(suffix);
      const teacher = await createTeacher(suffix, branchId);
      const unrelatedTeacher = await createTeacher(`${suffix}-unrelated`, unrelatedBranchId);
      userIds.push(student.userId, guardian.userId, teacher.userId, unrelatedTeacher.userId);
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

      const notification = await pool.query<{ count: string; action_href: string | null }>(
        `select count(*)::text as count,
                max(payload_jsonb->>'actionHref') as action_href
         from parent_notifications
         where recipient_user_id = $1
           and payload_jsonb->>'kind' = 'lesson_request_created_teacher'
           and payload_jsonb->>'requestId' = $2`,
        [teacher.userId, body.request.id],
      );
      expect(notification.rows[0]?.count).toBe("1");
      expect(notification.rows[0]?.action_href).toBe(`/teacher/requests?requestId=${body.request.id}`);

      const unrelatedNotification = await pool.query<{ count: string }>(
        `select count(*)::text as count
         from parent_notifications
         where recipient_user_id = $1
           and payload_jsonb->>'requestId' = $2`,
        [unrelatedTeacher.userId, body.request.id],
      );
      expect(unrelatedNotification.rows[0]?.count).toBe("0");
    } finally {
      await cleanup(userIds, studentIds);
    }
  });

  it("sends targeted and shortlisted notifications only to relevant teachers", async () => {
    if (!(await lessonRequestTablesAvailable())) return;

    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const userIds: string[] = [];
    const studentIds: string[] = [];
    try {
      const branchId = await ensureBranch(`${suffix}-targeted`);
      const student = await createStudent(`${suffix}-targeted`);
      const guardian = await createGuardian(`${suffix}-targeted`);
      const targetTeacher = await createTeacher(`${suffix}-target`, branchId);
      const shortlistedTeacher = await createTeacher(`${suffix}-short`, branchId);
      const otherTeacher = await createTeacher(`${suffix}-other`, branchId);
      userIds.push(
        student.userId,
        guardian.userId,
        targetTeacher.userId,
        shortlistedTeacher.userId,
        otherTeacher.userId,
      );
      studentIds.push(student.studentId);
      await pool.query(
        `insert into student_guardians (student_id, guardian_user_id, relationship, verified_at)
         values ($1, $2, 'parent', now())`,
        [student.studentId, guardian.userId],
      );

      const demoRes = await createGuardianRequest({
        token: guardian.token,
        studentId: student.studentId,
        branchId,
        topic: "Demo hedefli talep",
        requestKind: "demo",
        targetTeacherId: targetTeacher.teacherId,
      });
      expect(demoRes.status).toBe(201);
      const demoBody = (await demoRes.json()) as { request: { id: string } };

      const demoTargetNotification = await pool.query<{ count: string }>(
        `select count(*)::text as count
         from parent_notifications
         where recipient_user_id = $1
           and payload_jsonb->>'kind' = 'lesson_request_demo_targeted'
           and payload_jsonb->>'requestId' = $2`,
        [targetTeacher.userId, demoBody.request.id],
      );
      expect(demoTargetNotification.rows[0]?.count).toBe("1");

      const demoOtherNotification = await pool.query<{ count: string }>(
        `select count(*)::text as count
         from parent_notifications
         where recipient_user_id = $1
           and payload_jsonb->>'requestId' = $2`,
        [otherTeacher.userId, demoBody.request.id],
      );
      expect(demoOtherNotification.rows[0]?.count).toBe("0");

      const shortlistRes = await createGuardianRequest({
        token: guardian.token,
        studentId: student.studentId,
        branchId,
        topic: "Kısa listeli talep",
        availability: { shortlistTeacherIds: [shortlistedTeacher.teacherId] },
      });
      expect(shortlistRes.status).toBe(201);
      const shortlistBody = (await shortlistRes.json()) as { request: { id: string } };

      const shortlistNotification = await pool.query<{ count: string }>(
        `select count(*)::text as count
         from parent_notifications
         where recipient_user_id = $1
           and payload_jsonb->>'kind' = 'lesson_request_shortlisted'
           and payload_jsonb->>'requestId' = $2`,
        [shortlistedTeacher.userId, shortlistBody.request.id],
      );
      expect(shortlistNotification.rows[0]?.count).toBe("1");

      const shortlistOtherNotification = await pool.query<{ count: string }>(
        `select count(*)::text as count
         from parent_notifications
         where recipient_user_id = $1
           and payload_jsonb->>'requestId' = $2`,
        [otherTeacher.userId, shortlistBody.request.id],
      );
      expect(shortlistOtherNotification.rows[0]?.count).toBe("0");
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
      const insufficientTeacher = await createTeacher(`${suffix}-insufficient`, branchId);
      userIds.push(
        student.userId,
        guardian.userId,
        paidTeacher.userId,
        subscribedTeacher.userId,
        insufficientTeacher.userId,
      );
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

      const insufficientOffer = await app.request(`http://localhost/v1/lesson-requests/${requestBody.request.id}/offers`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${insufficientTeacher.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Bakiyesiz teklif denemesi.", proposedHourlyRateMinor: 90_000 }),
      });
      expect(insufficientOffer.status).toBe(409);
      const insufficientBody = (await insufficientOffer.json()) as { error: string; neededMinor: number };
      expect(insufficientBody.error).toBe("insufficient_balance");
      expect(insufficientBody.neededMinor).toBe(50_000);

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

  it("lets a guardian reject and accept offers for a linked student's request", async () => {
    if (!(await lessonRequestTablesAvailable())) return;

    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const userIds: string[] = [];
    const studentIds: string[] = [];
    try {
      const branchId = await ensureBranch(`${suffix}-decide`);
      const student = await createStudent(`${suffix}-decide`);
      const guardian = await createGuardian(`${suffix}-decide`);
      const rejectTeacher = await createTeacher(`${suffix}-reject`, branchId, true);
      const acceptTeacher = await createTeacher(`${suffix}-accept`, branchId, true);
      userIds.push(student.userId, guardian.userId, rejectTeacher.userId, acceptTeacher.userId);
      studentIds.push(student.studentId);
      await pool.query(
        `insert into student_guardians (student_id, guardian_user_id, relationship, verified_at)
         values ($1, $2, 'parent', now())`,
        [student.studentId, guardian.userId],
      );

      const rejectRequestRes = await createGuardianRequest({
        token: guardian.token,
        studentId: student.studentId,
        branchId,
        topic: "Reddedilecek teklif",
      });
      expect(rejectRequestRes.status).toBe(201);
      const rejectRequestBody = (await rejectRequestRes.json()) as { request: { id: string } };
      const rejectOfferRes = await app.request(`http://localhost/v1/lesson-requests/${rejectRequestBody.request.id}/offers`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${rejectTeacher.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Reddedilecek teklif.", proposedHourlyRateMinor: 0 }),
      });
      expect(rejectOfferRes.status).toBe(201);
      const rejectOfferBody = (await rejectOfferRes.json()) as { offer: { id: string } };

      const rejectDecision = await app.request(
        `http://localhost/v1/lesson-requests/${rejectRequestBody.request.id}/offers/${rejectOfferBody.offer.id}/decide`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${guardian.token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ decision: "reject" }),
        },
      );
      expect(rejectDecision.status).toBe(200);
      const rejectedOffer = await pool.query<{ status: string }>(
        `select status::text from lesson_offers where id = $1`,
        [rejectOfferBody.offer.id],
      );
      expect(rejectedOffer.rows[0]?.status).toBe("rejected");

      const acceptRequestRes = await createGuardianRequest({
        token: guardian.token,
        studentId: student.studentId,
        branchId,
        topic: "Kabul edilecek teklif",
      });
      expect(acceptRequestRes.status).toBe(201);
      const acceptRequestBody = (await acceptRequestRes.json()) as { request: { id: string } };
      const acceptOfferRes = await app.request(`http://localhost/v1/lesson-requests/${acceptRequestBody.request.id}/offers`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${acceptTeacher.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Kabul edilecek teklif.", proposedHourlyRateMinor: 100_000 }),
      });
      expect(acceptOfferRes.status).toBe(201);
      const acceptOfferBody = (await acceptOfferRes.json()) as { offer: { id: string } };
      await applyWalletDelta({
        userId: guardian.userId,
        deltaMinor: 200_000,
        kind: "test_wallet_grant",
      });

      const acceptDecision = await app.request(
        `http://localhost/v1/lesson-requests/${acceptRequestBody.request.id}/offers/${acceptOfferBody.offer.id}/decide`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${guardian.token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ decision: "accept", packageLessonCount: 2, lessonDurationMinutes: 60 }),
        },
      );
      expect(acceptDecision.status).toBe(200);
      const acceptBody = (await acceptDecision.json()) as {
        packageId: string;
        payment: { totalAmountMinor: number; payerRole: string; payerUserId: string };
      };
      expect(acceptBody.packageId).toBeTruthy();
      expect(acceptBody.payment.totalAmountMinor).toBe(200_000);
      expect(acceptBody.payment.payerRole).toBe("guardian");
      expect(acceptBody.payment.payerUserId).toBe(guardian.userId);

      const acceptedRequest = await pool.query<{ status: string }>(
        `select status::text from lesson_requests where id = $1`,
        [acceptRequestBody.request.id],
      );
      expect(acceptedRequest.rows[0]?.status).toBe("matched");

      const packageRow = await pool.query<{
        method: string;
        payer_role: string;
        payer_user_id: string;
      }>(
        `select escrow_release_policy_jsonb->>'method' as method,
                escrow_release_policy_jsonb->>'payerRole' as payer_role,
                escrow_release_policy_jsonb->>'payerUserId' as payer_user_id
         from lesson_packages
         where id = $1`,
        [acceptBody.packageId],
      );
      expect(packageRow.rows[0]?.method).toBe("guardian_wallet_hold");
      expect(packageRow.rows[0]?.payer_role).toBe("guardian");
      expect(packageRow.rows[0]?.payer_user_id).toBe(guardian.userId);
    } finally {
      await cleanup(userIds, studentIds);
    }
  });
});
