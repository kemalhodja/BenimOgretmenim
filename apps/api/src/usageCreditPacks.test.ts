import { describe, expect, it } from "vitest";
import { app } from "./app.js";
import { signAccessToken } from "./auth/jwt.js";
import { pool } from "./db.js";
import { applyWalletDelta } from "./lib/wallet.js";

async function usageCreditTablesAvailable(): Promise<boolean> {
  const health = await app.request("http://localhost/health");
  if (health.status !== 200) return false;
  const r = await pool.query<{ exists: boolean }>(
    `select to_regclass('public.usage_credit_packs') is not null
        and to_regclass('public.user_usage_credits') is not null
        and to_regclass('public.usage_credit_payments') is not null as exists`,
  );
  return r.rows[0]?.exists === true;
}

async function createStudent(suffix: string): Promise<{ userId: string; token: string }> {
  const user = await pool.query<{ id: string }>(
    `insert into users (email, display_name, role)
     values ($1, $2, 'student')
     returning id`,
    [`usage-credit-student-${suffix}@example.test`, `Usage Credit Student ${suffix}`],
  );
  const userId = user.rows[0].id;
  await pool.query(`insert into students (user_id) values ($1)`, [userId]);
  const token = await signAccessToken({ userId, role: "student" });
  return { userId, token };
}

describe("usage credit packs", () => {
  it("lets a student buy daily extra rights from wallet", async () => {
    if (!(await usageCreditTablesAvailable())) return;

    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const createdUserIds: string[] = [];
    try {
      const student = await createStudent(suffix);
      createdUserIds.push(student.userId);
      await applyWalletDelta({
        userId: student.userId,
        deltaMinor: 12_900,
        kind: "test_wallet_grant",
      });

      const purchase = await app.request(
        "http://localhost/v1/student-platform/usage-packs/student_combo_day_129/purchase",
        {
          method: "POST",
          headers: { authorization: `Bearer ${student.token}` },
        },
      );
      expect(purchase.status).toBe(201);

      const me = await app.request("http://localhost/v1/student-platform/subscription/me", {
        headers: { authorization: `Bearer ${student.token}` },
      });
      expect(me.status).toBe(200);
      const body = (await me.json()) as {
        usage: { extraLessonRequestCredits: number; extraHomeworkCredits: number } | null;
      };
      expect(body.usage?.extraLessonRequestCredits).toBe(3);
      expect(body.usage?.extraHomeworkCredits).toBe(10);
    } finally {
      await pool.query(`delete from users where id = any($1::uuid[])`, [createdUserIds]);
    }
  });
});
