/**
 * Öğretmen + öğrenci + veli uçtan uca senaryolar (yerel API + PostgreSQL).
 *
 * Önkoşullar: `docker compose up -d`, `npm run db:migrate`, `npm run db:seed`,
 * API ayakta (`npm run dev`). Admin: `SMOKE_ADMIN_EMAIL` / `SMOKE_ADMIN_PASSWORD`
 * (varsayılan admin@benimogretmenim.local / BenimAdmin2026! — `npm run db:seed:admin`).
 *
 *   npm run smoke:roles-deep --prefix apps/api
 *
 * Misafir destek: `022_support_guest_threads` migration uygulanmış olmalı.
 */

import { pool } from "../db.js";
import { homeworkSatisfactionRewardMinor } from "../lib/homeworkPosts.js";
import { runGuestSupportSmokeSteps } from "./smokeSupportGuestFlow.js";

const defaultPort = process.env.PORT ?? "3002";
const base = (process.env.SMOKE_API_URL ?? `http://127.0.0.1:${defaultPort}`).replace(/\/+$/, "");

function smokeAdminHeaders(token: string): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Bearer ${token}` };
  const s = process.env.ADMIN_API_SECRET?.trim();
  if (s) h["X-Admin-Secret"] = s;
  return h;
}

async function ensureActiveStudentPlatformSubscription(userId: string): Promise<void> {
  const r = await pool.query(
    `select 1 from student_subscriptions
     where user_id = $1
       and lifecycle = 'active'
       and expires_at is not null
       and expires_at > now()
     limit 1`,
    [userId],
  );
  if (r.rowCount) return;
  const price = 100_000;
  await pool.query(
    `insert into student_subscriptions (
       user_id, months_count, price_per_month_minor, price_total_minor,
       lifecycle, starts_at, expires_at
     ) values ($1, 1, $2, $2, 'active', now(), now() + interval '400 days')`,
    [userId, price],
  );
}

type NotifRow = { payload_jsonb?: unknown };

function payloadKind(p: unknown): string | undefined {
  if (!p || typeof p !== "object") return undefined;
  const k = (p as { kind?: unknown }).kind;
  return typeof k === "string" ? k : undefined;
}

function payloadHomeworkPostId(p: unknown): string | undefined {
  if (!p || typeof p !== "object") return undefined;
  const id = (p as { homeworkPostId?: unknown }).homeworkPostId;
  return typeof id === "string" ? id : undefined;
}

function findNotif(
  notifications: NotifRow[],
  kind: string,
  homeworkPostId?: string,
): boolean {
  for (const n of notifications) {
    const p = n.payload_jsonb;
    if (payloadKind(p) !== kind) continue;
    if (homeworkPostId && payloadHomeworkPostId(p) !== homeworkPostId) continue;
    return true;
  }
  return false;
}

async function main() {
  const health = await fetch(`${base}/health`);
  const hBody = (await health.json()) as { status?: string; db?: boolean };
  console.log("[smoke:roles-deep] GET /health", health.status, hBody);
  if (!health.ok || hBody.db !== true) {
    console.error(
      "[smoke:roles-deep] API veya veritabanı hazır değil. Yerelde db:up + migrate + seed ve API çalıştırın.",
    );
    process.exitCode = 1;
    return;
  }

  const adminEmail = process.env.SMOKE_ADMIN_EMAIL ?? "admin@benimogretmenim.local";
  const adminPassword = process.env.SMOKE_ADMIN_PASSWORD ?? "BenimAdmin2026!";
  const adminLogin = await fetch(`${base}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  const adminBody = (await adminLogin.json()) as { token?: string; error?: string };
  console.log("[smoke:roles-deep] admin login", adminLogin.status);
  if (!adminLogin.ok || !adminBody.token) {
    console.error(adminBody);
    process.exitCode = 1;
    return;
  }
  const adminAuth = smokeAdminHeaders(adminBody.token);

  const branchesRes = await fetch(`${base}/v1/meta/branches`);
  const branchesJson = (await branchesRes.json()) as { branches?: Array<{ id: number; slug?: string }> };
  if (!branchesRes.ok || !Array.isArray(branchesJson.branches)) {
    console.error(branchesJson);
    process.exitCode = 1;
    return;
  }
  const matematik =
    branchesJson.branches.find((b) => b.slug === "matematik") ?? branchesJson.branches[0];
  if (!matematik?.id) {
    console.error("[smoke:roles-deep] branch bulunamadı");
    process.exitCode = 1;
    return;
  }

  const citiesRes = await fetch(`${base}/v1/meta/cities`);
  const citiesJson = (await citiesRes.json()) as { cities?: Array<{ id: number; name?: string }> };
  const ist = citiesJson.cities?.find((c) => (c.name ?? "").toLowerCase().includes("istanbul"))
    ?? citiesJson.cities?.[0];

  const ts = Date.now();
  const password = "roles_deep_12";
  const teacherEmail = `roles_deep_t_${ts}@example.com`;
  const studentEmail = `roles_deep_s_${ts}@example.com`;
  const guardianEmail = `roles_deep_g_${ts}@example.com`;

  async function register(
    role: "teacher" | "student" | "guardian",
    email: string,
    displayName: string,
  ): Promise<{ token: string; userId: string }> {
    const r = await fetch(`${base}/v1/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, displayName, role }),
    });
    const j = (await r.json()) as { token?: string; user?: { id?: string }; error?: unknown };
    console.log(`[smoke:roles-deep] register ${role}`, r.status);
    if (!r.ok || !j.token || !j.user?.id) {
      console.error(j);
      throw new Error(`register_${role}_failed`);
    }
    return { token: j.token, userId: j.user.id };
  }

  const teacher = await register("teacher", teacherEmail, "RD Öğretmen");
  const student = await register("student", studentEmail, "RD Öğrenci");
  const guardian = await register("guardian", guardianEmail, "RD Veli");

  await ensureActiveStudentPlatformSubscription(student.userId);

  const grantMinor = 500_000;
  const grant = await fetch(`${base}/v1/wallet/admin/grant`, {
    method: "POST",
    headers: { ...adminAuth, "content-type": "application/json" },
    body: JSON.stringify({
      userId: student.userId,
      amountMinor: grantMinor,
      reason: "smoke-roles-deep",
    }),
  });
  console.log("[smoke:roles-deep] wallet admin grant (student)", grant.status);
  if (!grant.ok) {
    console.error(await grant.json().catch(() => ({})));
    process.exitCode = 1;
    return;
  }

  const teacherAuth = { Authorization: `Bearer ${teacher.token}` };
  const studentAuth = { Authorization: `Bearer ${student.token}` };
  const guardianAuth = { Authorization: `Bearer ${guardian.token}` };

  const patchMe = await fetch(`${base}/v1/teacher/me`, {
    method: "PATCH",
    headers: { ...teacherAuth, "content-type": "application/json" },
    body: JSON.stringify({
      bioRaw: "RD smoke: matematik.",
      cityId: ist?.id ?? null,
      availability: { pazartesi: ["09:00-12:00"] },
    }),
  });
  console.log("[smoke:roles-deep] PATCH teacher/me", patchMe.status);
  if (!patchMe.ok) {
    console.error(await patchMe.json().catch(() => ({})));
    process.exitCode = 1;
    return;
  }

  const putBr = await fetch(`${base}/v1/teacher/me/branches`, {
    method: "PUT",
    headers: { ...teacherAuth, "content-type": "application/json" },
    body: JSON.stringify({
      branches: [
        {
          branchId: matematik.id,
          yearsExperience: 5,
          isPrimary: true,
          hourlyRateMin: 800,
          hourlyRateMax: 1200,
        },
      ],
    }),
  });
  console.log("[smoke:roles-deep] PUT teacher/me/branches", putBr.status);
  if (!putBr.ok) {
    console.error(await putBr.json().catch(() => ({})));
    process.exitCode = 1;
    return;
  }

  const link = await fetch(`${base}/v1/guardians/link`, {
    method: "POST",
    headers: { ...studentAuth, "content-type": "application/json" },
    body: JSON.stringify({ guardianUserId: guardian.userId }),
  });
  console.log("[smoke:roles-deep] POST guardians/link", link.status);
  if (!link.ok) {
    console.error(await link.json().catch(() => ({})));
    process.exitCode = 1;
    return;
  }

  const topic = `RD ödev ${ts}`;
  const hwCreate = await fetch(`${base}/v1/student-platform/homework-posts`, {
    method: "POST",
    headers: { ...studentAuth, "content-type": "application/json" },
    body: JSON.stringify({
      branchId: matematik.id,
      topic,
      helpText: "Roles deep: en az beş karakter metin.",
      imageUrls: [],
      audioUrl: null,
    }),
  });
  const hwBody = (await hwCreate.json()) as { post?: { id: string }; error?: string };
  console.log("[smoke:roles-deep] POST homework-posts", hwCreate.status);
  if (!hwCreate.ok || !hwBody.post?.id) {
    console.error(hwBody);
    process.exitCode = 1;
    return;
  }
  const postId = hwBody.post.id;

  const notifTeacher = await fetch(`${base}/v1/notifications?limit=50`, { headers: teacherAuth });
  const notifTeacherJson = (await notifTeacher.json()) as { notifications?: NotifRow[] };
  const tList = notifTeacherJson.notifications ?? [];
  if (!findNotif(tList, "homework_new_post", postId)) {
    console.error("[smoke:roles-deep] öğretmende homework_new_post yok", postId, tList.slice(0, 3));
    process.exitCode = 1;
    return;
  }

  const notifGuardianAfterPost = await fetch(`${base}/v1/notifications?limit=50`, { headers: guardianAuth });
  const gPostJson = (await notifGuardianAfterPost.json()) as { notifications?: NotifRow[] };
  const gPostList = gPostJson.notifications ?? [];
  if (!findNotif(gPostList, "homework_new_post_guardian", postId)) {
    console.error(
      "[smoke:roles-deep] velide homework_new_post_guardian yok",
      postId,
      gPostList.slice(0, 5).map((n) => n.payload_jsonb),
    );
    process.exitCode = 1;
    return;
  }

  const claim1 = await fetch(`${base}/v1/student-platform/homework-posts/${postId}/claim`, {
    method: "POST",
    headers: { ...teacherAuth, "content-type": "application/json" },
  });
  console.log("[smoke:roles-deep] POST claim", claim1.status);
  if (!claim1.ok) {
    console.error(await claim1.json().catch(() => ({})));
    process.exitCode = 1;
    return;
  }

  const notifStudentClaimed = await fetch(`${base}/v1/notifications?limit=50`, { headers: studentAuth });
  const sClaimJson = (await notifStudentClaimed.json()) as { notifications?: NotifRow[] };
  if (!findNotif(sClaimJson.notifications ?? [], "homework_claimed", postId)) {
    console.error("[smoke:roles-deep] öğrencide homework_claimed yok");
    process.exitCode = 1;
    return;
  }

  const notifGClaimed = await fetch(`${base}/v1/notifications?limit=50`, { headers: guardianAuth });
  const gClaimJson = (await notifGClaimed.json()) as { notifications?: NotifRow[] };
  if (!findNotif(gClaimJson.notifications ?? [], "homework_claimed_guardian", postId)) {
    console.error("[smoke:roles-deep] velide homework_claimed_guardian yok");
    process.exitCode = 1;
    return;
  }

  const ret = await fetch(`${base}/v1/student-platform/homework-posts/${postId}/teacher-return`, {
    method: "POST",
    headers: { ...teacherAuth, "content-type": "application/json" },
  });
  console.log("[smoke:roles-deep] POST teacher-return", ret.status);
  if (!ret.ok) {
    console.error(await ret.json().catch(() => ({})));
    process.exitCode = 1;
    return;
  }

  const notifStudentRet = await fetch(`${base}/v1/notifications?limit=50`, { headers: studentAuth });
  const sRetJson = (await notifStudentRet.json()) as { notifications?: NotifRow[] };
  if (!findNotif(sRetJson.notifications ?? [], "homework_teacher_returned", postId)) {
    console.error("[smoke:roles-deep] öğrencide homework_teacher_returned yok");
    process.exitCode = 1;
    return;
  }

  const notifGRet = await fetch(`${base}/v1/notifications?limit=50`, { headers: guardianAuth });
  const gRetJson = (await notifGRet.json()) as { notifications?: NotifRow[] };
  if (!findNotif(gRetJson.notifications ?? [], "homework_teacher_returned_guardian", postId)) {
    console.error("[smoke:roles-deep] velide homework_teacher_returned_guardian yok");
    process.exitCode = 1;
    return;
  }

  const claim2 = await fetch(`${base}/v1/student-platform/homework-posts/${postId}/claim`, {
    method: "POST",
    headers: { ...teacherAuth, "content-type": "application/json" },
  });
  console.log("[smoke:roles-deep] POST claim (ikinci)", claim2.status);
  if (!claim2.ok) {
    console.error(await claim2.json().catch(() => ({})));
    process.exitCode = 1;
    return;
  }

  const answer = await fetch(`${base}/v1/student-platform/homework-posts/${postId}/answer`, {
    method: "POST",
    headers: { ...teacherAuth, "content-type": "application/json" },
    body: JSON.stringify({
      answerText: "Roles deep öğretmen cevabı: detaylı açıklama ve örnek adımlar burada yer alıyor.",
      answerImageUrls: [],
    }),
  });
  console.log("[smoke:roles-deep] POST answer", answer.status);
  if (!answer.ok) {
    console.error(await answer.json().catch(() => ({})));
    process.exitCode = 1;
    return;
  }

  const notifStudentAns = await fetch(`${base}/v1/notifications?limit=50`, { headers: studentAuth });
  const sAnsJson = (await notifStudentAns.json()) as { notifications?: NotifRow[] };
  if (!findNotif(sAnsJson.notifications ?? [], "homework_answered", postId)) {
    console.error("[smoke:roles-deep] öğrencide homework_answered yok");
    process.exitCode = 1;
    return;
  }

  const walletBefore = await fetch(`${base}/v1/wallet/me`, { headers: teacherAuth });
  const wBeforeJson = (await walletBefore.json()) as { balanceMinor?: number };
  const balBefore = Number(wBeforeJson.balanceMinor ?? 0);

  const sat = await fetch(`${base}/v1/student-platform/homework-posts/${postId}/mark-satisfied`, {
    method: "POST",
    headers: { ...studentAuth, "content-type": "application/json" },
  });
  console.log("[smoke:roles-deep] POST mark-satisfied", sat.status);
  if (!sat.ok) {
    console.error(await sat.json().catch(() => ({})));
    process.exitCode = 1;
    return;
  }

  const rewardMinor = homeworkSatisfactionRewardMinor();
  const walletAfter = await fetch(`${base}/v1/wallet/me`, { headers: teacherAuth });
  const wAfterJson = (await walletAfter.json()) as { balanceMinor?: number };
  const balAfter = Number(wAfterJson.balanceMinor ?? 0);
  if (balAfter < balBefore + rewardMinor) {
    console.error("[smoke:roles-deep] öğretmen cüzdanı beklenen ödül kadar artmadı", {
      balBefore,
      balAfter,
      rewardMinor,
    });
    process.exitCode = 1;
    return;
  }

  const notifTeacherReward = await fetch(`${base}/v1/notifications?limit=50`, { headers: teacherAuth });
  const tRewJson = (await notifTeacherReward.json()) as { notifications?: NotifRow[] };
  if (!findNotif(tRewJson.notifications ?? [], "homework_rewarded", postId)) {
    console.error("[smoke:roles-deep] öğretmende homework_rewarded yok");
    process.exitCode = 1;
    return;
  }

  const notifStudentReward = await fetch(`${base}/v1/notifications?limit=50`, { headers: studentAuth });
  const sRewJson = (await notifStudentReward.json()) as { notifications?: NotifRow[] };
  if (!findNotif(sRewJson.notifications ?? [], "homework_rewarded_student", postId)) {
    console.error("[smoke:roles-deep] öğrencide homework_rewarded_student yok");
    process.exitCode = 1;
    return;
  }

  const notifGReward = await fetch(`${base}/v1/notifications?limit=50`, { headers: guardianAuth });
  const gRewJson = (await notifGReward.json()) as { notifications?: NotifRow[] };
  if (!findNotif(gRewJson.notifications ?? [], "homework_rewarded_guardian", postId)) {
    console.error("[smoke:roles-deep] velide homework_rewarded_guardian yok");
    process.exitCode = 1;
    return;
  }

  const overview = await fetch(`${base}/v1/guardians/overview`, { headers: guardianAuth });
  const ovJson = (await overview.json()) as { students?: unknown[] };
  console.log("[smoke:roles-deep] guardians/overview", overview.status, (ovJson.students?.length ?? 0), "öğrenci");
  if (!overview.ok || !Array.isArray(ovJson.students) || ovJson.students.length < 1) {
    console.error(ovJson);
    process.exitCode = 1;
    return;
  }

  const guestSmoke = await runGuestSupportSmokeSteps({
    base,
    adminHeaders: adminAuth,
    logPrefix: "[smoke:roles-deep]",
  });
  if (!guestSmoke.ok) {
    console.error(guestSmoke.detail);
    process.exitCode = 1;
    return;
  }

  console.log("[smoke:roles-deep] OK — öğretmen/öğrenci/veli ödev + cüzdan + bildirim + misafir destek geçti.");
}

main()
  .catch((e) => {
    console.error("[smoke:roles-deep] fatal", e);
    process.exitCode = 1;
  })
  .finally(() => pool.end().catch(() => {}));
