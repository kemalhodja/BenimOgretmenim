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

describe("quality contract surfaces", () => {
  it("accepts valid funnel analytics events and rejects unknown events", async () => {
    if (!(await tableExists("funnel_events"))) return;

    const ok = await app.request("http://localhost/v1/analytics/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventName: "teacher_search",
        entityType: "test",
        entityId: "quality-contract",
        metadata: { source: "vitest" },
      }),
    });
    expect(ok.status).toBe(202);

    const bad = await app.request("http://localhost/v1/analytics/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventName: "not_a_real_event" }),
    });
    expect(bad.status).toBe(400);
  });

  it("requires homework and next-step notes for lesson completion evaluations", async () => {
    const token = await signAccessToken({
      userId: "00000000-0000-0000-0000-000000000001",
      role: "teacher",
    });

    const missingHomework = await app.request(
      "http://localhost/v1/lesson-sessions/00000000-0000-0000-0000-000000000002/evaluation",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          answers: {
            masteryLikert: 4,
            focusTopic: "Kesir problemleri",
            nextStepNote: "Bir sonraki derste problem çözümü tekrar edilecek.",
          },
        }),
      },
    );
    expect(missingHomework.status).toBe(400);

    const missingNextStep = await app.request(
      "http://localhost/v1/lesson-sessions/00000000-0000-0000-0000-000000000002/evaluation",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          answers: {
            masteryLikert: 4,
            focusTopic: "Kesir problemleri",
            homeworkNote: "12 tekrar sorusu çözülecek.",
          },
        }),
      },
    );
    expect(missingNextStep.status).toBe(400);
  });

  it("keeps public teacher search stable when relevance parameters are used", async () => {
    if (!(await tableExists("teachers"))) return;

    const res = await app.request("http://localhost/v1/teachers?q=matematik&limit=6&sort=recommended");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { teachers?: Array<{ id?: string }>; total?: unknown };
    expect(Array.isArray(body.teachers)).toBe(true);
    expect(typeof body.total).toBe("number");

    const teacherId = body.teachers?.find((teacher) => typeof teacher.id === "string")?.id;
    if (!teacherId) return;
    const detail = await app.request(`http://localhost/v1/teachers/${teacherId}`);
    expect(detail.status).toBe(200);
    const detailBody = (await detail.json()) as {
      teacher?: {
        profile_site?: {
          headline?: unknown;
          stats?: unknown;
          methodSteps?: unknown;
          faq?: unknown;
        };
      };
    };
    expect(typeof detailBody.teacher?.profile_site?.headline).toBe("string");
    expect(Array.isArray(detailBody.teacher?.profile_site?.stats)).toBe(true);
    expect(Array.isArray(detailBody.teacher?.profile_site?.methodSteps)).toBe(true);
    expect(Array.isArray(detailBody.teacher?.profile_site?.faq)).toBe(true);
  });

  it("serves curriculum tests without leaking answer keys and recommends support below 15/20", async () => {
    if (!(await tableExists("curriculum_test_questions"))) return;
    if (!(await tableExists("student_curriculum_test_attempts"))) return;

    const userId = "00000000-0000-0000-0000-000000000021";
    const studentId = "00000000-0000-0000-0000-000000000022";
    await pool.query(
      `insert into users (id, role, email, password_hash, display_name)
       values ($1, 'student', 'curriculum-test-student@example.com', 'x', 'Kazanım Test Öğrencisi')
       on conflict (id) do nothing`,
      [userId],
    );
    await pool.query(
      `insert into students (id, user_id, grade_level)
       values ($1, $2, 5)
       on conflict (id) do nothing`,
      [studentId, userId],
    );

    const token = await signAccessToken({ userId, role: "student" });
    const headers = { authorization: `Bearer ${token}` };
    const testRes = await app.request(
      "http://localhost/v1/learning/curriculum-tests?gradeLevel=5&branchSlug=ortaokul-matematik&unitSlug=sayilar-ve-islemler",
      { headers },
    );
    expect(testRes.status).toBe(200);
    const testBody = (await testRes.json()) as {
      test?: { questions?: Array<{ id: string; correctChoice?: unknown; explanation?: unknown }> };
    };
    expect(testBody.test?.questions?.length).toBe(20);
    expect(testBody.test?.questions?.[0]?.correctChoice).toBeUndefined();
    expect(testBody.test?.questions?.[0]?.explanation).toBeUndefined();

    const answers: Record<string, "A" | "B" | "C" | "D"> = {};
    for (const question of testBody.test?.questions ?? []) answers[question.id] = "A";
    const incompleteRes = await app.request("http://localhost/v1/learning/curriculum-test-attempts", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        gradeLevel: 5,
        branchSlug: "ortaokul-matematik",
        unitSlug: "sayilar-ve-islemler",
        answers: Object.fromEntries(Object.entries(answers).slice(0, 19)),
      }),
    });
    expect(incompleteRes.status).toBe(400);
    const incompleteBody = (await incompleteRes.json()) as { error?: unknown; missingQuestionIds?: unknown };
    expect(incompleteBody.error).toBe("incomplete_curriculum_test");
    expect(Array.isArray(incompleteBody.missingQuestionIds)).toBe(true);

    const invalidRes = await app.request("http://localhost/v1/learning/curriculum-test-attempts", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        gradeLevel: 5,
        branchSlug: "ortaokul-matematik",
        unitSlug: "sayilar-ve-islemler",
        answers: { ...answers, "not-from-this-test": "A" },
      }),
    });
    expect(invalidRes.status).toBe(400);
    const invalidBody = (await invalidRes.json()) as { error?: unknown; invalidQuestionIds?: unknown };
    expect(invalidBody.error).toBe("invalid_curriculum_question_ids");
    expect(Array.isArray(invalidBody.invalidQuestionIds)).toBe(true);

    const submitRes = await app.request("http://localhost/v1/learning/curriculum-test-attempts", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        gradeLevel: 5,
        branchSlug: "ortaokul-matematik",
        unitSlug: "sayilar-ve-islemler",
        answers,
      }),
    });
    expect(submitRes.status).toBe(201);
    const submitBody = (await submitRes.json()) as {
      attempt?: {
        questionCount?: number;
        correctCount?: number;
        masteryLevel?: unknown;
        recommendedActions?: unknown;
        teacherSupportRecommended?: boolean;
      };
    };
    expect(submitBody.attempt?.questionCount).toBe(20);
    expect((submitBody.attempt?.correctCount ?? 20) < 15).toBe(true);
    expect(submitBody.attempt?.teacherSupportRecommended).toBe(true);
    expect(typeof submitBody.attempt?.masteryLevel).toBe("string");
    expect(Array.isArray(submitBody.attempt?.recommendedActions)).toBe(true);

    const keyRows = await pool.query<{ id: string; correct_choice: "A" | "B" | "C" | "D" }>(
      `select id, correct_choice
       from curriculum_test_questions
       where grade_level = 5
         and branch_slug = 'ortaokul-matematik'
         and unit_slug = 'sayilar-ve-islemler'
       order by sort_order
       limit 20`,
    );
    const boundaryAnswers: Record<string, "A" | "B" | "C" | "D"> = {};
    keyRows.rows.forEach((row, index) => {
      boundaryAnswers[row.id] = index < 15 ? row.correct_choice : row.correct_choice === "A" ? "B" : "A";
    });
    const boundaryRes = await app.request("http://localhost/v1/learning/curriculum-test-attempts", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        gradeLevel: 5,
        branchSlug: "ortaokul-matematik",
        unitSlug: "sayilar-ve-islemler",
        answers: boundaryAnswers,
      }),
    });
    expect(boundaryRes.status).toBe(201);
    const boundaryBody = (await boundaryRes.json()) as {
      attempt?: { correctCount?: number; teacherSupportRecommended?: boolean };
    };
    expect(boundaryBody.attempt?.correctCount).toBe(15);
    expect(boundaryBody.attempt?.teacherSupportRecommended).toBe(false);
  });

  it("returns a stable weekly quality report shape for admins", async () => {
    if (!(await dbReady())) return;

    const token = await signAccessToken({
      userId: "00000000-0000-0000-0000-000000000003",
      role: "admin",
    });
    const headers: Record<string, string> = { authorization: `Bearer ${token}` };
    const adminSecret = process.env.ADMIN_API_SECRET?.trim();
    if (adminSecret) headers["x-admin-secret"] = adminSecret;

    const res = await app.request("http://localhost/v1/admin/quality/weekly-report", { headers });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      periodDays?: unknown;
      funnel?: unknown;
      revenue?: Record<string, unknown>;
      seo?: Record<string, unknown>;
      operations?: Record<string, unknown>;
      warnings?: { missingTables?: unknown; partial?: unknown };
    };
    expect(body.periodDays).toBe(7);
    expect(Array.isArray(body.funnel)).toBe(true);
    expect(body.revenue).toBeTruthy();
    expect(body.seo).toBeTruthy();
    expect(body.operations).toBeTruthy();
    expect(Array.isArray(body.warnings?.missingTables)).toBe(true);
    expect(typeof body.warnings?.partial).toBe("boolean");
  });
});
