import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { signAccessToken } from "./auth/jwt.js";
import { SESSION_COOKIE_NAME } from "./auth/sessionCookie.js";
import { requireAuth } from "./middleware/requireAuth.js";
import type { AppVariables } from "./types.js";

function testApp() {
  const app = new Hono<{ Variables: AppVariables }>();
  app.get("/private", requireAuth, (c) => c.json({ userId: c.get("userId"), role: c.get("userRole") }));
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

  it("returns unauthorized when neither bearer nor session cookie is present", async () => {
    const res = await testApp().request("http://localhost/private");

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "missing_auth_token" });
  });
});
