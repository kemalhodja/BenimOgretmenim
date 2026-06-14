import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { app } from "./app.js";
import { pool } from "./db.js";

function paytrCallbackHash(args: {
  merchantOid: string;
  merchantSalt: string;
  status: string;
  totalAmount: string;
  merchantKey: string;
}): string {
  return crypto
    .createHmac("sha256", args.merchantKey)
    .update(`${args.merchantOid}${args.merchantSalt}${args.status}${args.totalAmount}`)
    .digest("base64");
}

async function withPaytrEnv<T>(fn: (env: { merchantKey: string; merchantSalt: string }) => Promise<T>): Promise<T> {
  const previousKey = process.env.PAYTR_MERCHANT_KEY;
  const previousSalt = process.env.PAYTR_MERCHANT_SALT;
  const merchantKey = "test-paytr-key";
  const merchantSalt = "test-paytr-salt";
  process.env.PAYTR_MERCHANT_KEY = merchantKey;
  process.env.PAYTR_MERCHANT_SALT = merchantSalt;
  try {
    return await fn({ merchantKey, merchantSalt });
  } finally {
    if (previousKey === undefined) delete process.env.PAYTR_MERCHANT_KEY;
    else process.env.PAYTR_MERCHANT_KEY = previousKey;
    if (previousSalt === undefined) delete process.env.PAYTR_MERCHANT_SALT;
    else process.env.PAYTR_MERCHANT_SALT = previousSalt;
  }
}

async function postPaytrCallback(args: {
  merchantOid: string;
  status: string;
  totalAmount: string;
  merchantKey: string;
  merchantSalt: string;
}): Promise<Response> {
  const body = new URLSearchParams({
    merchant_oid: args.merchantOid,
    status: args.status,
    total_amount: args.totalAmount,
    hash: paytrCallbackHash(args),
  });
  return app.request("http://localhost/v1/paytr/callback", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

async function ensureTeacherPlan(): Promise<void> {
  await pool.query(
    `insert into subscription_plans (code, title, duration_months, price_minor, currency, entitlements_jsonb)
     values ('teacher_6m', '6 Aylık Öğretmen Aboneliği', 6, 175000, 'TRY', '{}'::jsonb)
     on conflict (code) do nothing`,
  );
}

async function createTeacherUser(suffix: string): Promise<{ userId: string; teacherId: string }> {
  const user = await pool.query<{ id: string }>(
    `insert into users (email, display_name, role)
     values ($1, $2, 'teacher')
     returning id`,
    [`paytr-teacher-${suffix}@example.test`, `PayTR Teacher ${suffix}`],
  );
  const teacher = await pool.query<{ id: string }>(
    `insert into teachers (user_id) values ($1) returning id`,
    [user.rows[0].id],
  );
  return { userId: user.rows[0].id, teacherId: teacher.rows[0].id };
}

async function createStudentUser(suffix: string): Promise<{ userId: string; studentId: string }> {
  const user = await pool.query<{ id: string }>(
    `insert into users (email, display_name, role)
     values ($1, $2, 'student')
     returning id`,
    [`paytr-student-${suffix}@example.test`, `PayTR Student ${suffix}`],
  );
  const student = await pool.query<{ id: string }>(
    `insert into students (user_id) values ($1) returning id`,
    [user.rows[0].id],
  );
  return { userId: user.rows[0].id, studentId: student.rows[0].id };
}

describe("PayTR callback", () => {
  it("rejects callbacks with invalid hash before touching payment state", async () => {
    await withPaytrEnv(async () => {
      const body = new URLSearchParams({
        merchant_oid: "bad_hash_merchant",
        status: "success",
        total_amount: "1000",
        hash: "invalid-hash",
      });

      const res = await app.request("http://localhost/v1/paytr/callback", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      expect(res.status).toBe(400);
      expect(await res.text()).toContain("bad hash");
    });
  });

  it("rejects callbacks with malformed total_amount before touching reconciliation state", async () => {
    const health = await app.request("http://localhost/health");
    if (health.status !== 200) {
      return;
    }

    await withPaytrEnv(async ({ merchantKey, merchantSalt }) => {
      const merchantOid = `bad_amount_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const totalAmount = "12.34";
      const body = new URLSearchParams({
        merchant_oid: merchantOid,
        status: "success",
        total_amount: totalAmount,
        hash: paytrCallbackHash({
          merchantOid,
          merchantSalt,
          status: "success",
          totalAmount,
          merchantKey,
        }),
      });

      const res = await app.request("http://localhost/v1/paytr/callback", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      expect(res.status).toBe(400);
      expect(await res.text()).toContain("invalid payload");

      const event = await pool.query<{ count: string }>(
        `select count(*)::text as count from payment_reconciliation_events where merchant_oid = $1`,
        [merchantOid],
      );
      expect(event.rows[0]?.count).toBe("0");
    });
  });

  it("logs unknown merchant oid as reconciliation event when database is available", async () => {
    const health = await app.request("http://localhost/health");
    if (health.status !== 200) {
      return;
    }

    await withPaytrEnv(async ({ merchantKey, merchantSalt }) => {
      const merchantOid = `unknown_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const totalAmount = "1000";
      const body = new URLSearchParams({
        merchant_oid: merchantOid,
        status: "success",
        total_amount: totalAmount,
        hash: paytrCallbackHash({
          merchantOid,
          merchantSalt,
          status: "success",
          totalAmount,
          merchantKey,
        }),
      });

      const res = await app.request("http://localhost/v1/paytr/callback", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      expect(res.status).toBe(200);
      expect(await res.text()).toBe("OK");

      const event = await pool.query<{ status: string; received_amount_minor: number }>(
        `select status, received_amount_minor
         from payment_reconciliation_events
         where merchant_oid = $1
         order by created_at desc
         limit 1`,
        [merchantOid],
      );
      expect(event.rows[0]?.status).toBe("unknown_merchant_oid");
      expect(Number(event.rows[0]?.received_amount_minor)).toBe(Number(totalAmount));

      await pool.query(`delete from payment_reconciliation_events where merchant_oid = $1`, [merchantOid]);
    });
  });

  it("credits wallet topup only once for duplicate success callbacks", async () => {
    const health = await app.request("http://localhost/health");
    if (health.status !== 200) {
      return;
    }

    const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const email = `paytr-wallet-${suffix}@example.test`;
    const merchantOid = `wallet_test_${suffix}`;
    const totalAmount = "12345";
    let userId: string | null = null;

    try {
      await withPaytrEnv(async ({ merchantKey, merchantSalt }) => {
        const user = await pool.query<{ id: string }>(
          `insert into users (email, display_name, role)
           values ($1, 'PayTR Wallet Test', 'student')
           returning id`,
          [email],
        );
        userId = user.rows[0].id;

        const payment = await pool.query<{ id: string }>(
          `insert into wallet_topup_payments (user_id, amount_minor, merchant_oid)
           values ($1, $2, $3)
           returning id`,
          [userId, Number(totalAmount), merchantOid],
        );

        const body = new URLSearchParams({
          merchant_oid: merchantOid,
          status: "success",
          total_amount: totalAmount,
          hash: paytrCallbackHash({
            merchantOid,
            merchantSalt,
            status: "success",
            totalAmount,
            merchantKey,
          }),
        });

        const first = await app.request("http://localhost/v1/paytr/callback", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: body.toString(),
        });
        const second = await app.request("http://localhost/v1/paytr/callback", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: body.toString(),
        });

        expect(first.status).toBe(200);
        expect(await first.text()).toBe("OK");
        expect(second.status).toBe(200);
        expect(await second.text()).toBe("OK");

        const wallet = await pool.query<{ balance_minor: string }>(
          `select balance_minor from user_wallets where user_id = $1`,
          [userId],
        );
        expect(wallet.rows[0]?.balance_minor).toBe(totalAmount);

        const ledger = await pool.query<{ count: string }>(
          `select count(*)::text as count
           from user_wallet_ledger
           where user_id = $1 and kind = 'paytr_wallet_topup' and ref_id = $2`,
          [userId, payment.rows[0].id],
        );
        expect(ledger.rows[0]?.count).toBe("1");
      });
    } finally {
      if (userId) {
        await pool.query(`delete from users where id = $1`, [userId]);
      }
    }
  });

  it("does not credit wallet when PayTR success amount mismatches", async () => {
    const health = await app.request("http://localhost/health");
    if (health.status !== 200) {
      return;
    }

    const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const email = `paytr-mismatch-${suffix}@example.test`;
    const merchantOid = `wallet_mismatch_${suffix}`;
    const expectedAmount = "12345";
    const receivedAmount = "99999";
    let userId: string | null = null;

    try {
      await withPaytrEnv(async ({ merchantKey, merchantSalt }) => {
        const user = await pool.query<{ id: string }>(
          `insert into users (email, display_name, role)
           values ($1, 'PayTR Mismatch Test', 'student')
           returning id`,
          [email],
        );
        userId = user.rows[0].id;

        const payment = await pool.query<{ id: string }>(
          `insert into wallet_topup_payments (user_id, amount_minor, merchant_oid)
           values ($1, $2, $3)
           returning id`,
          [userId, Number(expectedAmount), merchantOid],
        );

        const body = new URLSearchParams({
          merchant_oid: merchantOid,
          status: "success",
          total_amount: receivedAmount,
          hash: paytrCallbackHash({
            merchantOid,
            merchantSalt,
            status: "success",
            totalAmount: receivedAmount,
            merchantKey,
          }),
        });

        const res = await app.request("http://localhost/v1/paytr/callback", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: body.toString(),
        });

        expect(res.status).toBe(200);
        expect(await res.text()).toBe("OK");

        const wallet = await pool.query<{ balance_minor: string }>(
          `select balance_minor from user_wallets where user_id = $1`,
          [userId],
        );
        expect(wallet.rows[0]?.balance_minor ?? "0").toBe("0");

        const paymentState = await pool.query<{ state: string }>(
          `select state from wallet_topup_payments where id = $1`,
          [payment.rows[0].id],
        );
        expect(paymentState.rows[0]?.state).toBe("pending");

        const event = await pool.query<{ status: string; expected_amount_minor: number; received_amount_minor: number }>(
          `select status, expected_amount_minor, received_amount_minor
           from payment_reconciliation_events
           where merchant_oid = $1
           order by created_at desc
           limit 1`,
          [merchantOid],
        );
        expect(event.rows[0]?.status).toBe("amount_mismatch");
        expect(Number(event.rows[0]?.expected_amount_minor)).toBe(Number(expectedAmount));
        expect(Number(event.rows[0]?.received_amount_minor)).toBe(Number(receivedAmount));

        await pool.query(`delete from payment_reconciliation_events where merchant_oid = $1`, [merchantOid]);
      });
    } finally {
      if (userId) {
        await pool.query(`delete from users where id = $1`, [userId]);
      }
    }
  });

  it("marks wallet topup failed without crediting balance when PayTR reports failure", async () => {
    const health = await app.request("http://localhost/health");
    if (health.status !== 200) {
      return;
    }

    const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const email = `paytr-wallet-failed-${suffix}@example.test`;
    const merchantOid = `wallet_failed_${suffix}`;
    const totalAmount = "12345";
    let userId: string | null = null;

    try {
      await withPaytrEnv(async ({ merchantKey, merchantSalt }) => {
        const user = await pool.query<{ id: string }>(
          `insert into users (email, display_name, role)
           values ($1, 'PayTR Wallet Failed Test', 'student')
           returning id`,
          [email],
        );
        userId = user.rows[0].id;

        const payment = await pool.query<{ id: string }>(
          `insert into wallet_topup_payments (user_id, amount_minor, merchant_oid)
           values ($1, $2, $3)
           returning id`,
          [userId, Number(totalAmount), merchantOid],
        );

        const res = await postPaytrCallback({
          merchantOid,
          status: "failed",
          totalAmount,
          merchantKey,
          merchantSalt,
        });

        expect(res.status).toBe(200);
        expect(await res.text()).toBe("OK");

        const wallet = await pool.query<{ balance_minor: string }>(
          `select balance_minor from user_wallets where user_id = $1`,
          [userId],
        );
        expect(wallet.rows[0]?.balance_minor ?? "0").toBe("0");

        const paymentState = await pool.query<{ state: string }>(
          `select state from wallet_topup_payments where id = $1`,
          [payment.rows[0].id],
        );
        expect(paymentState.rows[0]?.state).toBe("failed");

        const event = await pool.query<{ status: string; expected_amount_minor: number; received_amount_minor: number }>(
          `select status, expected_amount_minor, received_amount_minor
           from payment_reconciliation_events
           where merchant_oid = $1
           order by created_at desc
           limit 1`,
          [merchantOid],
        );
        expect(event.rows[0]?.status).toBe("failed");
        expect(Number(event.rows[0]?.expected_amount_minor)).toBe(Number(totalAmount));
        expect(Number(event.rows[0]?.received_amount_minor)).toBe(Number(totalAmount));

        await pool.query(`delete from payment_reconciliation_events where merchant_oid = $1`, [merchantOid]);
      });
    } finally {
      if (userId) {
        await pool.query(`delete from users where id = $1`, [userId]);
      }
    }
  });

  it("activates teacher subscription only once for duplicate success callbacks", async () => {
    const health = await app.request("http://localhost/health");
    if (health.status !== 200) return;

    const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const merchantOid = `teacher_sub_${suffix}`;
    const totalAmount = "175000";
    let userId: string | null = null;

    try {
      await withPaytrEnv(async ({ merchantKey, merchantSalt }) => {
        await ensureTeacherPlan();
        const teacher = await createTeacherUser(suffix);
        userId = teacher.userId;
        const payment = await pool.query<{ id: string }>(
          `insert into subscription_payments (teacher_id, plan_code, method, amount_minor, merchant_oid)
           values ($1, 'teacher_6m', 'paytr_iframe', $2, $3)
           returning id`,
          [teacher.teacherId, Number(totalAmount), merchantOid],
        );

        const first = await postPaytrCallback({
          merchantOid,
          status: "success",
          totalAmount,
          merchantKey,
          merchantSalt,
        });
        const second = await postPaytrCallback({
          merchantOid,
          status: "success",
          totalAmount,
          merchantKey,
          merchantSalt,
        });

        expect(first.status).toBe(200);
        expect(second.status).toBe(200);
        expect(await first.text()).toBe("OK");
        expect(await second.text()).toBe("OK");

        const paymentState = await pool.query<{ state: string }>(
          `select state from subscription_payments where id = $1`,
          [payment.rows[0].id],
        );
        expect(paymentState.rows[0]?.state).toBe("paid");

        const subs = await pool.query<{ count: string }>(
          `select count(*)::text as count
           from teacher_subscriptions
           where teacher_id = $1 and payment_id = $2`,
          [teacher.teacherId, payment.rows[0].id],
        );
        expect(subs.rows[0]?.count).toBe("1");
      });
    } finally {
      if (userId) await pool.query(`delete from users where id = $1`, [userId]);
    }
  });

  it("marks teacher subscription payment failed when PayTR reports failure", async () => {
    const health = await app.request("http://localhost/health");
    if (health.status !== 200) return;

    const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const merchantOid = `teacher_sub_failed_${suffix}`;
    const totalAmount = "175000";
    let userId: string | null = null;

    try {
      await withPaytrEnv(async ({ merchantKey, merchantSalt }) => {
        await ensureTeacherPlan();
        const teacher = await createTeacherUser(suffix);
        userId = teacher.userId;
        const payment = await pool.query<{ id: string }>(
          `insert into subscription_payments (teacher_id, plan_code, method, amount_minor, merchant_oid)
           values ($1, 'teacher_6m', 'paytr_iframe', $2, $3)
           returning id`,
          [teacher.teacherId, Number(totalAmount), merchantOid],
        );

        const res = await postPaytrCallback({
          merchantOid,
          status: "failed",
          totalAmount,
          merchantKey,
          merchantSalt,
        });
        expect(res.status).toBe(200);
        expect(await res.text()).toBe("OK");

        const paymentState = await pool.query<{ state: string }>(
          `select state from subscription_payments where id = $1`,
          [payment.rows[0].id],
        );
        expect(paymentState.rows[0]?.state).toBe("failed");

        const event = await pool.query<{ status: string }>(
          `select status from payment_reconciliation_events where merchant_oid = $1 order by created_at desc limit 1`,
          [merchantOid],
        );
        expect(event.rows[0]?.status).toBe("failed");
        await pool.query(`delete from payment_reconciliation_events where merchant_oid = $1`, [merchantOid]);
      });
    } finally {
      if (userId) await pool.query(`delete from users where id = $1`, [userId]);
    }
  });

  it("activates student subscription only once for duplicate success callbacks", async () => {
    const health = await app.request("http://localhost/health");
    if (health.status !== 200) return;

    const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const merchantOid = `student_sub_${suffix}`;
    const totalAmount = "150000";
    let userId: string | null = null;

    try {
      await withPaytrEnv(async ({ merchantKey, merchantSalt }) => {
        const student = await createStudentUser(suffix);
        userId = student.userId;
        const sub = await pool.query<{ id: string }>(
          `insert into student_subscriptions (
             user_id, months_count, price_per_month_minor, price_total_minor, lifecycle
           ) values ($1, 12, 12500, $2, 'awaiting_payment')
           returning id`,
          [student.userId, Number(totalAmount)],
        );
        const payment = await pool.query<{ id: string }>(
          `insert into student_sub_payments (subscription_id, user_id, amount_minor, merchant_oid)
           values ($1, $2, $3, $4)
           returning id`,
          [sub.rows[0].id, student.userId, Number(totalAmount), merchantOid],
        );

        const first = await postPaytrCallback({ merchantOid, status: "success", totalAmount, merchantKey, merchantSalt });
        const second = await postPaytrCallback({ merchantOid, status: "success", totalAmount, merchantKey, merchantSalt });
        expect(first.status).toBe(200);
        expect(second.status).toBe(200);

        const paymentState = await pool.query<{ state: string }>(
          `select state from student_sub_payments where id = $1`,
          [payment.rows[0].id],
        );
        expect(paymentState.rows[0]?.state).toBe("paid");

        const activeSub = await pool.query<{ lifecycle: string; expires_at: Date | null }>(
          `select lifecycle, expires_at from student_subscriptions where id = $1`,
          [sub.rows[0].id],
        );
        expect(activeSub.rows[0]?.lifecycle).toBe("active");
        expect(activeSub.rows[0]?.expires_at).toBeTruthy();
      });
    } finally {
      if (userId) await pool.query(`delete from users where id = $1`, [userId]);
    }
  });

  it("records course enrollment amount mismatch without enrolling student", async () => {
    const health = await app.request("http://localhost/health");
    if (health.status !== 200) return;

    const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const merchantOid = `course_mismatch_${suffix}`;
    const expectedAmount = "250000";
    const receivedAmount = "100000";
    let teacherUserId: string | null = null;
    let studentUserId: string | null = null;

    try {
      await withPaytrEnv(async ({ merchantKey, merchantSalt }) => {
        const teacher = await createTeacherUser(`course_${suffix}`);
        const student = await createStudentUser(`course_${suffix}`);
        teacherUserId = teacher.userId;
        studentUserId = student.userId;
        const course = await pool.query<{ id: string }>(
          `insert into courses (teacher_id, title, description, price_minor, status)
           values ($1, 'PayTR Kurs', 'PayTR test kursu', $2, 'published')
           returning id`,
          [teacher.teacherId, Number(expectedAmount)],
        );
        const cohort = await pool.query<{ id: string }>(
          `insert into course_cohorts (course_id, title, status, capacity)
           values ($1, 'PayTR Cohort', 'planned', 10)
           returning id`,
          [course.rows[0].id],
        );
        const payment = await pool.query<{ id: string }>(
          `insert into course_enrollment_payments (
             course_id, cohort_id, student_id, user_id, amount_minor, merchant_oid
           ) values ($1, $2, $3, $4, $5, $6)
           returning id`,
          [course.rows[0].id, cohort.rows[0].id, student.studentId, student.userId, Number(expectedAmount), merchantOid],
        );

        const res = await postPaytrCallback({
          merchantOid,
          status: "success",
          totalAmount: receivedAmount,
          merchantKey,
          merchantSalt,
        });
        expect(res.status).toBe(200);
        expect(await res.text()).toBe("OK");

        const paymentState = await pool.query<{ state: string }>(
          `select state from course_enrollment_payments where id = $1`,
          [payment.rows[0].id],
        );
        expect(paymentState.rows[0]?.state).toBe("pending");

        const enrollments = await pool.query<{ count: string }>(
          `select count(*)::text as count from course_enrollments where cohort_id = $1 and student_id = $2`,
          [cohort.rows[0].id, student.studentId],
        );
        expect(enrollments.rows[0]?.count).toBe("0");

        const event = await pool.query<{ status: string; expected_amount_minor: number; received_amount_minor: number }>(
          `select status, expected_amount_minor, received_amount_minor
           from payment_reconciliation_events
           where merchant_oid = $1
           order by created_at desc
           limit 1`,
          [merchantOid],
        );
        expect(event.rows[0]?.status).toBe("amount_mismatch");
        expect(Number(event.rows[0]?.expected_amount_minor)).toBe(Number(expectedAmount));
        expect(Number(event.rows[0]?.received_amount_minor)).toBe(Number(receivedAmount));
        await pool.query(`delete from payment_reconciliation_events where merchant_oid = $1`, [merchantOid]);
      });
    } finally {
      if (studentUserId) await pool.query(`delete from users where id = $1`, [studentUserId]);
      if (teacherUserId) await pool.query(`delete from users where id = $1`, [teacherUserId]);
    }
  });

  it("returns retryable error when wallet topup transaction cannot be applied", async () => {
    const health = await app.request("http://localhost/health");
    if (health.status !== 200) {
      return;
    }

    const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const email = `paytr-tx-fail-${suffix}@example.test`;
    const merchantOid = `wallet_tx_fail_${suffix}`;
    const totalAmount = "12345";
    let userId: string | null = null;

    try {
      await withPaytrEnv(async ({ merchantKey, merchantSalt }) => {
        const user = await pool.query<{ id: string }>(
          `insert into users (email, display_name, role)
           values ($1, 'PayTR Transaction Failure Test', 'student')
           returning id`,
          [email],
        );
        userId = user.rows[0].id;

        const payment = await pool.query<{ id: string }>(
          `insert into wallet_topup_payments (user_id, amount_minor, merchant_oid)
           values ($1, $2, $3)
           returning id`,
          [userId, Number(totalAmount), merchantOid],
        );

        const body = new URLSearchParams({
          merchant_oid: merchantOid,
          status: "success",
          total_amount: totalAmount,
          hash: paytrCallbackHash({
            merchantOid,
            merchantSalt,
            status: "success",
            totalAmount,
            merchantKey,
          }),
        });

        const fakeClient = {
          query: vi.fn(async (sql: unknown) => {
            const text = String(sql).trim().toLowerCase();
            if (text === "begin" || text === "rollback") {
              return { rows: [], rowCount: null };
            }
            throw new Error("forced transaction failure");
          }),
          release: vi.fn(),
        };
        const realConnect = pool.connect.bind(pool);
        const connectSpy = vi
          .spyOn(pool, "connect")
          .mockImplementation(((callback?: unknown) => {
            if (typeof callback === "function") {
              return realConnect(callback as Parameters<typeof pool.connect>[0]);
            }
            return Promise.resolve(fakeClient as unknown as Awaited<ReturnType<typeof pool.connect>>);
          }) as typeof pool.connect);
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        try {
          const res = await app.request("http://localhost/v1/paytr/callback", {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: body.toString(),
          });

          expect(res.status).toBe(500);
          expect(await res.text()).toContain("transaction error");
          expect(fakeClient.release).toHaveBeenCalledOnce();
          expect(errorSpy).toHaveBeenCalledWith(
            "[paytr] wallet topup callback transaction failed",
            expect.objectContaining({ merchantOid, paymentId: payment.rows[0].id }),
          );
        } finally {
          connectSpy.mockRestore();
          errorSpy.mockRestore();
        }

        const paymentState = await pool.query<{ state: string }>(
          `select state from wallet_topup_payments where id = $1`,
          [payment.rows[0].id],
        );
        expect(paymentState.rows[0]?.state).toBe("pending");
      });
    } finally {
      if (userId) {
        await pool.query(`delete from users where id = $1`, [userId]);
      }
    }
  });
});
