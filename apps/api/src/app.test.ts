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

  it("rate limits /v1/auth/* after burst", async () => {
    const headers = { "x-forwarded-for": "203.0.113.10" };
    let lastStatus = 0;

    for (let i = 0; i < 40; i++) {
      const r = await app.request("http://localhost/v1/auth/me", { headers });
      lastStatus = r.status;
      if (r.status === 429) break;
    }

    expect(lastStatus).toBe(429);
  });
});
