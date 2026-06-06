import { describe, expect, it } from "vitest";
import { app } from "./app.js";
import { signAccessToken } from "./auth/jwt.js";
import { pool } from "./db.js";
import { applyWalletDelta } from "./lib/wallet.js";

async function withdrawalTablesAvailable(): Promise<boolean> {
  const health = await app.request("http://localhost/health");
  if (health.status !== 200) return false;
  const r = await pool.query<{ ok: boolean }>(
    `select to_regclass('public.teacher_wallet_withdrawals') is not null
        and to_regclass('public.user_notifications') is not null as ok`,
  );
  return r.rows[0]?.ok === true;
}

async function createUser(role: "admin" | "teacher" | "student", suffix: string) {
  const user = await pool.query<{ id: string }>(
    `insert into users (email, display_name, role) values ($1, $2, $3) returning id`,
    [`teacher-withdrawal-${role}-${suffix}@example.test`, `Teacher Withdrawal ${role} ${suffix}`, role],
  );
  const userId = user.rows[0].id;
  let profileId = "";
  if (role === "teacher") {
    const teacher = await pool.query<{ id: string }>(`insert into teachers (user_id) values ($1) returning id`, [
      userId,
    ]);
    profileId = teacher.rows[0].id;
  } else if (role === "student") {
    const student = await pool.query<{ id: string }>(`insert into students (user_id) values ($1) returning id`, [
      userId,
    ]);
    profileId = student.rows[0].id;
  }
  const token = await signAccessToken({ userId, role });
  return { userId, profileId, token };
}

describe("teacher wallet withdrawals", () => {
  it("reserves teacher balance, lets admin pay or reject, and remains idempotent", async () => {
    if (!(await withdrawalTablesAvailable())) return;

    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const createdUserIds: string[] = [];
    try {
      const admin = await createUser("admin", suffix);
      const teacher = await createUser("teacher", suffix);
      const student = await createUser("student", suffix);
      createdUserIds.push(admin.userId, teacher.userId, student.userId);

      const forbidden = await app.request("http://localhost/v1/wallet/withdrawals", {
        method: "POST",
        headers: {
          authorization: `Bearer ${student.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          amountMinor: 10_000,
          iban: "TR330006100519786457841326",
          accountHolderName: "Student User",
        }),
      });
      expect(forbidden.status).toBe(403);

      await applyWalletDelta({
        userId: teacher.userId,
        deltaMinor: 200_000,
        kind: "test_teacher_payout",
        refType: "teacher_wallet_withdrawal_test",
        refId: suffix,
      });

      const create = await app.request("http://localhost/v1/wallet/withdrawals", {
        method: "POST",
        headers: {
          authorization: `Bearer ${teacher.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          amountMinor: 150_000,
          iban: "TR330006100519786457841326",
          accountHolderName: "Teacher Withdrawal",
          bankName: "Test Bank",
        }),
      });
      expect(create.status).toBe(201);
      const createBody = (await create.json()) as { withdrawal: { id: string; status: string } };
      expect(createBody.withdrawal.status).toBe("pending");

      const walletAfterRequest = await pool.query<{ balance_minor: string }>(
        `select balance_minor from user_wallets where user_id = $1`,
        [teacher.userId],
      );
      expect(walletAfterRequest.rows[0]?.balance_minor).toBe("50000");
      const reserveLedger = await pool.query<{ count: string }>(
        `select count(*)::text as count
         from user_wallet_ledger
         where user_id = $1
           and kind = 'teacher_withdrawal_reserved'
           and ref_id = $2`,
        [teacher.userId, createBody.withdrawal.id],
      );
      expect(reserveLedger.rows[0]?.count).toBe("1");

      const missingReceipt = await app.request(
        `http://localhost/v1/admin/teacher-withdrawals/${createBody.withdrawal.id}/status`,
        {
          method: "PATCH",
          headers: {
            authorization: `Bearer ${admin.token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ status: "paid", note: "Ödendi" }),
        },
      );
      expect(missingReceipt.status).toBe(400);

      const paid = await app.request(`http://localhost/v1/admin/teacher-withdrawals/${createBody.withdrawal.id}/status`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${admin.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ status: "paid", note: "Banka transferi tamamlandı", bankReceiptRef: "DEKONT-1" }),
      });
      expect(paid.status).toBe(200);
      const paidWallet = await pool.query<{ balance_minor: string }>(
        `select balance_minor from user_wallets where user_id = $1`,
        [teacher.userId],
      );
      expect(paidWallet.rows[0]?.balance_minor).toBe("50000");
      const paidAgain = await app.request(
        `http://localhost/v1/admin/teacher-withdrawals/${createBody.withdrawal.id}/status`,
        {
          method: "PATCH",
          headers: {
            authorization: `Bearer ${admin.token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ status: "paid", note: "Tekrar", bankReceiptRef: "DEKONT-1" }),
        },
      );
      expect(paidAgain.status).toBe(200);

      const second = await app.request("http://localhost/v1/wallet/withdrawals", {
        method: "POST",
        headers: {
          authorization: `Bearer ${teacher.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          amountMinor: 50_000,
          iban: "TR330006100519786457841326",
          accountHolderName: "Teacher Withdrawal",
        }),
      });
      expect(second.status).toBe(201);
      const secondBody = (await second.json()) as { withdrawal: { id: string } };
      const rejected = await app.request(`http://localhost/v1/admin/teacher-withdrawals/${secondBody.withdrawal.id}/status`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${admin.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ status: "rejected", note: "IBAN doğrulanamadı" }),
      });
      expect(rejected.status).toBe(200);
      const rejectedWallet = await pool.query<{ balance_minor: string }>(
        `select balance_minor from user_wallets where user_id = $1`,
        [teacher.userId],
      );
      expect(rejectedWallet.rows[0]?.balance_minor).toBe("50000");
      const refundLedger = await pool.query<{ count: string }>(
        `select count(*)::text as count
         from user_wallet_ledger
         where user_id = $1
           and kind = 'teacher_withdrawal_rejected_refund'
           and ref_id = $2`,
        [teacher.userId, secondBody.withdrawal.id],
      );
      expect(refundLedger.rows[0]?.count).toBe("1");

      const adminList = await app.request("http://localhost/v1/admin/teacher-withdrawals?status=rejected", {
        headers: { authorization: `Bearer ${admin.token}` },
      });
      expect(adminList.status).toBe(200);
      const teacherList = await app.request("http://localhost/v1/wallet/withdrawals", {
        headers: { authorization: `Bearer ${teacher.token}` },
      });
      expect(teacherList.status).toBe(200);
      const notifications = await pool.query<{ count: string }>(
        `select count(*)::text as count
         from user_notifications
         where recipient_user_id = $1
           and payload_jsonb->>'kind' in ('teacher_wallet_withdrawal_requested', 'teacher_wallet_withdrawal_decision')`,
        [teacher.userId],
      );
      expect(Number(notifications.rows[0]?.count ?? "0")).toBeGreaterThanOrEqual(3);
    } finally {
      await pool.query(`delete from teacher_wallet_withdrawals where teacher_user_id = any($1::uuid[])`, [
        createdUserIds,
      ]);
      await pool.query(`delete from users where id = any($1::uuid[])`, [createdUserIds]);
    }
  });
});
