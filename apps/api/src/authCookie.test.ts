import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { signAccessToken } from "./auth/jwt.js";
import {
  clearSessionCookie,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  CSRF_HEADER_VALUE,
  SESSION_COOKIE_NAME,
  SESSION_ROLE_COOKIE_NAME,
  SESSION_USER_ID_COOKIE_NAME,
  setSessionCookie,
  setSessionHintCookies,
} from "./auth/sessionCookie.js";
import { requireAuth } from "./middleware/requireAuth.js";
import type { AppVariables } from "./types.js";

function testApp() {
  const app = new Hono<{ Variables: AppVariables }>();
  app.get("/private", requireAuth, (c) => c.json({ userId: c.get("userId"), role: c.get("userRole") }));
  app.post("/private", requireAuth, (c) => c.json({ userId: c.get("userId"), role: c.get("userRole") }));
  return app;
}

describe("session cookie auth", () => {
  it("authenticates requests with the HttpOnly session cookie when bearer is absent", async () => {
    const token = await signAccessToken({ userId: "user-cookie-1", role: "student" });
    const res = await testApp().request("http://localhost/private", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ userId: "user-cookie-1", role: "student" });
  });

  it("keeps bearer auth as the primary migration-compatible path", async () => {
    const token = await signAccessToken({ userId: "user-bearer-1", role: "teacher" });
    const res = await testApp().request("http://localhost/private", {
      headers: {
        authorization: `Bearer ${token}`,
        cookie: `${SESSION_COOKIE_NAME}=not-a-valid-token`,
      },
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ userId: "user-bearer-1", role: "teacher" });
  });

  it("rejects unsafe cookie-authenticated requests without CSRF header", async () => {
    const token = await signAccessToken({ userId: "user-cookie-2", role: "student" });
    const res = await testApp().request("http://localhost/private", {
      method: "POST",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
    });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "csrf_token_required" });
  });

  it("allows unsafe cookie-authenticated requests with CSRF header", async () => {
    const token = await signAccessToken({ userId: "user-cookie-3", role: "student" });
    const res = await testApp().request("http://localhost/private", {
      method: "POST",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${token}`,
        [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE,
      },
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ userId: "user-cookie-3", role: "student" });
  });

  it("allows unsafe cookie-authenticated requests with the per-session CSRF cookie value", async () => {
    const token = await signAccessToken({ userId: "user-cookie-4", role: "student" });
    const csrf = "csrf-session-specific";
    const res = await testApp().request("http://localhost/private", {
      method: "POST",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${token}; ${CSRF_COOKIE_NAME}=${csrf}`,
        [CSRF_HEADER_NAME]: csrf,
      },
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ userId: "user-cookie-4", role: "student" });
  });

  it("rejects unsafe cookie-authenticated requests when per-session CSRF does not match", async () => {
    const token = await signAccessToken({ userId: "user-cookie-5", role: "student" });
    const res = await testApp().request("http://localhost/private", {
      method: "POST",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${token}; ${CSRF_COOKIE_NAME}=csrf-real`,
        [CSRF_HEADER_NAME]: "csrf-wrong",
      },
    });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "csrf_token_required" });
  });

  it("does not require CSRF header for bearer-authenticated unsafe requests", async () => {
    const token = await signAccessToken({ userId: "user-bearer-2", role: "teacher" });
    const res = await testApp().request("http://localhost/private", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ userId: "user-bearer-2", role: "teacher" });
  });

  it("returns unauthorized when neither bearer nor session cookie is present", async () => {
    const res = await testApp().request("http://localhost/private");

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "missing_auth_token" });
  });

  it("sets readable session hint cookies next to the HttpOnly session cookie", async () => {
    const app = new Hono<{ Variables: AppVariables }>();
    app.get("/set", async (c) => {
      const token = await signAccessToken({ userId: "user-hint-1", role: "guardian" });
      setSessionCookie(c, token);
      setSessionHintCookies(c, { userId: "user-hint-1", role: "guardian" });
      return c.text("ok");
    });

    const res = await app.request("http://localhost/set");
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookie).toContain(`${CSRF_COOKIE_NAME}=`);
    expect(setCookie).toContain(`${SESSION_ROLE_COOKIE_NAME}=guardian`);
    expect(setCookie).toContain(`${SESSION_USER_ID_COOKIE_NAME}=user-hint-1`);
  });

  it("clears session hint cookies on logout together with the session cookie", async () => {
    const app = new Hono<{ Variables: AppVariables }>();
    app.get("/clear", (c) => {
      clearSessionCookie(c);
      return c.text("ok");
    });

    const res = await app.request("http://localhost/clear");
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookie).toContain(`${CSRF_COOKIE_NAME}=`);
    expect(setCookie).toContain(`${SESSION_ROLE_COOKIE_NAME}=`);
    expect(setCookie).toContain(`${SESSION_USER_ID_COOKIE_NAME}=`);
  });
});
