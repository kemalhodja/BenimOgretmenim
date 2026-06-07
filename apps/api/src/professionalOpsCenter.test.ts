import { describe, expect, it } from "vitest";
import { app } from "./app.js";
import { signAccessToken } from "./auth/jwt.js";
import { pool } from "./db.js";
import { applyWalletDelta } from "./lib/wallet.js";

async function opsTablesAvailable(): Promise<boolean> {
  const health = await app.request("http://localhost/health");
  if (health.status !== 200) return false;
  const r = await pool.query<{ ok: boolean }>(
    `select to_regclass('public.platform_disputes') is not null
        and to_regclass('public.platform_job_heartbeats') is not null
        and to_regclass('public.teacher_wallet_withdrawals') is not null as ok`,
  );
  return r.rows[0]?.ok === true;
}

async function createUser(role: "admin" | "teacher" | "student", suffix: string) {
  const user = await pool.query<{ id: string }>(
    `insert into users (email, display_name, role) values ($1, $2, $3) returning id`,
    [`pro-ops-${role}-${suffix}@example.test`, `Pro Ops ${role} ${suffix}`, role],
  );
  const userId = user.rows[0].id;
  if (role === "teacher") await pool.query(`insert into teachers (user_id) values ($1)`, [userId]);
  if (role === "student") await pool.query(`insert into students (user_id) values ($1)`, [userId]);
  const token = await signAccessToken({ userId, role });
  return { userId, token };
}

describe("professional operations center", () => {
  it("tracks disputes, job alerts, and bank export for withdrawals", async () => {
    if (!(await opsTablesAvailable())) return;

    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const createdUserIds: string[] = [];
    try {
      const admin = await createUser("admin", suffix);
      const teacher = await createUser("teacher", suffix);
      const student = await createUser("student", suffix);
      createdUserIds.push(admin.userId, teacher.userId, student.userId);

      const dispute = await app.request("http://localhost/v1/support/disputes", {
        method: "POST",
        headers: {
          authorization: `Bearer ${student.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          subjectType: "other",
          reason: "Ödeme itirazı",
          description: "Ders ödeme süreci için kayıtlı inceleme istiyorum.",
          requestedResolution: "Admin incelemesi",
        }),
      });
      expect(dispute.status).toBe(201);
      const disputeBody = (await dispute.json()) as { dispute: { id: string; status: string } };
      expect(disputeBody.dispute.status).toBe("open");

      const adminDisputes = await app.request("http://localhost/v1/admin/disputes?status=open", {
        headers: { authorization: `Bearer ${admin.token}` },
      });
      expect(adminDisputes.status).toBe(200);

      const resolved = await app.request(`http://localhost/v1/admin/disputes/${disputeBody.dispute.id}/status`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${admin.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ status: "resolved", resolutionNote: "Kayıt incelendi ve çözüldü." }),
      });
      expect(resolved.status).toBe(200);

      await pool.query(
        `insert into platform_job_heartbeats (
           job_name, expected_interval_minutes, status, last_started_at, last_finished_at, last_success_at
         )
         values ('test:stale-job', 5, 'success', now() - interval '1 hour', now() - interval '1 hour', now() - interval '1 hour')
         on conflict (job_name) do update
         set last_success_at = excluded.last_success_at, updated_at = now()`,
      );
      const jobs = await app.request("http://localhost/v1/admin/job-monitoring", {
        headers: { authorization: `Bearer ${admin.token}` },
      });
      expect(jobs.status).toBe(200);
      const jobsBody = (await jobs.json()) as { summary: { openAlerts: number } };
      expect(jobsBody.summary.openAlerts).toBeGreaterThanOrEqual(1);

      await applyWalletDelta({
        userId: teacher.userId,
        deltaMinor: 100_000,
        kind: "test_teacher_payout",
        refType: "professional_ops_test",
        refId: suffix,
      });
      const withdrawal = await app.request("http://localhost/v1/wallet/withdrawals", {
        method: "POST",
        headers: {
          authorization: `Bearer ${teacher.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          amountMinor: 50_000,
          iban: "TR330006100519786457841326",
          accountHolderName: "Pro Ops Teacher",
        }),
      });
      expect(withdrawal.status).toBe(201);
      const exportRes = await app.request("http://localhost/v1/admin/teacher-withdrawals?status=pending&export=bank_csv", {
        headers: { authorization: `Bearer ${admin.token}` },
      });
      expect(exportRes.status).toBe(200);
      const exportBody = (await exportRes.json()) as { export: { csv: string; filename: string }; count: number };
      expect(exportBody.export.filename).toContain("teacher-withdrawals.csv");
      expect(exportBody.export.csv).toContain("Pro Ops Teacher");
      expect(exportBody.count).toBeGreaterThanOrEqual(1);
    } finally {
      await pool.query(`delete from platform_job_heartbeats where job_name = 'test:stale-job'`);
      await pool.query(`delete from teacher_wallet_withdrawals where teacher_user_id = any($1::uuid[])`, [createdUserIds]);
      await pool.query(`delete from users where id = any($1::uuid[])`, [createdUserIds]);
    }
  });
});
