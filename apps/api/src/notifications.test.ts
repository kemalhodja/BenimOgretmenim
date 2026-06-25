import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool } from "./db.js";
import { app } from "./app.js";

const hasDb = await pool
  .query<{ ok: boolean }>(
    `select to_regclass('public.user_notifications') is not null as ok`,
  )
  .then((r) => r.rows[0]?.ok === true)
  .catch(() => false);

describe.skipIf(!hasDb)("notifications inbox", () => {
  let studentToken = "";
  let studentUserId = "";

  beforeAll(async () => {
    const email = `notif-inbox-${Date.now()}@example.test`;
    const password = "password123";
    const reg = await app.request("http://localhost/v1/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        displayName: "Notif Test",
        role: "student",
        gradeLevel: 8,
      }),
    });
    if (reg.status !== 201) {
      const login = await app.request("http://localhost/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      expect(login.status).toBe(200);
      const body = (await login.json()) as { token: string; user: { id: string } };
      studentToken = body.token;
      studentUserId = body.user.id;
      return;
    }
    const body = (await reg.json()) as { token: string; user: { id: string } };
    studentToken = body.token;
    studentUserId = body.user.id;
  });

  afterAll(async () => {
    if (studentUserId) {
      await pool.query(`delete from user_notifications where recipient_user_id = $1`, [studentUserId]);
    }
  });

  it("returns summary and supports read-all", async () => {
    await pool.query(
      `insert into user_notifications (recipient_user_id, channel, title, body, payload_jsonb, delivery_status, sent_at)
       values ($1, 'in_app', 'Test', 'Body', $2::jsonb, 'sent', now())`,
      [studentUserId, JSON.stringify({ kind: "general", href: "/student/panel" })],
    );

    const summaryRes = await app.request("http://localhost/v1/notifications/summary", {
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(summaryRes.status).toBe(200);
    const summary = (await summaryRes.json()) as { unread: number };
    expect(summary.unread).toBeGreaterThanOrEqual(1);

    const readAll = await app.request("http://localhost/v1/notifications/read-all", {
      method: "PATCH",
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(readAll.status).toBe(200);

    const summaryAfter = await app.request("http://localhost/v1/notifications/summary", {
      headers: { authorization: `Bearer ${studentToken}` },
    });
    const after = (await summaryAfter.json()) as { unread: number };
    expect(after.unread).toBe(0);
  });

  it("filters unread only", async () => {
    await pool.query(
      `insert into user_notifications (recipient_user_id, channel, title, body, payload_jsonb, delivery_status, sent_at, read_at)
       values ($1, 'in_app', 'Read', 'B', '{}'::jsonb, 'read', now(), now()),
              ($1, 'in_app', 'Unread', 'B', '{}'::jsonb, 'sent', now(), null)`,
      [studentUserId],
    );

    const res = await app.request("http://localhost/v1/notifications?unreadOnly=1&limit=20", {
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { notifications: Array<{ title: string; read_at: string | null }> };
    expect(body.notifications.every((n) => !n.read_at)).toBe(true);
    expect(body.notifications.some((n) => n.title === "Unread")).toBe(true);
  });
});
