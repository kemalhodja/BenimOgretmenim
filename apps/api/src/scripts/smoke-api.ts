/**
 * Yerel API duman testi: API çalışırken (örn. npm run dev) ve PostgreSQL ayaktayken çalıştırın.
 *   npm run smoke
 *
 * Abonelik onayı için admin kullanıcı gerekir (varsayılan: `npm run db:seed` ile gelen
 * seed_dev@benimogretmenim.local / DevParola1). Özelleştirmek için:
 *   SMOKE_ADMIN_EMAIL, SMOKE_ADMIN_PASSWORD
 *   SMOKE_GUARDIAN_EMAIL, SMOKE_GUARDIAN_PASSWORD (varsayılan seed veli)
 * API'de ADMIN_API_SECRET tanımlıysa smoke sürecinde de aynı env ile çalıştırın.
 */

import { spawnSync } from "node:child_process";

const defaultPort = process.env.PORT ?? "3002";
const base =
  process.env.SMOKE_API_URL ?? `http://127.0.0.1:${defaultPort}`;

function smokeAdminHeaders(token: string): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  const s = process.env.ADMIN_API_SECRET?.trim();
  if (s) h["X-Admin-Secret"] = s;
  return h;
}

async function main() {
  const health = await fetch(`${base}/health`);
  const hBody = (await health.json()) as { status?: string; db?: boolean };
  console.log("[smoke] GET /health", health.status, hBody);
  if (hBody.db !== true) {
    console.error(
      "[smoke] Veritabanı kapalı veya erişilemiyor. Kök dizinde `docker compose up -d`, ardından `npm run db:migrate` (ve gerekirse `npm run db:seed`). API açıkken: `npm run smoke`.",
    );
    process.exitCode = 1;
    return;
  }
  if (!health.ok) {
    process.exitCode = 1;
    return;
  }

  const email = `smoke_${Date.now()}@example.com`;
  const reg = await fetch(`${base}/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email,
      password: "smoke_test_12",
      displayName: "Duman Test Öğretmen",
      role: "teacher",
    }),
  });
  const regBody = await reg.json();
  console.log("[smoke] POST /v1/auth/register", reg.status);
  if (!reg.ok) {
    console.error(regBody);
    process.exitCode = 1;
    return;
  }
  const token = regBody.token as string;

  // Admin login (wallet grant + ops)
  const adminEmail =
    process.env.SMOKE_ADMIN_EMAIL ?? "seed_dev@benimogretmenim.local";
  const adminPassword = process.env.SMOKE_ADMIN_PASSWORD ?? "DevParola1";
  const adminLogin = await fetch(`${base}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  const adminLoginBody = (await adminLogin.json()) as { token?: string };
  console.log("[smoke] POST /v1/auth/login (admin)", adminLogin.status);
  if (!adminLogin.ok || !adminLoginBody.token) {
    console.error(
      "[smoke] Admin girişi başarısız; `npm run db:seed` ile seed_dev kullanıcısı oluşturun veya SMOKE_ADMIN_EMAIL / SMOKE_ADMIN_PASSWORD ayarlayın.",
      adminLoginBody,
    );
    process.exitCode = 1;
    return;
  }
  const adminTok = adminLoginBody.token;
  const adminBaseHeaders = smokeAdminHeaders(adminTok);

  const teachersPub = await fetch(`${base}/v1/teachers?limit=5`);
  const teachersPubBody = await teachersPub.json();
  console.log("[smoke] GET /v1/teachers", teachersPub.status, teachersPubBody);
  if (!teachersPub.ok) {
    process.exitCode = 1;
    return;
  }

  const teachersSearch = await fetch(
    `${base}/v1/teachers?limit=5&q=${encodeURIComponent("a")}`,
  );
  const teachersSearchBody = await teachersSearch.json();
  console.log("[smoke] GET /v1/teachers?q=", teachersSearch.status);
  if (!teachersSearch.ok) {
    console.error(teachersSearchBody);
    process.exitCode = 1;
    return;
  }

  const teacherRows = (teachersPubBody as { teachers?: { id: string }[] }).teachers;
  if (teacherRows && teacherRows.length > 0) {
    const tid = teacherRows[0].id;
    const det = await fetch(`${base}/v1/teachers/${tid}`);
    const detBody = await det.json();
    console.log("[smoke] GET /v1/teachers/:id", det.status, detBody);
    if (!det.ok) {
      process.exitCode = 1;
      return;
    }
  }

  const plansPub = await fetch(`${base}/v1/subscriptions/plans`);
  const plansPubBody = await plansPub.json();
  console.log("[smoke] GET /v1/subscriptions/plans", plansPub.status, plansPubBody);
  if (!plansPub.ok) {
    process.exitCode = 1;
    return;
  }

  const branchesRes = await fetch(`${base}/v1/meta/branches`);
  const branchesJson = (await branchesRes.json()) as {
    branches: { id: number; slug: string }[];
  };
  const matematik = branchesJson.branches.find((b) => b.slug === "matematik");
  if (!matematik) {
    console.error("[smoke] matematik branşı seed'de yok; db:migrate + db:seed?");
    process.exitCode = 1;
    return;
  }

  const auth = { Authorization: `Bearer ${token}` };

  const me = await fetch(`${base}/v1/teacher/me`, { headers: auth });
  const meBody = (await me.json()) as { teacher?: { userId?: string } };
  console.log("[smoke] GET /v1/teacher/me", me.status, meBody);
  const teacherUserId = meBody.teacher?.userId;
  if (!teacherUserId) {
    console.error("[smoke] teacher userId missing");
    process.exitCode = 1;
    return;
  }

  // Admin grant: öğretmen cüzdanına bakiye ekle (wallet-only flows)
  const grantTeacher = await fetch(`${base}/v1/wallet/admin/grant`, {
    method: "POST",
    headers: { ...adminBaseHeaders, "content-type": "application/json" },
    body: JSON.stringify({
      userId: teacherUserId,
      amountMinor: 400000, // 4000 TL
      reason: "smoke teacher funds",
    }),
  });
  console.log("[smoke] POST /v1/wallet/admin/grant (teacher)", grantTeacher.status);
  if (!grantTeacher.ok) {
    console.error(await grantTeacher.json().catch(() => ({})));
    process.exitCode = 1;
    return;
  }

  const dash = await fetch(`${base}/v1/teacher/dashboard`, { headers: auth });
  console.log("[smoke] GET /v1/teacher/dashboard", dash.status, await dash.json());

  const cities = await fetch(`${base}/v1/meta/cities`);
  const citiesJson = (await cities.json()) as { cities: { id: number; slug: string }[] };
  const ist = citiesJson.cities.find((c) => c.slug === "istanbul");
  if (ist) {
    const dist = await fetch(`${base}/v1/meta/districts?cityId=${ist.id}`);
    console.log("[smoke] GET /v1/meta/districts", dist.status, await dist.json());
  }

  const patch = await fetch(`${base}/v1/teacher/me`, {
    method: "PATCH",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({
      bioRaw: "Deneme biyografisi: on yıldır lise matematik ve geometri veriyorum.",
      cityId: ist?.id ?? null,
      availability: { pazartesi: ["09:00-12:00"] },
    }),
  });
  console.log("[smoke] PATCH /v1/teacher/me", patch.status, await patch.json());

  const putBr = await fetch(`${base}/v1/teacher/me/branches`, {
    method: "PUT",
    headers: { ...auth, "content-type": "application/json" },
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
  console.log("[smoke] PUT /v1/teacher/me/branches", putBr.status, await putBr.json());

  const sess = await fetch(`${base}/v1/onboarding/sessions`, {
    method: "POST",
    headers: auth,
  });
  const sessBody = await sess.json();
  console.log("[smoke] POST /v1/onboarding/sessions", sess.status, sessBody);

  if (sess.ok && sessBody.session?.id) {
    const list = await fetch(`${base}/v1/onboarding/sessions`, { headers: auth });
    console.log("[smoke] GET /v1/onboarding/sessions", list.status, await list.json());

    const done = await fetch(
      `${base}/v1/onboarding/sessions/${sessBody.session.id}`,
      {
        method: "PATCH",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      },
    );
    console.log("[smoke] PATCH onboarding session", done.status, await done.json());
  }

  const me2 = await fetch(`${base}/v1/teacher/me`, { headers: auth });
  console.log("[smoke] GET /v1/teacher/me (son)", me2.status, await me2.json());

  // Ders talebi akışı (student) → öğretmen inbox → teklif
  const studentLogin = await fetch(`${base}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "student_dev@benimogretmenim.local",
      password: "DevParola1",
    }),
  });
  const studentLoginBody = (await studentLogin.json()) as { token?: string };
  console.log("[smoke] POST /v1/auth/login (seed student)", studentLogin.status);
  if (!studentLogin.ok || !studentLoginBody.token) {
    console.error(studentLoginBody);
    process.exitCode = 1;
    return;
  }
  const studentAuth = { Authorization: `Bearer ${studentLoginBody.token}` };

  const reviewableEmpty = await fetch(`${base}/v1/lesson-sessions/reviewable`, {
    headers: studentAuth,
  });
  const reviewableEmptyBody = await reviewableEmpty.json();
  console.log(
    "[smoke] GET /v1/lesson-sessions/reviewable",
    reviewableEmpty.status,
    (reviewableEmptyBody as { sessions?: unknown[] }).sessions?.length ?? 0,
    "oturum",
  );
  if (!reviewableEmpty.ok) {
    console.error(reviewableEmptyBody);
    process.exitCode = 1;
    return;
  }

  const myReviews = await fetch(`${base}/v1/lesson-sessions/my-reviews`, {
    headers: studentAuth,
  });
  const myReviewsBody = await myReviews.json();
  console.log(
    "[smoke] GET /v1/lesson-sessions/my-reviews",
    myReviews.status,
    (myReviewsBody as { reviews?: unknown[] }).reviews?.length ?? 0,
    "kayıt",
  );
  if (!myReviews.ok) {
    console.error(myReviewsBody);
    process.exitCode = 1;
    return;
  }

  const myReq = await fetch(`${base}/v1/lesson-requests/mine`, { headers: studentAuth });
  const myReqBody = (await myReq.json()) as { requests?: { id: string; status?: string }[] };
  console.log(
    "[smoke] GET /v1/lesson-requests/mine (student)",
    myReq.status,
    myReqBody.requests?.length ?? 0,
    "kayıt",
  );
  let requestId: string | null = null;
  if (myReq.ok && (myReqBody.requests?.length ?? 0) > 0) {
    requestId = myReqBody.requests?.[0]?.id ?? null;
  }
  if (!requestId) {
    const open = await fetch(`${base}/v1/lesson-requests/open`, { headers: auth });
    const openBody = (await open.json()) as { requests?: { id: string }[] };
    console.log(
      "[smoke] GET /v1/lesson-requests/open (fallback)",
      open.status,
      openBody.requests?.length ?? 0,
      "kayıt",
    );
    if (!open.ok || !(openBody.requests?.length)) {
      console.error(openBody);
      process.exitCode = 1;
      return;
    }
    requestId = openBody.requests[0].id;
  }

  const offer = await fetch(`${base}/v1/lesson-requests/${requestId}/offers`, {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ message: "Smoke: teklif mesajı", proposedHourlyRateMinor: 900 }),
  });
  const offerBody = await offer.json();
  console.log("[smoke] POST offer", offer.status, offerBody);
  if (!offer.ok) {
    process.exitCode = 1;
    return;
  }

  const msgListS = await fetch(`${base}/v1/lesson-requests/${requestId}/messages`, {
    headers: studentAuth,
  });
  const msgListSBody = await msgListS.json();
  console.log("[smoke] GET /v1/lesson-requests/.../messages (student)", msgListS.status);
  if (!msgListS.ok) {
    // Seed student bu talebin sahibi olmayabilir; mesaj testini bloklamayalım.
    console.log("[smoke] skip student messages (not owner)", msgListSBody);
  } else {
    const msgPost = await fetch(`${base}/v1/lesson-requests/${requestId}/messages`, {
      method: "POST",
      headers: { ...studentAuth, "content-type": "application/json" },
      body: JSON.stringify({ content: "Smoke: öğrenci mesajı" }),
    });
    const msgPostBody = await msgPost.json();
    console.log("[smoke] POST /v1/lesson-requests/.../messages (student)", msgPost.status);
    if (!msgPost.ok) {
      console.error(msgPostBody);
      process.exitCode = 1;
      return;
    }
  }

  const msgListT = await fetch(`${base}/v1/lesson-requests/${requestId}/messages`, {
    headers: auth,
  });
  const msgListTBody = await msgListT.json();
  console.log(
    "[smoke] GET /v1/lesson-requests/.../messages (teacher)",
    msgListT.status,
    (msgListTBody as { messages?: unknown[] }).messages?.length ?? 0,
    "mesaj",
  );
  if (!msgListT.ok) {
    console.error(msgListTBody);
    process.exitCode = 1;
    return;
  }

  const myOffers = await fetch(`${base}/v1/lesson-requests/my-offers`, {
    headers: auth,
  });
  const myOffersBody = await myOffers.json();
  console.log(
    "[smoke] GET /v1/lesson-requests/my-offers",
    myOffers.status,
    (myOffersBody as { offers?: unknown[] }).offers?.length ?? 0,
    "teklif",
  );
  if (!myOffers.ok) {
    console.error(myOffersBody);
    process.exitCode = 1;
    return;
  }

  const cancelReq = await fetch(`${base}/v1/lesson-requests/${requestId}/cancel`, {
    method: "POST",
    headers: studentAuth,
  });
  console.log("[smoke] POST /v1/lesson-requests/.../cancel", cancelReq.status);
  if (!cancelReq.ok) {
    // Seed student bu talebin sahibi olmayabilir; cancel testi opsiyonel.
    console.log("[smoke] skip cancel (not owner)", await cancelReq.json().catch(() => ({})));
  }

  // Not: Ek teklif testleri, aynı öğretmene önceki denemelerde teklif atılmış talepler yüzünden
  // tekrarlandığında 409 (offer_already_sent) üretebilir. Bu yüzden burada tek teklif akışı yeterli.

  // Abonelik: cüzdandan satın al (wallet-only)
  const buy = await fetch(`${base}/v1/subscriptions/purchase-from-wallet`, {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({
      planCode: "teacher_6m",
    }),
  });
  const buyBody = await buy.json().catch(() => ({}));
  console.log("[smoke] POST /v1/subscriptions/purchase-from-wallet", buy.status, buyBody);
  if (!buy.ok) {
    process.exitCode = 1;
    return;
  }
  // Abonelik sonrası: aynı request'e tekrar teklif verilemeyebilir; sadece abonelik durumunu çekelim
  const subMe = await fetch(`${base}/v1/subscriptions/me`, { headers: auth });
  const subMeBody = await subMe.json();
  console.log("[smoke] GET /v1/subscriptions/me (after buy)", subMe.status, subMeBody);
  if (!subMe.ok) {
    process.exitCode = 1;
    return;
  }

  const gEmail =
    process.env.SMOKE_GUARDIAN_EMAIL ?? "guardian_dev@benimogretmenim.local";
  const gPass = process.env.SMOKE_GUARDIAN_PASSWORD ?? "DevParola1";
  const gLogin = await fetch(`${base}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: gEmail, password: gPass }),
  });
  const gLoginBody = (await gLogin.json()) as { token?: string };
  console.log("[smoke] POST /v1/auth/login (guardian)", gLogin.status);
  if (!gLogin.ok || !gLoginBody.token) {
    console.error(
      "[smoke] Veli girişi başarısız; `npm run db:seed` ile guardian_dev kullanıcısı gerekir.",
      gLoginBody,
    );
    process.exitCode = 1;
    return;
  }
  const gAuth = { Authorization: `Bearer ${gLoginBody.token}` };
  const gOver = await fetch(`${base}/v1/guardians/overview`, { headers: gAuth });
  const gOverBody = await gOver.json();
  console.log("[smoke] GET /v1/guardians/overview", gOver.status, gOverBody);
  if (!gOver.ok) {
    process.exitCode = 1;
    return;
  }

  const notifs = await fetch(`${base}/v1/notifications?limit=5`, {
    headers: gAuth,
  });
  const notifsBody = await notifs.json();
  console.log("[smoke] GET /v1/notifications (guardian)", notifs.status, notifsBody);
  if (!notifs.ok) {
    process.exitCode = 1;
    return;
  }

  // Grup ders: planned_start 50 dk sonrası → create otomatik join+hold → settle job (1 saat penceresi) tahsilat yapmalı
  const studentCreate = await fetch(`${base}/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: `smoke_group_student_${Date.now()}@example.com`,
      password: "smoke_test_12",
      displayName: "Duman Grup Öğrenci",
      role: "student",
    }),
  });
  const studentCreateBody = (await studentCreate.json()) as {
    token?: string;
    user?: { id?: string };
  };
  console.log("[smoke] POST /v1/auth/register (group student)", studentCreate.status);
  if (!studentCreate.ok || !studentCreateBody.token || !studentCreateBody.user?.id) {
    console.error(studentCreateBody);
    process.exitCode = 1;
    return;
  }

  const groupStudentUserId = studentCreateBody.user.id;
  const groupStudentAuth = { Authorization: `Bearer ${studentCreateBody.token}` };

  const grantGroupStudent = await fetch(`${base}/v1/wallet/admin/grant`, {
    method: "POST",
    headers: { ...adminBaseHeaders, "content-type": "application/json" },
    body: JSON.stringify({
      userId: groupStudentUserId,
      amountMinor: 150000, // 1500 TL
      reason: "smoke group lesson funds",
    }),
  });
  console.log("[smoke] POST /v1/wallet/admin/grant (group student)", grantGroupStudent.status);
  if (!grantGroupStudent.ok) {
    console.error(await grantGroupStudent.json().catch(() => ({})));
    process.exitCode = 1;
    return;
  }

  const plannedStart = new Date(Date.now() + 50 * 60 * 1000).toISOString();
  const glCreate = await fetch(`${base}/v1/group-lessons`, {
    method: "POST",
    headers: { ...groupStudentAuth, "content-type": "application/json" },
    body: JSON.stringify({
      branchId: matematik.id,
      topic: "Smoke: grup dersi",
      plannedStart,
    }),
  });
  const glCreateBody = (await glCreate.json().catch(() => ({}))) as {
    request?: { id?: string };
  };
  console.log("[smoke] POST /v1/group-lessons", glCreate.status, glCreateBody);
  if (!glCreate.ok || !glCreateBody.request?.id) {
    process.exitCode = 1;
    return;
  }

  // Settle job çalıştır (1 saat penceresine girdiği için bu request'i yakalamalı)
  const settle = spawnSync("npm", ["run", "-s", "group-lessons:settle"], {
    shell: true,
    env: process.env,
    encoding: "utf8",
  });
  console.log("[smoke] npm run group-lessons:settle", settle.status);
  if (settle.status !== 0) {
    console.error(settle.stdout, settle.stderr);
    process.exitCode = 1;
    return;
  }

  console.log("[smoke] Tamam. Kayıtlı kullanıcı:", email);
}

main().catch((e) => {
  console.error("[smoke] Bağlantı hatası — API ayakta mı? (`npm run dev`)", e);
  process.exitCode = 1;
});
