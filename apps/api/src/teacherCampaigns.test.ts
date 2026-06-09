import { describe, expect, it } from "vitest";
import { app } from "./app.js";
import { signAccessToken } from "./auth/jwt.js";
import { pool } from "./db.js";
import { applyWalletDelta } from "./lib/wallet.js";

async function campaignTablesAvailable(): Promise<boolean> {
  const health = await app.request("http://localhost/health");
  if (health.status !== 200) return false;
  const r = await pool.query<{ exists: boolean }>(
    `select to_regclass('public.teacher_campaigns') is not null
        and exists (
          select 1 from information_schema.columns
          where table_schema = 'public'
            and table_name = 'teacher_campaigns'
            and column_name = 'billing_model'
        ) as exists`,
  );
  return r.rows[0]?.exists === true;
}

async function campaignChatTablesAvailable(): Promise<boolean> {
  if (!(await campaignTablesAvailable())) return false;
  const r = await pool.query<{ exists: boolean }>(
    `select to_regclass('public.teacher_campaign_application_messages') is not null
        and to_regclass('public.teacher_campaign_conversation_usage') is not null
        and to_regclass('public.usage_credit_packs') is not null
        and to_regclass('public.user_usage_credits') is not null
        and to_regclass('public.usage_credit_payments') is not null as exists`,
  );
  return r.rows[0]?.exists === true;
}

async function ensureTeacherPlan(): Promise<void> {
  await pool.query(
    `insert into subscription_plans (code, title, duration_months, price_minor, currency, entitlements_jsonb)
     values ('teacher_6m', '6 Aylık Öğretmen Aboneliği', 6, 175000, 'TRY', '{}'::jsonb)
     on conflict (code) do nothing`,
  );
}

async function createTeacher(suffix: string): Promise<{ userId: string; teacherId: string; token: string }> {
  await ensureTeacherPlan();
  const user = await pool.query<{ id: string }>(
    `insert into users (email, display_name, role)
     values ($1, $2, 'teacher')
     returning id`,
    [`campaign-teacher-${suffix}@example.test`, `Campaign Teacher ${suffix}`],
  );
  const userId = user.rows[0].id;
  const teacher = await pool.query<{ id: string }>(
    `insert into teachers (user_id) values ($1) returning id`,
    [userId],
  );
  const teacherId = teacher.rows[0].id;
  await pool.query(
    `insert into teacher_subscriptions (
       teacher_id, plan_code, status, started_at, expires_at, promo_multiplier, paid_amount_minor, currency
     ) values ($1, 'teacher_6m', 'active', now(), now() + interval '1 year', 1, 0, 'TRY')`,
    [teacherId],
  );
  const token = await signAccessToken({ userId, role: "teacher" });
  return { userId, teacherId, token };
}

async function createStudent(suffix: string): Promise<{ userId: string; studentId: string; token: string }> {
  const user = await pool.query<{ id: string }>(
    `insert into users (email, display_name, role)
     values ($1, $2, 'student')
     returning id`,
    [`campaign-student-${suffix}@example.test`, `Campaign Student ${suffix}`],
  );
  const userId = user.rows[0].id;
  const student = await pool.query<{ id: string }>(
    `insert into students (user_id) values ($1) returning id`,
    [userId],
  );
  const token = await signAccessToken({ userId, role: "student" });
  return { userId, studentId: student.rows[0].id, token };
}

function campaignBody(title: string) {
  return {
    title,
    description: "TYT matematik kampı için 40 derslik yoğun tekrar ve soru çözüm programı.",
    deliveryMode: "online",
    lessonCount: 40,
    priceMinor: 1_000_000,
    currency: "TRY",
    capacity: 20,
  };
}

async function createCampaign(token: string, title: string, extra: Record<string, unknown> = {}) {
  return app.request("http://localhost/v1/teacher-campaigns", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ ...campaignBody(title), ...extra }),
  });
}

describe("teacher campaigns", () => {
  it("creates the first subscribed teacher campaign for free and review", async () => {
    if (!(await campaignTablesAvailable())) return;

    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const createdUserIds: string[] = [];
    try {
      const teacher = await createTeacher(suffix);
      createdUserIds.push(teacher.userId);

      const res = await createCampaign(teacher.token, "TYT Matematik Kampı Online");
      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        campaign: { listing_fee_minor: number; free_listing_used: boolean; status: string };
      };
      expect(body.campaign.listing_fee_minor).toBe(0);
      expect(body.campaign.free_listing_used).toBe(true);
      expect(body.campaign.status).toBe("pending_review");
    } finally {
      await pool.query(`delete from users where id = any($1::uuid[])`, [createdUserIds]);
    }
  });

  it("charges 1000 TL from teacher wallet for the second campaign", async () => {
    if (!(await campaignTablesAvailable())) return;

    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const createdUserIds: string[] = [];
    try {
      const teacher = await createTeacher(suffix);
      createdUserIds.push(teacher.userId);
      await createCampaign(teacher.token, "İlk Ücretsiz Kampanya");
      await applyWalletDelta({
        userId: teacher.userId,
        deltaMinor: 100_000,
        kind: "test_wallet_grant",
      });

      const res = await createCampaign(teacher.token, "İkinci Ücretli Kampanya");
      expect(res.status).toBe(201);
      const body = (await res.json()) as { campaign: { id: string; listing_fee_minor: number } };
      expect(body.campaign.listing_fee_minor).toBe(100_000);

      const wallet = await pool.query<{ balance_minor: string }>(
        `select balance_minor from user_wallets where user_id = $1`,
        [teacher.userId],
      );
      expect(wallet.rows[0]?.balance_minor).toBe("0");

      const ledger = await pool.query<{ count: string }>(
        `select count(*)::text as count
         from user_wallet_ledger
         where user_id = $1
           and kind = 'teacher_campaign_listing_fee'
           and ref_id = $2`,
        [teacher.userId, body.campaign.id],
      );
      expect(ledger.rows[0]?.count).toBe("1");
    } finally {
      await pool.query(`delete from users where id = any($1::uuid[])`, [createdUserIds]);
    }
  });

  it("rejects the second campaign when teacher wallet balance is insufficient", async () => {
    if (!(await campaignTablesAvailable())) return;

    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const createdUserIds: string[] = [];
    try {
      const teacher = await createTeacher(suffix);
      createdUserIds.push(teacher.userId);
      await createCampaign(teacher.token, "İlk Ücretsiz Kampanya");

      const res = await createCampaign(teacher.token, "Bakiye Gereken Kampanya");
      expect(res.status).toBe(409);
      const body = (await res.json()) as { error: string; neededMinor: number };
      expect(body.error).toBe("insufficient_balance");
      expect(body.neededMinor).toBe(100_000);
    } finally {
      await pool.query(`delete from users where id = any($1::uuid[])`, [createdUserIds]);
    }
  });

  it("allows success fee billing without charging a listing fee upfront", async () => {
    if (!(await campaignTablesAvailable())) return;

    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const createdUserIds: string[] = [];
    try {
      const teacher = await createTeacher(suffix);
      createdUserIds.push(teacher.userId);
      await createCampaign(teacher.token, "İlk Ücretsiz Kampanya");

      const res = await createCampaign(teacher.token, "Başarı Bedelli Kampanya", { billingModel: "success_fee" });
      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        campaign: { listing_fee_minor: number; billing_model: string; success_fee_bps: number };
      };
      expect(body.campaign.listing_fee_minor).toBe(0);
      expect(body.campaign.billing_model).toBe("success_fee");
      expect(body.campaign.success_fee_bps).toBe(1000);

      const wallet = await pool.query<{ balance_minor: string }>(
        `select balance_minor from user_wallets where user_id = $1`,
        [teacher.userId],
      );
      expect(wallet.rows[0]?.balance_minor ?? "0").toBe("0");
    } finally {
      await pool.query(`delete from users where id = any($1::uuid[])`, [createdUserIds]);
    }
  });

  it("lets a student apply once and lets the teacher view the lead", async () => {
    if (!(await campaignTablesAvailable())) return;

    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const createdUserIds: string[] = [];
    try {
      const teacher = await createTeacher(suffix);
      const student = await createStudent(suffix);
      createdUserIds.push(teacher.userId, student.userId);

      const campaignRes = await createCampaign(teacher.token, "TYT Matematik Başvuru Testi");
      const campaignBodyJson = (await campaignRes.json()) as { campaign: { id: string } };
      const campaignId = campaignBodyJson.campaign.id;
      await pool.query(
        `update teacher_campaigns set status = 'published', published_at = now() where id = $1`,
        [campaignId],
      );

      const applyRes = await app.request(`http://localhost/v1/teacher-campaigns/${campaignId}/applications`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${student.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Program saatleri hakkında bilgi almak istiyorum." }),
      });
      expect(applyRes.status).toBe(201);

      const duplicate = await app.request(`http://localhost/v1/teacher-campaigns/${campaignId}/applications`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${student.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Tekrar başvuru." }),
      });
      expect(duplicate.status).toBe(409);

      const apps = await app.request(`http://localhost/v1/teacher-campaigns/${campaignId}/applications`, {
        headers: { authorization: `Bearer ${teacher.token}` },
      });
      expect(apps.status).toBe(200);
      const body = (await apps.json()) as { applications: Array<{ student_email: string; status: string }> };
      expect(body.applications).toHaveLength(1);
      expect(body.applications[0].student_email).toContain("campaign-student-");
      expect(body.applications[0].status).toBe("new");
    } finally {
      await pool.query(`delete from users where id = any($1::uuid[])`, [createdUserIds]);
    }
  });

  it("creates a platform chat for success fee campaign applications", async () => {
    if (!(await campaignChatTablesAvailable())) return;

    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const createdUserIds: string[] = [];
    try {
      const teacher = await createTeacher(suffix);
      const student = await createStudent(suffix);
      const otherStudent = await createStudent(`${suffix}-other`);
      createdUserIds.push(teacher.userId, student.userId, otherStudent.userId);

      const campaignRes = await createCampaign(teacher.token, "Komisyonlu Sohbet Kampanyası", {
        billingModel: "success_fee",
      });
      const campaignBodyJson = (await campaignRes.json()) as { campaign: { id: string } };
      const campaignId = campaignBodyJson.campaign.id;
      await pool.query(
        `update teacher_campaigns set status = 'published', published_at = now() where id = $1`,
        [campaignId],
      );

      const applyRes = await app.request(`http://localhost/v1/teacher-campaigns/${campaignId}/applications`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${student.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Platform içi sohbet başlatmak istiyorum." }),
      });
      expect(applyRes.status).toBe(201);
      const applyBody = (await applyRes.json()) as { application: { id: string } };

      const apps = await app.request(`http://localhost/v1/teacher-campaigns/${campaignId}/applications`, {
        headers: { authorization: `Bearer ${teacher.token}` },
      });
      expect(apps.status).toBe(200);
      const appsBody = (await apps.json()) as {
        applications: Array<{ student_email: string | null; billing_model: string; message_count: number }>;
      };
      expect(appsBody.applications[0].student_email).toBeNull();
      expect(appsBody.applications[0].billing_model).toBe("success_fee");
      expect(appsBody.applications[0].message_count).toBe(1);

      const messages = await app.request(
        `http://localhost/v1/teacher-campaigns/${campaignId}/applications/${applyBody.application.id}/messages`,
        { headers: { authorization: `Bearer ${teacher.token}` } },
      );
      expect(messages.status).toBe(200);
      const messagesBody = (await messages.json()) as { messages: Array<{ body: string; sender_role: string }> };
      expect(messagesBody.messages).toHaveLength(1);
      expect(messagesBody.messages[0].sender_role).toBe("student");

      const reply = await app.request(
        `http://localhost/v1/teacher-campaigns/${campaignId}/applications/${applyBody.application.id}/messages`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${teacher.token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ body: "Merhaba, saatleri birlikte netleştirelim." }),
        },
      );
      expect(reply.status).toBe(201);

      const forbidden = await app.request(
        `http://localhost/v1/teacher-campaigns/${campaignId}/applications/${applyBody.application.id}/messages`,
        { headers: { authorization: `Bearer ${otherStudent.token}` } },
      );
      expect(forbidden.status).toBe(404);
    } finally {
      await pool.query(`delete from users where id = any($1::uuid[])`, [createdUserIds]);
    }
  });

  it("unblocks commission campaign chats after buying an extra conversation pack", async () => {
    if (!(await campaignChatTablesAvailable())) return;

    const oldLimit = process.env.TEACHER_CAMPAIGN_CONVERSATION_MONTHLY_LIMIT;
    process.env.TEACHER_CAMPAIGN_CONVERSATION_MONTHLY_LIMIT = "0";
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const createdUserIds: string[] = [];
    try {
      const teacher = await createTeacher(suffix);
      const student = await createStudent(suffix);
      createdUserIds.push(teacher.userId, student.userId);

      const campaignRes = await createCampaign(teacher.token, "Kotalı Komisyon Kampanyası", {
        billingModel: "success_fee",
      });
      const campaignBodyJson = (await campaignRes.json()) as { campaign: { id: string } };
      const campaignId = campaignBodyJson.campaign.id;
      await pool.query(
        `update teacher_campaigns set status = 'published', published_at = now() where id = $1`,
        [campaignId],
      );

      const blocked = await app.request(`http://localhost/v1/teacher-campaigns/${campaignId}/applications`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${student.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Kota test başvurusu." }),
      });
      expect(blocked.status).toBe(429);
      const blockedBody = (await blocked.json()) as { error: string; packs: unknown[] };
      expect(blockedBody.error).toBe("campaign_conversation_quota_exceeded");
      expect(blockedBody.packs.length).toBeGreaterThan(0);

      await applyWalletDelta({
        userId: teacher.userId,
        deltaMinor: 25_000,
        kind: "test_wallet_grant",
      });
      const purchase = await app.request(
        "http://localhost/v1/teacher-campaigns/usage-packs/teacher_campaign_chat_250/purchase",
        {
          method: "POST",
          headers: { authorization: `Bearer ${teacher.token}` },
        },
      );
      expect(purchase.status).toBe(201);

      const applied = await app.request(`http://localhost/v1/teacher-campaigns/${campaignId}/applications`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${student.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Paket sonrası başvuru." }),
      });
      expect(applied.status).toBe(201);
    } finally {
      if (oldLimit == null) {
        delete process.env.TEACHER_CAMPAIGN_CONVERSATION_MONTHLY_LIMIT;
      } else {
        process.env.TEACHER_CAMPAIGN_CONVERSATION_MONTHLY_LIMIT = oldLimit;
      }
      await pool.query(`delete from users where id = any($1::uuid[])`, [createdUserIds]);
    }
  });
});
