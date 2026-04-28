/**
 * End-to-end smoke (production-safe): avoids wallet/payments/subscriptions.
 *
 * Usage:
 *   SMOKE_API_URL=https://your-api.example.com npm run -s smoke:e2e
 */
const defaultPort = process.env.PORT ?? "3002";
const base = (process.env.SMOKE_API_URL ?? `http://127.0.0.1:${defaultPort}`).replace(/\/+$/, "");

type Json = Record<string, unknown>;

async function reqJson(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; ok: boolean; json: Json; headers: Headers }> {
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch (e) {
    throw new Error(`[smoke:e2e] ${path} fetch failed: ${String(e)}`);
  }

  const ct = res.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().includes("application/json")) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `[smoke:e2e] ${path} JSON değil (status=${res.status}, content-type=${ct}). İlk 200: ${body.slice(0, 200)}`,
    );
  }
  const json = (await res.json().catch((e) => {
    throw new Error(`[smoke:e2e] ${path} JSON parse edilemedi: ${String(e)}`);
  })) as Json;

  return { status: res.status, ok: res.ok, json, headers: res.headers };
}

function assertOk(step: string, r: { ok: boolean; status: number; json: Json }) {
  if (!r.ok) {
    console.error(`[smoke:e2e] FAIL ${step} status=${r.status}`, r.json);
    process.exitCode = 1;
    throw new Error(`step_failed:${step}`);
  }
}

function getToken(body: Json): string {
  const t = body.token;
  if (typeof t !== "string" || !t) throw new Error("[smoke:e2e] token missing");
  return t;
}

async function main() {
  // 0) Health + public meta
  const health = await reqJson("/health");
  console.log("[smoke:e2e] GET /health", health.status, health.json);
  assertOk("health", health);

  const branches = await reqJson("/v1/meta/branches");
  console.log("[smoke:e2e] GET /v1/meta/branches", branches.status);
  assertOk("meta_branches", branches);

  const cities = await reqJson("/v1/meta/cities");
  console.log("[smoke:e2e] GET /v1/meta/cities", cities.status);
  assertOk("meta_cities", cities);

  // pick branch + city if available
  const branchId =
    Array.isArray(branches.json.branches) && branches.json.branches.length > 0
      ? (branches.json.branches[0] as { id?: unknown }).id
      : undefined;
  const cityId =
    Array.isArray(cities.json.cities) && cities.json.cities.length > 0
      ? (cities.json.cities[0] as { id?: unknown }).id
      : undefined;

  // 1) Register teacher + student
  const ts = Date.now();
  const teacherEmail = `e2e_teacher_${ts}@example.com`;
  const studentEmail = `e2e_student_${ts}@example.com`;
  const password = "e2e_test_12";

  const regTeacher = await reqJson("/v1/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: teacherEmail,
      password,
      displayName: "E2E Öğretmen",
      role: "teacher",
    }),
  });
  console.log("[smoke:e2e] POST /v1/auth/register (teacher)", regTeacher.status);
  assertOk("register_teacher", regTeacher);
  const teacherToken = getToken(regTeacher.json);

  const regStudent = await reqJson("/v1/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: studentEmail,
      password,
      displayName: "E2E Öğrenci",
      role: "student",
    }),
  });
  console.log("[smoke:e2e] POST /v1/auth/register (student)", regStudent.status);
  assertOk("register_student", regStudent);
  const studentToken = getToken(regStudent.json);

  const teacherAuth = { Authorization: `Bearer ${teacherToken}` };
  const studentAuth = { Authorization: `Bearer ${studentToken}` };

  // 2) Teacher profile minimal update
  const patchMe = await reqJson("/v1/teacher/me", {
    method: "PATCH",
    headers: { ...teacherAuth, "content-type": "application/json" },
    body: JSON.stringify({
      bioRaw: "E2E bio: üretim smoke testi için.",
      cityId: typeof cityId === "number" ? cityId : null,
    }),
  });
  console.log("[smoke:e2e] PATCH /v1/teacher/me", patchMe.status);
  assertOk("teacher_patch_me", patchMe);

  // 3) Public teachers list should work
  const teachersList = await reqJson("/v1/teachers?limit=5");
  console.log("[smoke:e2e] GET /v1/teachers?limit=5", teachersList.status);
  assertOk("teachers_list", teachersList);

  // 4) Create a lesson request as student (if route exists)
  // This endpoint requires an active student subscription in production.
  // We deliberately assert the gate (403) instead of doing any paid flow.
  const lr = await reqJson("/v1/lesson-requests", {
    method: "POST",
    headers: { ...studentAuth, "content-type": "application/json" },
    body: JSON.stringify({
      branchId: typeof branchId === "number" ? branchId : 1,
      topic: "E2E konu",
      deliveryMode: "online",
      cityId: typeof cityId === "number" ? cityId : null,
      note: "E2E: abonelik yoksa 403 beklenir.",
    }),
  });
  console.log("[smoke:e2e] POST /v1/lesson-requests", lr.status);
  if (lr.status !== 403 || lr.json.error !== "student_platform_subscription_required") {
    console.error("[smoke:e2e] lesson-requests gate beklenenden farklı", lr.status, lr.json);
    process.exitCode = 1;
    throw new Error("lesson_request_gate_unexpected");
  }

  // 5) Teacher endpoints sanity (no paid actions)
  const dash = await reqJson("/v1/teacher/dashboard", { headers: teacherAuth });
  console.log("[smoke:e2e] GET /v1/teacher/dashboard", dash.status);
  assertOk("teacher_dashboard", dash);

  console.log("[smoke:e2e] OK");
}

main().catch((e) => {
  if (process.exitCode !== 1) process.exitCode = 1;
  console.error(String(e));
});

