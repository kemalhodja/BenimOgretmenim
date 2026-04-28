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

  await step("me_teacher", async () => {
    const r = await reqJson("/v1/auth/me", { headers: { Authorization: `Bearer ${teacherToken}` } });
    console.log("[smoke:suite] /v1/auth/me (teacher)", r.status);
    assert("me_teacher_ok", r.ok, r.json);
    return r;
  });

  await step("teacher_dashboard", async () => {
    const r = await reqJson("/v1/teacher/dashboard", {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    console.log("[smoke:suite] /v1/teacher/dashboard", r.status);
    assert("teacher_dash_ok", r.ok, r.json);
    return r;
  });

  await step("student_forbidden_teacher_dashboard", async () => {
    const r = await reqJson("/v1/teacher/dashboard", {
      headers: { Authorization: `Bearer ${studentToken}` },
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
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    console.log("[smoke:suite] /v1/notifications (student)", r.status);
    assert("notifications_ok", r.ok, r.json);
    return r;
  });

  await step("curriculum_mine_teacher_forbidden_or_empty", async () => {
    const r = await reqJson("/v1/curriculum/mine", {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    console.log("[smoke:suite] /v1/curriculum/mine (teacher)", r.status);
    assert("curriculum_mine_ok_or_403", r.ok || r.status === 403, r.json);
    return r;
  });

  await step("lesson_requests_gate_no_sub", async () => {
    const r = await reqJson("/v1/lesson-requests", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentToken}`, "content-type": "application/json" },
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

