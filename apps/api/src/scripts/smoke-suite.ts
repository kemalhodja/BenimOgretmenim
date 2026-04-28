/**
 * Comprehensive smoke suite (prod-safe by default).
 *
 * It exercises:
 * - Public endpoints (health, meta, teachers, plans)
 * - Auth (register/login/me)
 * - Role-gated endpoints (expects 401/403 in certain cases)
 *
 * Does NOT do irreversible or paid actions (PayTR, wallet topups, subscription purchases).
 *
 * Usage:
 *   SMOKE_API_URL=https://your-api.example.com npm run -s smoke:suite
 */
const defaultPort = process.env.PORT ?? "3002";
const base = (process.env.SMOKE_API_URL ?? `http://127.0.0.1:${defaultPort}`).replace(/\/+$/, "");

type Json = Record<string, unknown>;

async function reqJson(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; ok: boolean; json: Json; headers: Headers }> {
  const url = `${base}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch (e) {
    throw new Error(`[smoke:suite] fetch failed ${path}: ${String(e)}`);
  }

  const ct = res.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().includes("application/json")) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `[smoke:suite] ${path} JSON değil (status=${res.status}, content-type=${ct}). İlk 200: ${body.slice(0, 200)}`,
    );
  }

  const json = (await res.json().catch((e) => {
    throw new Error(`[smoke:suite] ${path} JSON parse edilemedi: ${String(e)}`);
  })) as Json;

  return { status: res.status, ok: res.ok, json, headers: res.headers };
}

function tokenFrom(body: Json): string {
  const t = body.token;
  if (typeof t !== "string" || !t) throw new Error("[smoke:suite] token missing");
  return t;
}

function assert(
  name: string,
  cond: boolean,
  details?: unknown,
) {
  if (!cond) {
    console.error(`[smoke:suite] FAIL ${name}`, details ?? "");
    process.exitCode = 1;
    throw new Error(`assert_failed:${name}`);
  }
}

async function main() {
  const results: Array<{ step: string; status: number }> = [];
  const step = async (name: string, fn: () => Promise<{ status: number }>) => {
    const r = await fn();
    results.push({ step: name, status: r.status });
    return r;
  };

  // Public
  await step("root", async () => {
    const r = await reqJson("/");
    console.log("[smoke:suite] /", r.status);
    assert("root_ok", r.ok, r.json);
    assert("root_service", typeof r.json.service === "string", r.json);
    return r;
  });

  await step("health", async () => {
    const r = await reqJson("/health");
    console.log("[smoke:suite] /health", r.status, r.json);
    assert("health_ok", r.ok, r.json);
    assert("health_db_true", r.json.db === true, r.json);
    return r;
  });

  const branches = await step("meta_branches", async () => {
    const r = await reqJson("/v1/meta/branches");
    console.log("[smoke:suite] /v1/meta/branches", r.status);
    assert("branches_ok", r.ok, r.json);
    assert("branches_array", Array.isArray(r.json.branches), r.json);
    return r;
  });

  const cities = await step("meta_cities", async () => {
    const r = await reqJson("/v1/meta/cities");
    console.log("[smoke:suite] /v1/meta/cities", r.status);
    assert("cities_ok", r.ok, r.json);
    assert("cities_array", Array.isArray(r.json.cities), r.json);
    return r;
  });

  const firstCityId =
    Array.isArray((cities as unknown as { json?: Json }).json?.cities)
      ? ((cities as unknown as { json: { cities: Array<{ id?: unknown }> } }).json.cities[0]?.id as unknown)
      : undefined;

  await step("meta_districts_validation", async () => {
    const r = await reqJson("/v1/meta/districts");
    console.log("[smoke:suite] /v1/meta/districts (missing cityId)", r.status);
    assert("districts_400", r.status === 400, r.json);
    return r;
  });

  if (typeof firstCityId === "number") {
    await step("meta_districts", async () => {
      const r = await reqJson(`/v1/meta/districts?cityId=${firstCityId}`);
      console.log("[smoke:suite] /v1/meta/districts", r.status);
      assert("districts_ok", r.ok, r.json);
      assert("districts_array", Array.isArray(r.json.districts), r.json);
      return r;
    });
  }

  await step("teachers_list", async () => {
    const r = await reqJson("/v1/teachers?limit=5");
    console.log("[smoke:suite] /v1/teachers", r.status);
    assert("teachers_ok", r.ok, r.json);
    assert("teachers_array", Array.isArray(r.json.teachers), r.json);
    return r;
  });

  await step("teachers_validation_bad_uuid", async () => {
    const r = await reqJson("/v1/teachers/not-a-uuid");
    console.log("[smoke:suite] /v1/teachers/not-a-uuid", r.status);
    assert("teachers_bad_uuid_400", r.status === 400, r.json);
    return r;
  });

  await step("courses_public_list", async () => {
    const r = await reqJson("/v1/courses?limit=5");
    console.log("[smoke:suite] /v1/courses", r.status);
    assert("courses_ok", r.ok, r.json);
    return r;
  });

  await step("subscriptions_plans", async () => {
    const r = await reqJson("/v1/subscriptions/plans");
    console.log("[smoke:suite] /v1/subscriptions/plans", r.status);
    assert("plans_ok", r.ok, r.json);
    return r;
  });

  await step("paytr_callback_method_not_allowed_or_not_found", async () => {
    // PayTR callback is POST-only; GET should be 404 or 405, but must not 500.
    const r = await reqJson("/v1/paytr/callback");
    console.log("[smoke:suite] /v1/paytr/callback (GET)", r.status);
    assert("paytr_callback_get_not_500", r.status !== 500, r.json);
    return r;
  });

  await step("subscriptions_plans", async () => {
    const r = await reqJson("/v1/subscriptions/plans");
    console.log("[smoke:suite] /v1/subscriptions/plans", r.status);
    assert("plans_ok", r.ok, r.json);
    return r;
  });

  // Auth + role gates
  const ts = Date.now();
  const teacherEmail = `suite_teacher_${ts}@example.com`;
  const studentEmail = `suite_student_${ts}@example.com`;
  const guardianEmail = `suite_guardian_${ts}@example.com`;
  const password = "suite_test_12";

  const teacherReg = await step("register_teacher", async () => {
    const r = await reqJson("/v1/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: teacherEmail,
        password,
        displayName: "Suite Öğretmen",
        role: "teacher",
      }),
    });
    console.log("[smoke:suite] register teacher", r.status);
    assert("teacher_reg_201", r.status === 201, r.json);
    return r;
  });
  const teacherToken = tokenFrom((teacherReg as unknown as { json: Json }).json);

  const studentReg = await step("register_student", async () => {
    const r = await reqJson("/v1/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: studentEmail,
        password,
        displayName: "Suite Öğrenci",
        role: "student",
      }),
    });
    console.log("[smoke:suite] register student", r.status);
    assert("student_reg_201", r.status === 201, r.json);
    return r;
  });
  const studentToken = tokenFrom((studentReg as unknown as { json: Json }).json);
  const teacherAuth = { Authorization: `Bearer ${teacherToken}` };
  const studentAuth = { Authorization: `Bearer ${studentToken}` };

  const guardianReg = await step("register_guardian", async () => {
    const r = await reqJson("/v1/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: guardianEmail,
        password,
        displayName: "Suite Veli",
        role: "guardian",
      }),
    });
    console.log("[smoke:suite] register guardian", r.status);
    assert("guardian_reg_201", r.status === 201, r.json);
    return r;
  });
  const guardianToken = tokenFrom((guardianReg as unknown as { json: Json }).json);
  const guardianUserId = ((guardianReg as unknown as { json: { user?: { id?: unknown } } }).json.user?.id ??
    null) as unknown;
  assert("guardian_user_id_string", typeof guardianUserId === "string" && guardianUserId.length > 0, guardianReg);
  const guardianAuth = { Authorization: `Bearer ${guardianToken}` };

  await step("login_teacher", async () => {
    const r = await reqJson("/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: teacherEmail, password }),
    });
    console.log("[smoke:suite] login teacher", r.status);
    assert("teacher_login_ok", r.ok, r.json);
    return r;
  });

  await step("login_student", async () => {
    const r = await reqJson("/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: studentEmail, password }),
    });
    console.log("[smoke:suite] login student", r.status);
    assert("student_login_ok", r.ok, r.json);
    return r;
  });

  await step("me_teacher", async () => {
    const r = await reqJson("/v1/auth/me", { headers: teacherAuth });
    console.log("[smoke:suite] /v1/auth/me (teacher)", r.status);
    assert("me_teacher_ok", r.ok, r.json);
    return r;
  });

  await step("me_student", async () => {
    const r = await reqJson("/v1/auth/me", { headers: studentAuth });
    console.log("[smoke:suite] /v1/auth/me (student)", r.status);
    assert("me_student_ok", r.ok, r.json);
    return r;
  });

  await step("teacher_dashboard", async () => {
    const r = await reqJson("/v1/teacher/dashboard", {
      headers: teacherAuth,
    });
    console.log("[smoke:suite] /v1/teacher/dashboard", r.status);
    assert("teacher_dash_ok", r.ok, r.json);
    return r;
  });

  await step("teacher_me_get", async () => {
    const r = await reqJson("/v1/teacher/me", { headers: teacherAuth });
    console.log("[smoke:suite] /v1/teacher/me", r.status);
    assert("teacher_me_ok", r.ok, r.json);
    return r;
  });

  await step("student_forbidden_teacher_dashboard", async () => {
    const r = await reqJson("/v1/teacher/dashboard", {
      headers: studentAuth,
    });
    console.log("[smoke:suite] /v1/teacher/dashboard (student)", r.status);
    assert("teacher_dash_student_403", r.status === 403, r.json);
    return r;
  });

  await step("notifications_requires_auth", async () => {
    const r = await reqJson("/v1/notifications");
    console.log("[smoke:suite] /v1/notifications (anon)", r.status);
    assert("notifications_401_403", r.status === 401 || r.status === 403, r.json);
    return r;
  });

  await step("notifications_student", async () => {
    const r = await reqJson("/v1/notifications", {
      headers: studentAuth,
    });
    console.log("[smoke:suite] /v1/notifications (student)", r.status);
    assert("notifications_ok", r.ok, r.json);
    return r;
  });

  await step("guardian_overview_student_forbidden", async () => {
    const r = await reqJson("/v1/guardians/overview", { headers: studentAuth });
    console.log("[smoke:suite] /v1/guardians/overview (student)", r.status);
    assert("guardians_overview_student_403", r.status === 403, r.json);
    return r;
  });

  await step("guardian_link_teacher_forbidden", async () => {
    const r = await reqJson("/v1/guardians/link", {
      method: "POST",
      headers: { ...teacherAuth, "content-type": "application/json" },
      body: JSON.stringify({ guardianUserId: "00000000-0000-0000-0000-000000000000" }),
    });
    console.log("[smoke:suite] POST /v1/guardians/link (teacher)", r.status);
    assert("guardian_link_teacher_403", r.status === 403, r.json);
    return r;
  });

  await step("guardian_link_student_to_guardian", async () => {
    const r = await reqJson("/v1/guardians/link", {
      method: "POST",
      headers: { ...studentAuth, "content-type": "application/json" },
      body: JSON.stringify({ guardianUserId }),
    });
    console.log("[smoke:suite] POST /v1/guardians/link (student)", r.status);
    assert("guardian_link_status_ok", r.status === 200 || r.status === 201, r.json);
    return r;
  });

  await step("guardian_overview_guardian", async () => {
    const r = await reqJson("/v1/guardians/overview", { headers: guardianAuth });
    console.log("[smoke:suite] /v1/guardians/overview (guardian)", r.status);
    assert("guardians_overview_guardian_ok", r.ok, r.json);
    assert("guardians_students_array", Array.isArray(r.json.students), r.json);
    return r;
  });

  await step("onboarding_sessions_create_student_forbidden", async () => {
    const r = await reqJson("/v1/onboarding/sessions", {
      method: "POST",
      headers: { ...studentAuth, "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    console.log("[smoke:suite] POST /v1/onboarding/sessions (student)", r.status);
    assert("onboarding_create_student_403", r.status === 403, r.json);
    return r;
  });

  await step("onboarding_sessions_list_student_forbidden", async () => {
    const r = await reqJson("/v1/onboarding/sessions", { headers: studentAuth });
    console.log("[smoke:suite] GET /v1/onboarding/sessions (student)", r.status);
    assert("onboarding_list_student_403", r.status === 403, r.json);
    return r;
  });

  await step("onboarding_sessions_create_teacher", async () => {
    const r = await reqJson("/v1/onboarding/sessions", {
      method: "POST",
      headers: { ...teacherAuth, "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    console.log("[smoke:suite] POST /v1/onboarding/sessions (teacher)", r.status);
    assert("onboarding_create_teacher_201", r.status === 201, r.json);
    return r;
  });

  await step("onboarding_sessions_list_teacher", async () => {
    const r = await reqJson("/v1/onboarding/sessions", { headers: teacherAuth });
    console.log("[smoke:suite] GET /v1/onboarding/sessions (teacher)", r.status);
    assert("onboarding_list_teacher_ok", r.ok, r.json);
    return r;
  });

  await step("curriculum_mine_teacher_forbidden_or_empty", async () => {
    const r = await reqJson("/v1/curriculum/mine", {
      headers: teacherAuth,
    });
    console.log("[smoke:suite] /v1/curriculum/mine (teacher)", r.status);
    assert("curriculum_mine_ok", r.ok, r.json);
    return r;
  });

  await step("curriculum_mine_student_forbidden", async () => {
    const r = await reqJson("/v1/curriculum/mine", { headers: studentAuth });
    console.log("[smoke:suite] /v1/curriculum/mine (student)", r.status);
    assert("curriculum_mine_student_403", r.status === 403, r.json);
    return r;
  });

  await step("wallet_me_requires_auth", async () => {
    const r = await reqJson("/v1/wallet/me");
    console.log("[smoke:suite] /v1/wallet/me (anon)", r.status);
    assert("wallet_me_401_403", r.status === 401 || r.status === 403, r.json);
    return r;
  });

  await step("wallet_me_student", async () => {
    const r = await reqJson("/v1/wallet/me", { headers: studentAuth });
    console.log("[smoke:suite] /v1/wallet/me (student)", r.status);
    assert("wallet_me_student_ok", r.ok, r.json);
    return r;
  });

  await step("student_platform_subscription_status", async () => {
    const r = await reqJson("/v1/student-platform/subscription/me", { headers: studentAuth });
    console.log("[smoke:suite] /v1/student-platform/subscription/me", r.status);
    assert("student_platform_sub_ok", r.ok, r.json);
    return r;
  });

  await step("lesson_requests_gate_no_sub", async () => {
    const r = await reqJson("/v1/lesson-requests", {
      method: "POST",
      headers: { ...studentAuth, "content-type": "application/json" },
      body: JSON.stringify({
        branchId: 1,
        topic: "Suite konu",
        deliveryMode: "online",
        cityId: null,
      }),
    });
    console.log("[smoke:suite] POST /v1/lesson-requests", r.status);
    assert("lesson_requests_403", r.status === 403, r.json);
    return r;
  });

  console.log("[smoke:suite] OK", results);
}

main().catch((e) => {
  if (process.exitCode !== 1) process.exitCode = 1;
  console.error(String(e));
});

