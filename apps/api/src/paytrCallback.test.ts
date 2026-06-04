import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
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
});
