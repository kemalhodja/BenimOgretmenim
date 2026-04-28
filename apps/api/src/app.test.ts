import { describe, expect, it } from "vitest";
import { app } from "./app.js";

describe("API app", () => {
  it("returns JSON for unhandled errors (no HTML)", async () => {
    const path = `/__test_throw_${Math.random().toString(16).slice(2)}`;
    app.get(path, () => {
      throw new Error("boom");
    });

    const res = await app.request(`http://localhost${path}`);
    expect(res.status).toBe(500);
    expect(res.headers.get("content-type") ?? "").toContain("application/json");

    const body = (await res.json()) as { error?: unknown; details?: unknown };
    expect(body.error).toBe("internal_error");
    if (process.env.NODE_ENV !== "production") {
      expect(body.details).toBe("boom");
    }
  });

  it("sets x-request-id on responses", async () => {
    const res = await app.request("http://localhost/health");
    expect([200, 503]).toContain(res.status);
    const rid = res.headers.get("x-request-id");
    expect(rid).toBeTruthy();
  });

  it("rate limits /v1/auth/login after burst", async () => {
    const health = await app.request("http://localhost/health");
    if (health.status !== 200) {
      // Auth routes hit Postgres; without a DB these tests become noisy 500s.
      return;
    }

    const headers = {
      "x-forwarded-for": "203.0.113.10",
      "content-type": "application/json",
    };
    let lastStatus = 0;

    for (let i = 0; i < 20; i++) {
      const r = await app.request("http://localhost/v1/auth/login", {
        method: "POST",
        headers,
        body: JSON.stringify({ email: "no-such-user@example.com", password: "wrong-pass-1" }),
      });
      lastStatus = r.status;
      if (r.status === 429) break;
    }

    expect(lastStatus).toBe(429);
  });
});
