import { describe, expect, it } from "vitest";
import { app } from "./app.js";
import { signAccessToken } from "./auth/jwt.js";
import { pool } from "./db.js";

async function dbReady(): Promise<boolean> {
  const health = await app.request("http://localhost/health");
  return health.status === 200;
}

async function tableExists(table: string): Promise<boolean> {
  if (!(await dbReady())) return false;
  const r = await pool.query<{ exists: boolean }>(
    `select to_regclass($1) is not null as exists`,
    [`public.${table}`],
  );
  return r.rows[0]?.exists === true;
}

describe("product vision API surfaces", () => {
  it("exposes public instant-ready and zigo feed without auth", async () => {
    const instant = await app.request("http://localhost/v1/teachers/instant-ready");
    expect(instant.status).toBe(200);
    const instantBody = (await instant.json()) as { teachers?: unknown };
    expect(Array.isArray(instantBody.teachers)).toBe(true);

    const zigo = await app.request("http://localhost/v1/zigo/teacher-feed");
    expect(zigo.status).toBe(200);
    const zigoBody = (await zigo.json()) as { items?: unknown; integration?: string };
    expect(Array.isArray(zigoBody.items)).toBe(true);
    expect(zigoBody.integration).toBe("zigo_feed_v1");
  });

  it("requires auth for teacher-match, messages, and guardian credit pools", async () => {
    const match = await app.request("http://localhost/v1/learning/teacher-match?branchSlug=matematik");
    expect(match.status).toBe(401);

    const threads = await app.request("http://localhost/v1/messages/threads");
    expect(threads.status).toBe(401);

    const credits = await app.request("http://localhost/v1/guardians/lesson-credits");
    expect(credits.status).toBe(401);
  });

  it("rejects non-guardian roles on guardian-only endpoints", async () => {
    const studentToken = await signAccessToken({
      userId: "00000000-0000-0000-0000-000000000099",
      role: "student",
    });
    const headers = { authorization: `Bearer ${studentToken}` };

    const credits = await app.request("http://localhost/v1/guardians/lesson-credits", { headers });
    expect(credits.status).toBe(403);

    const reports = await app.request("http://localhost/v1/guardians/weekly-reports", { headers });
    expect(reports.status).toBe(403);
  });

  it("validates teacher availability slot path params", async () => {
    const bad = await app.request("http://localhost/v1/teachers/not-a-uuid/availability-slots");
    expect(bad.status).toBe(400);
  });

  it("returns paytr_not_configured on meta payments when PayTR env absent", async () => {
    const res = await app.request("http://localhost/v1/meta/payments");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { paytrAvailable?: boolean; message?: string };
    if (!process.env.PAYTR_MERCHANT_ID?.trim()) {
      expect(body.paytrAvailable).toBe(false);
      expect(body.message).toContain("PayTR");
    }
  });

  it("classifies homework with curriculum match fields in metadata", async () => {
    delete process.env.HOMEWORK_AI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const { classifyHomeworkPost } = await import("./lib/homeworkPosts.js");
    const result = await classifyHomeworkPost({
      branchId: 1,
      branchSlug: "matematik",
      topic: "Polinom",
      helpText: "Çarpanlara ayırma sorusu çözemedim",
      urgencyLevel: "normal",
      imageUrls: ["https://example.test/homework.png"],
      targetExam: "LGS",
    });

    expect(result.aiMetadata.provider).toBe("heuristic_v2");
    expect(Array.isArray(result.aiMetadata.matched_curriculum_outcomes)).toBe(true);
    expect(result.aiMetadata).toHaveProperty("primary_outcome");
  });

  it("allocates guardian lesson credits when DB and link exist", async () => {
    if (!(await tableExists("guardian_lesson_credit_pools"))) return;
    if (!(await tableExists("student_guardians"))) return;

    const guardian = await pool.query<{ id: string }>(
      `insert into users (email, display_name, role)
       values ($1, 'GV Test', 'guardian')
       returning id`,
      [`guardian-credit-${Date.now()}@example.test`],
    );
    const studentUser = await pool.query<{ id: string }>(
      `insert into users (email, display_name, role)
       values ($1, 'ST Test', 'student')
       returning id`,
      [`student-credit-${Date.now()}@example.test`],
    );
    const student = await pool.query<{ id: string }>(
      `insert into students (user_id) values ($1) returning id`,
      [studentUser.rows[0].id],
    );
    await pool.query(
      `insert into student_guardians (student_id, guardian_user_id) values ($1, $2)
       on conflict do nothing`,
      [student.rows[0].id, guardian.rows[0].id],
    );
    await pool.query(
      `insert into user_wallets (user_id, balance_minor, currency)
       values ($1, 500000, 'TRY')
       on conflict (user_id) do update set balance_minor = 500000`,
      [guardian.rows[0].id],
    );

    const token = await signAccessToken({ userId: guardian.rows[0].id, role: "guardian" });
    const res = await app.request("http://localhost/v1/guardians/lesson-credits", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        studentId: student.rows[0].id,
        monthlyCredits: 2,
        perLessonBudgetMinor: 15000,
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok?: boolean; creditsRemaining?: number };
    expect(body.ok).toBe(true);
    expect(body.creditsRemaining).toBe(2);
  });

  it("runs weekly report job for admin without throwing", async () => {
    if (!(await dbReady())) return;

    const token = await signAccessToken({
      userId: "00000000-0000-0000-0000-000000000003",
      role: "admin",
    });
    const prev = process.env.ADMIN_API_SECRET;
    process.env.ADMIN_API_SECRET = process.env.ADMIN_API_SECRET ?? "test-admin-secret";

    const res = await app.request("http://localhost/v1/admin/weekly-reports/run", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "x-admin-secret": process.env.ADMIN_API_SECRET,
      },
    });

    if (prev === undefined) delete process.env.ADMIN_API_SECRET;
    else process.env.ADMIN_API_SECRET = prev;

    expect([200, 403]).toContain(res.status);
    if (res.status === 200) {
      const body = (await res.json()) as { ok?: boolean; result?: { created: number } };
      expect(body.ok).toBe(true);
      expect(typeof body.result?.created).toBe("number");
    }
  });

  it("creates instant lesson session contract when teacher is ready", async () => {
    if (!(await tableExists("instant_lesson_sessions"))) return;
    if (!(await tableExists("teachers"))) return;

    const teacherUser = await pool.query<{ id: string }>(
      `insert into users (email, display_name, role) values ($1, 'Instant T', 'teacher') returning id`,
      [`instant-t-${Date.now()}@example.test`],
    );
    const teacher = await pool.query<{ id: string }>(
      `insert into teachers (user_id, instant_lesson_available, instant_ready_until, verification_status)
       values ($1, true, now() + interval '2 hours', 'verified')
       returning id`,
      [teacherUser.rows[0].id],
    );
    const studentUser = await pool.query<{ id: string }>(
      `insert into users (email, display_name, role) values ($1, 'Instant S', 'student') returning id`,
      [`instant-s-${Date.now()}@example.test`],
    );
    await pool.query(`insert into students (user_id) values ($1)`, [studentUser.rows[0].id]);

    const token = await signAccessToken({ userId: studentUser.rows[0].id, role: "student" });
    const res = await app.request("http://localhost/v1/student-platform/instant-lessons", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ teacherId: teacher.rows[0].id }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { session?: { id: string; status: string } };
    expect(body.session?.status).toBe("pending_payment");
  });
});
