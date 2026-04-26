import { Hono } from "hono";
import crypto from "node:crypto";
import { z } from "zod";
import { pool } from "../db.js";
import type { AppVariables } from "../types.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { applyWalletDelta } from "../lib/wallet.js";

export const paytr = new Hono<{ Variables: AppVariables }>();

function mustEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name}_required`);
  return v;
}

function base64HmacSha256(key: string, data: string): string {
  return crypto.createHmac("sha256", key).update(data).digest("base64");
}

const checkoutQuery = z.object({
  paymentId: z.string().uuid(),
});

/** PayTR iFrame token üretimi (server-side) */
paytr.get("/checkout", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "teacher") return c.json({ error: "forbidden_teachers_only" }, 403);

  const parsed = checkoutQuery.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const merchantId = mustEnv("PAYTR_MERCHANT_ID");
  const merchantKey = mustEnv("PAYTR_MERCHANT_KEY");
  const merchantSalt = mustEnv("PAYTR_MERCHANT_SALT");

  const baseUrl = mustEnv("PAYTR_BASE_URL"); // e.g. https://www.paytr.com
  const okUrl = mustEnv("PAYTR_OK_URL");
  const failUrl = mustEnv("PAYTR_FAIL_URL");
  const callbackUrl = mustEnv("PAYTR_CALLBACK_URL");

  const teacherRow = await pool.query(`select id from teachers where user_id = $1`, [
    userId,
  ]);
  if (!teacherRow.rowCount) return c.json({ error: "teacher_profile_missing" }, 400);
  const teacherId = teacherRow.rows[0].id as string;

  const payment = await pool.query(
    `select id, teacher_id, plan_code, amount_minor, currency, merchant_oid, state
     from subscription_payments
     where id = $1 and teacher_id = $2 and method = 'paytr_iframe'`,
    [parsed.data.paymentId, teacherId],
  );
  if (!payment.rowCount) return c.json({ error: "payment_not_found" }, 404);
  const p = payment.rows[0] as {
    id: string;
    teacher_id: string;
    plan_code: string;
    amount_minor: number;
    currency: string;
    merchant_oid: string;
    state: string;
  };
  if (p.state !== "pending") return c.json({ error: "payment_not_pending" }, 409);

  // plan bilgisi + email
  const plan = await pool.query(
    `select title from subscription_plans where code = $1`,
    [p.plan_code],
  );
  const title = (plan.rows[0]?.title as string | undefined) ?? "Öğretmen Aboneliği";

  const user = await pool.query(
    `select email, display_name, phone from users where id = $1`,
    [userId],
  );
  const email = user.rows[0]?.email as string | undefined;
  if (!email) return c.json({ error: "user_email_missing" }, 400);

  const userIp = (c.req.header("x-forwarded-for") ?? "").split(",")[0]?.trim() || "127.0.0.1";

  const basket = Buffer.from(
    JSON.stringify([[title, (p.amount_minor / 100).toFixed(2), 1]]),
    "utf8",
  ).toString("base64");

  const noInstallment = "0";
  const maxInstallment = "0";
  const testMode = process.env.PAYTR_TEST_MODE ?? "1";
  const currency = p.currency === "TRY" ? "TL" : p.currency;

  const hashStr = `${merchantId}${userIp}${p.merchant_oid}${email}${p.amount_minor}${basket}${noInstallment}${maxInstallment}${currency}${testMode}`;
  const paytrToken = base64HmacSha256(merchantKey, hashStr + merchantSalt);

  const form = new URLSearchParams();
  form.set("merchant_id", merchantId);
  form.set("email", email);
  form.set("payment_amount", String(p.amount_minor));
  form.set("merchant_oid", p.merchant_oid);
  form.set("user_name", (user.rows[0]?.display_name as string | undefined) ?? "Öğretmen");
  form.set("user_address", ""); // opsiyonel
  form.set("user_phone", (user.rows[0]?.phone as string | undefined) ?? "0000000000");
  form.set("merchant_ok_url", okUrl);
  form.set("merchant_fail_url", failUrl);
  form.set("user_basket", basket);
  form.set("user_ip", userIp);
  form.set("timeout_limit", process.env.PAYTR_TIMEOUT_LIMIT ?? "30");
  form.set("debug_on", process.env.PAYTR_DEBUG_ON ?? "1");
  form.set("test_mode", testMode);
  form.set("lang", "tr");
  form.set("no_installment", noInstallment);
  form.set("max_installment", maxInstallment);
  form.set("currency", currency);
  form.set("paytr_token", paytrToken);
  form.set("callback_url", callbackUrl);

  const res = await fetch(`${baseUrl}/odeme/api/get-token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const text = await res.text();
  const data = JSON.parse(text) as { status: string; token?: string; reason?: string };
  if (data.status !== "success" || !data.token) {
    return c.json({ error: "paytr_token_failed", details: data }, 502);
  }

  await pool.query(
    `update subscription_payments
     set paytr_iframe_token = $2, updated_at = now()
     where id = $1`,
    [p.id, data.token],
  );

  return c.json({
    iframeToken: data.token,
    iframeUrl: `${baseUrl}/odeme/guvenli/${data.token}`,
    merchantOid: p.merchant_oid,
  });
});

/** PayTR iFrame: kurs kayıt ücreti (öğrenci) */
paytr.get("/course-checkout", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "student") return c.json({ error: "forbidden_students_only" }, 403);

  const parsed = checkoutQuery.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const merchantId = mustEnv("PAYTR_MERCHANT_ID");
  const merchantKey = mustEnv("PAYTR_MERCHANT_KEY");
  const merchantSalt = mustEnv("PAYTR_MERCHANT_SALT");

  const baseUrl = mustEnv("PAYTR_BASE_URL");
  const okUrl = mustEnv("PAYTR_OK_URL");
  const failUrl = mustEnv("PAYTR_FAIL_URL");
  const callbackUrl = mustEnv("PAYTR_CALLBACK_URL");

  const payment = await pool.query(
    `select p.id, p.amount_minor, p.currency, p.merchant_oid, p.state,
            c.title as course_title, cc.title as cohort_title
     from course_enrollment_payments p
     join courses c on c.id = p.course_id
     join course_cohorts cc on cc.id = p.cohort_id
     where p.id = $1 and p.user_id = $2 and p.method = 'paytr_iframe'`,
    [parsed.data.paymentId, userId],
  );
  if (!payment.rowCount) return c.json({ error: "payment_not_found" }, 404);
  const p = payment.rows[0] as {
    id: string;
    amount_minor: number;
    currency: string;
    merchant_oid: string;
    state: string;
    course_title: string;
    cohort_title: string;
  };
  if (p.state !== "pending") return c.json({ error: "payment_not_pending" }, 409);

  const title = `Kurs: ${p.course_title} — ${p.cohort_title}`.slice(0, 200);

  const user = await pool.query(
    `select email, display_name, phone from users where id = $1`,
    [userId],
  );
  const email = user.rows[0]?.email as string | undefined;
  if (!email) return c.json({ error: "user_email_missing" }, 400);

  const userIp = (c.req.header("x-forwarded-for") ?? "").split(",")[0]?.trim() || "127.0.0.1";

  const basket = Buffer.from(
    JSON.stringify([[title, (p.amount_minor / 100).toFixed(2), 1]]),
    "utf8",
  ).toString("base64");

  const noInstallment = "0";
  const maxInstallment = "0";
  const testMode = process.env.PAYTR_TEST_MODE ?? "1";
  const currency = p.currency === "TRY" ? "TL" : p.currency;

  const hashStr = `${merchantId}${userIp}${p.merchant_oid}${email}${p.amount_minor}${basket}${noInstallment}${maxInstallment}${currency}${testMode}`;
  const paytrToken = base64HmacSha256(merchantKey, hashStr + merchantSalt);

  const form = new URLSearchParams();
  form.set("merchant_id", merchantId);
  form.set("email", email);
  form.set("payment_amount", String(p.amount_minor));
  form.set("merchant_oid", p.merchant_oid);
  form.set("user_name", (user.rows[0]?.display_name as string | undefined) ?? "Öğrenci");
  form.set("user_address", "");
  form.set("user_phone", (user.rows[0]?.phone as string | undefined) ?? "0000000000");
  form.set("merchant_ok_url", okUrl);
  form.set("merchant_fail_url", failUrl);
  form.set("user_basket", basket);
  form.set("user_ip", userIp);
  form.set("timeout_limit", process.env.PAYTR_TIMEOUT_LIMIT ?? "30");
  form.set("debug_on", process.env.PAYTR_DEBUG_ON ?? "1");
  form.set("test_mode", testMode);
  form.set("lang", "tr");
  form.set("no_installment", noInstallment);
  form.set("max_installment", maxInstallment);
  form.set("currency", currency);
  form.set("paytr_token", paytrToken);
  form.set("callback_url", callbackUrl);

  const res = await fetch(`${baseUrl}/odeme/api/get-token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const text = await res.text();
  const data = JSON.parse(text) as { status: string; token?: string; reason?: string };
  if (data.status !== "success" || !data.token) {
    return c.json({ error: "paytr_token_failed", details: data }, 502);
  }

  await pool.query(
    `update course_enrollment_payments
     set paytr_iframe_token = $2, updated_at = now()
     where id = $1`,
    [p.id, data.token],
  );

  return c.json({
    iframeToken: data.token,
    iframeUrl: `${baseUrl}/odeme/guvenli/${data.token}`,
    merchantOid: p.merchant_oid,
  });
});

const checkoutSubQuery = z.object({ paymentId: z.string().uuid() });

/** PayTR: öğrenci platform aboneliği (STU) */
paytr.get("/student-sub-checkout", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (c.get("userRole") !== "student") return c.json({ error: "forbidden_students_only" }, 403);

  const parsed = checkoutSubQuery.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const merchantId = mustEnv("PAYTR_MERCHANT_ID");
  const merchantKey = mustEnv("PAYTR_MERCHANT_KEY");
  const merchantSalt = mustEnv("PAYTR_MERCHANT_SALT");
  const baseUrl = mustEnv("PAYTR_BASE_URL");
  const okUrl = mustEnv("PAYTR_OK_URL");
  const failUrl = mustEnv("PAYTR_FAIL_URL");
  const callbackUrl = mustEnv("PAYTR_CALLBACK_URL");

  const payment = await pool.query(
    `select p.id, p.amount_minor, p.currency, p.merchant_oid, p.state, p.user_id, s.months_count, s.price_per_month_minor
     from student_sub_payments p
     join student_subscriptions s on s.id = p.subscription_id
     where p.id = $1 and p.user_id = $2 and p.method = 'paytr_iframe'`,
    [parsed.data.paymentId, userId],
  );
  if (!payment.rowCount) return c.json({ error: "payment_not_found" }, 404);
  const p = payment.rows[0] as {
    id: string;
    amount_minor: number;
    currency: string;
    merchant_oid: string;
    state: string;
    user_id: string;
    months_count: number;
    price_per_month_minor: number;
  };
  if (p.state !== "pending") return c.json({ error: "payment_not_pending" }, 409);

  const title = `Platform aboneliği (öğrenci) — ${p.months_count} ay · ${(p.price_per_month_minor / 100).toFixed(0)} TL/ay`
    .slice(0, 200);

  const user = await pool.query(
    `select email, display_name, phone from users where id = $1`,
    [userId],
  );
  const email = user.rows[0]?.email as string | undefined;
  if (!email) return c.json({ error: "user_email_missing" }, 400);

  const userIp = (c.req.header("x-forwarded-for") ?? "").split(",")[0]?.trim() || "127.0.0.1";
  const basket = Buffer.from(
    JSON.stringify([[title, (p.amount_minor / 100).toFixed(2), 1]]),
    "utf8",
  ).toString("base64");
  const noInstallment = "0";
  const maxInstallment = "0";
  const testMode = process.env.PAYTR_TEST_MODE ?? "1";
  const currency = p.currency === "TRY" ? "TL" : p.currency;
  const hashStr = `${merchantId}${userIp}${p.merchant_oid}${email}${p.amount_minor}${basket}${noInstallment}${maxInstallment}${currency}${testMode}`;
  const paytrToken = base64HmacSha256(merchantKey, hashStr + merchantSalt);

  const form = new URLSearchParams();
  form.set("merchant_id", merchantId);
  form.set("email", email);
  form.set("payment_amount", String(p.amount_minor));
  form.set("merchant_oid", p.merchant_oid);
  form.set("user_name", (user.rows[0]?.display_name as string | undefined) ?? "Öğrenci");
  form.set("user_address", "");
  form.set("user_phone", (user.rows[0]?.phone as string | undefined) ?? "0000000000");
  form.set("merchant_ok_url", okUrl);
  form.set("merchant_fail_url", failUrl);
  form.set("user_basket", basket);
  form.set("user_ip", userIp);
  form.set("timeout_limit", process.env.PAYTR_TIMEOUT_LIMIT ?? "30");
  form.set("debug_on", process.env.PAYTR_DEBUG_ON ?? "1");
  form.set("test_mode", testMode);
  form.set("lang", "tr");
  form.set("no_installment", noInstallment);
  form.set("max_installment", maxInstallment);
  form.set("currency", currency);
  form.set("paytr_token", paytrToken);
  form.set("callback_url", callbackUrl);

  const res = await fetch(`${baseUrl}/odeme/api/get-token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const text = await res.text();
  const d = JSON.parse(text) as { status: string; token?: string; reason?: string };
  if (d.status !== "success" || !d.token) {
    return c.json({ error: "paytr_token_failed", details: d }, 502);
  }
  await pool.query(
    `update student_sub_payments set paytr_iframe_token = $2, updated_at = now() where id = $1`,
    [p.id, d.token],
  );
  return c.json({ iframeToken: d.token, iframeUrl: `${baseUrl}/odeme/guvenli/${d.token}`, merchantOid: p.merchant_oid });
});

const checkoutWltQuery = z.object({ paymentId: z.string().uuid() });

/** PayTR: cüzdan yükleme (WLT) */
paytr.get("/wallet-topup-checkout", requireAuth, async (c) => {
  const userId = c.get("userId");
  const parsed = checkoutWltQuery.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const merchantId = mustEnv("PAYTR_MERCHANT_ID");
  const merchantKey = mustEnv("PAYTR_MERCHANT_KEY");
  const merchantSalt = mustEnv("PAYTR_MERCHANT_SALT");
  const baseUrl = mustEnv("PAYTR_BASE_URL");
  const okUrl = mustEnv("PAYTR_OK_URL");
  const failUrl = mustEnv("PAYTR_FAIL_URL");
  const callbackUrl = mustEnv("PAYTR_CALLBACK_URL");

  const payment = await pool.query(
    `select id, user_id, amount_minor, currency, merchant_oid, state
     from wallet_topup_payments
     where id = $1 and user_id = $2 and method = 'paytr_iframe'`,
    [parsed.data.paymentId, userId],
  );
  if (!payment.rowCount) return c.json({ error: "payment_not_found" }, 404);
  const p = payment.rows[0] as {
    id: string;
    user_id: string;
    amount_minor: number;
    currency: string;
    merchant_oid: string;
    state: string;
  };
  if (p.state !== "pending") return c.json({ error: "payment_not_pending" }, 409);

  const title = `Cüzdan yükleme — ${(p.amount_minor / 100).toFixed(2)} TL`.slice(0, 200);
  const u = await pool.query(`select email, display_name, phone from users where id = $1`, [userId]);
  const email = u.rows[0]?.email as string | undefined;
  if (!email) return c.json({ error: "user_email_missing" }, 400);

  const userIp = (c.req.header("x-forwarded-for") ?? "").split(",")[0]?.trim() || "127.0.0.1";
  const basket = Buffer.from(
    JSON.stringify([[title, (p.amount_minor / 100).toFixed(2), 1]]),
    "utf8",
  ).toString("base64");
  const noInstallment = "0";
  const maxInstallment = "0";
  const testMode = process.env.PAYTR_TEST_MODE ?? "1";
  const currency = p.currency === "TRY" ? "TL" : p.currency;
  const hashStr = `${merchantId}${userIp}${p.merchant_oid}${email}${p.amount_minor}${basket}${noInstallment}${maxInstallment}${currency}${testMode}`;
  const paytrToken = base64HmacSha256(merchantKey, hashStr + merchantSalt);
  const form = new URLSearchParams();
  form.set("merchant_id", merchantId);
  form.set("email", email);
  form.set("payment_amount", String(p.amount_minor));
  form.set("merchant_oid", p.merchant_oid);
  form.set("user_name", (u.rows[0]?.display_name as string | undefined) ?? "Kullanıcı");
  form.set("user_address", "");
  form.set("user_phone", (u.rows[0]?.phone as string | undefined) ?? "0000000000");
  form.set("merchant_ok_url", okUrl);
  form.set("merchant_fail_url", failUrl);
  form.set("user_basket", basket);
  form.set("user_ip", userIp);
  form.set("timeout_limit", process.env.PAYTR_TIMEOUT_LIMIT ?? "30");
  form.set("debug_on", process.env.PAYTR_DEBUG_ON ?? "1");
  form.set("test_mode", testMode);
  form.set("lang", "tr");
  form.set("no_installment", noInstallment);
  form.set("max_installment", maxInstallment);
  form.set("currency", currency);
  form.set("paytr_token", paytrToken);
  form.set("callback_url", callbackUrl);
  const res = await fetch(`${baseUrl}/odeme/api/get-token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const text = await res.text();
  const d2 = JSON.parse(text) as { status: string; token?: string; reason?: string };
  if (d2.status !== "success" || !d2.token) {
    return c.json({ error: "paytr_token_failed", details: d2 }, 502);
  }
  await pool.query(
    `update wallet_topup_payments set paytr_iframe_token = $2, updated_at = now() where id = $1`,
    [p.id, d2.token],
  );
  return c.json({ iframeToken: d2.token, iframeUrl: `${baseUrl}/odeme/guvenli/${d2.token}`, merchantOid: p.merchant_oid });
});

/** PayTR callback (webhook) — hash doğrulama + idempotent işlem */
paytr.post("/callback", async (c) => {
  const merchantKey = mustEnv("PAYTR_MERCHANT_KEY");
  const merchantSalt = mustEnv("PAYTR_MERCHANT_SALT");

  const body = await c.req.parseBody();
  const merchantOid = String(body["merchant_oid"] ?? "");
  const status = String(body["status"] ?? "");
  const totalAmount = String(body["total_amount"] ?? "");
  const hash = String(body["hash"] ?? "");

  const calc = base64HmacSha256(merchantKey, `${merchantOid}${merchantSalt}${status}${totalAmount}`);
  if (calc !== hash) {
    return c.text("PAYTR notification failed: bad hash", 400);
  }

  const p = await pool.query(
    `select id, teacher_id, plan_code, state
     from subscription_payments
     where merchant_oid = $1 and method = 'paytr_iframe'
     limit 1`,
    [merchantOid],
  );

  if (p.rowCount) {
    const row = p.rows[0] as { id: string; teacher_id: string; plan_code: string; state: string };
    if (row.state === "paid") return c.text("OK");

    if (status !== "success") {
      await pool.query(
        `update subscription_payments
         set state = 'failed', paytr_status = $2, paytr_total_amount_minor = $3::int, paytr_raw_jsonb = $4::jsonb, updated_at = now()
         where id = $1`,
        [row.id, status, Number(totalAmount), JSON.stringify(body)],
      );
      return c.text("OK");
    }

    const promoMultiplier = Number(process.env.SUB_PROMO_MULTIPLIER ?? "3");

    const plan = await pool.query(
      `select duration_months, price_minor, currency from subscription_plans where code = $1`,
      [row.plan_code],
    );
    const pl = plan.rows[0] as { duration_months: number; price_minor: number; currency: string };
    const totalMonths = pl.duration_months * Math.max(1, promoMultiplier);

    const client = await pool.connect();
    try {
      await client.query("begin");

      await client.query(
        `update subscription_payments
         set state = 'paid', paytr_status = $2, paytr_total_amount_minor = $3::int,
             paytr_raw_jsonb = $4::jsonb, updated_at = now()
         where id = $1 and state = 'pending'`,
        [row.id, status, Number(totalAmount), JSON.stringify(body)],
      );

      const sub = await client.query(
        `insert into teacher_subscriptions (
           teacher_id, plan_code, status, started_at, expires_at,
           promo_multiplier, paid_amount_minor, currency, payment_provider, external_ref, payment_id
         ) values (
           $1, $2::subscription_plan_code, 'active', now(),
           now() + ($3::text || ' months')::interval,
           $4, $5, $6, 'paytr', $7, $8
         )
         returning id`,
        [
          row.teacher_id,
          row.plan_code,
          String(totalMonths),
          promoMultiplier,
          pl.price_minor,
          pl.currency,
          merchantOid,
          row.id,
        ],
      );

      await client.query("commit");
      void sub;
    } catch {
      await client.query("rollback").catch(() => {});
    } finally {
      client.release();
    }

    return c.text("OK");
  }

  const cp = await pool.query(
    `select id, course_id, cohort_id, student_id, state, amount_minor
     from course_enrollment_payments
     where merchant_oid = $1 and method = 'paytr_iframe'
     limit 1`,
    [merchantOid],
  );
  if (!cp.rowCount) {
    const stp = await pool.query(
      `select p.id, p.subscription_id, p.state, p.user_id, s.months_count
       from student_sub_payments p
       join student_subscriptions s on s.id = p.subscription_id
       where p.merchant_oid = $1 and p.method = 'paytr_iframe'
       limit 1`,
      [merchantOid],
    );
    if (stp.rowCount) {
      const pr = stp.rows[0] as { id: string; subscription_id: string; state: string; user_id: string; months_count: number };
      if (pr.state === "paid") return c.text("OK");
      if (status !== "success") {
        await pool.query(
          `update student_sub_payments
           set state = 'failed', paytr_status = $2, paytr_total_amount_minor = $3::int, paytr_raw_jsonb = $4::jsonb, updated_at = now()
           where id = $1`,
          [pr.id, status, Number(totalAmount), JSON.stringify(body)],
        );
        return c.text("OK");
      }
      const ends = new Date();
      ends.setMonth(ends.getMonth() + pr.months_count);
      const cl = await pool.connect();
      try {
        await cl.query("begin");
        await cl.query(
          `update student_sub_payments
           set state = 'paid', paytr_status = $2, paytr_total_amount_minor = $3::int, paytr_raw_jsonb = $4::jsonb, updated_at = now()
           where id = $1 and state = 'pending'`,
          [pr.id, status, Number(totalAmount), JSON.stringify(body)],
        );
        await cl.query(
          `update student_subscriptions
           set lifecycle = 'active', starts_at = now(), expires_at = $1, updated_at = now()
           where id = $2 and lifecycle = 'awaiting_payment'`,
          [ends, pr.subscription_id],
        );
        await cl.query("commit");
      } catch {
        await cl.query("rollback").catch(() => {});
      } finally {
        cl.release();
      }
      return c.text("OK");
    }

    const wlt = await pool.query(
      `select id, user_id, amount_minor, state
       from wallet_topup_payments
       where merchant_oid = $1 and method = 'paytr_iframe'
       limit 1`,
      [merchantOid],
    );
    if (wlt.rowCount) {
      const wr = wlt.rows[0] as { id: string; user_id: string; amount_minor: number; state: string };
      if (wr.state === "paid") return c.text("OK");
      if (status !== "success") {
        await pool.query(
          `update wallet_topup_payments
           set state = 'failed', paytr_status = $2, paytr_total_amount_minor = $3::int, paytr_raw_jsonb = $4::jsonb, updated_at = now()
           where id = $1`,
          [wr.id, status, Number(totalAmount), JSON.stringify(body)],
        );
        return c.text("OK");
      }
      const wcl = await pool.connect();
      try {
        await wcl.query("begin");
        await wcl.query(
          `update wallet_topup_payments
           set state = 'paid', paytr_status = $2, paytr_total_amount_minor = $3::int, paytr_raw_jsonb = $4::jsonb, updated_at = now()
           where id = $1 and state = 'pending'`,
          [wr.id, status, Number(totalAmount), JSON.stringify(body)],
        );
        await applyWalletDelta({
          userId: wr.user_id,
          deltaMinor: wr.amount_minor,
          kind: "paytr_wallet_topup",
          refType: "wallet_topup_payments",
          refId: wr.id,
          client: wcl,
        });
        await wcl.query("commit");
      } catch {
        await wcl.query("rollback").catch(() => {});
      } finally {
        wcl.release();
      }
      return c.text("OK");
    }

    return c.text("OK");
  }

  const cRow = cp.rows[0] as {
    id: string;
    course_id: string;
    cohort_id: string;
    student_id: string;
    state: string;
    amount_minor: number;
  };
  if (cRow.state === "paid") return c.text("OK");

  if (status !== "success") {
    await pool.query(
      `update course_enrollment_payments
       set state = 'failed', paytr_status = $2, paytr_total_amount_minor = $3::int, paytr_raw_jsonb = $4::jsonb, updated_at = now()
       where id = $1`,
      [cRow.id, status, Number(totalAmount), JSON.stringify(body)],
    );
    return c.text("OK");
  }

  const cclient = await pool.connect();
  try {
    await cclient.query("begin");

    await cclient.query(
      `update course_enrollment_payments
       set state = 'paid', paytr_status = $2, paytr_total_amount_minor = $3::int,
           paytr_raw_jsonb = $4::jsonb, updated_at = now()
       where id = $1 and state = 'pending'`,
      [cRow.id, status, Number(totalAmount), JSON.stringify(body)],
    );

    const capQ = await cclient.query(
      `select cc.capacity,
              (select count(*)::int from course_enrollments e where e.cohort_id = cc.id) as enrolled_count
       from course_cohorts cc
       where cc.id = $1
       for update`,
      [cRow.cohort_id],
    );
    const capRow = capQ.rows[0] as { capacity: number | null; enrolled_count: number } | undefined;
    const over =
      capRow && capRow.capacity != null && capRow.enrolled_count >= capRow.capacity;

    if (over) {
      await cclient.query(
        `update course_enrollment_payments
         set fulfillment_error = 'cohort_full', updated_at = now()
         where id = $1`,
        [cRow.id],
      );
    } else {
      try {
        await cclient.query(
          `insert into course_enrollments (cohort_id, student_id) values ($1, $2)`,
          [cRow.cohort_id, cRow.student_id],
        );
      } catch (e) {
        const err = e as { code?: string };
        if (err.code !== "23505") throw e;
      }
    }

    await cclient.query("commit");
  } catch {
    await cclient.query("rollback").catch(() => {});
  } finally {
    cclient.release();
  }

  return c.text("OK");
});

