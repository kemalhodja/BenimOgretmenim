import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { proxyMisplacedWebHost } from "./proxyMisplacedWebHost.js";

describe("proxyMisplacedWebHost", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) => {
        const u = String(url);
        if (u.startsWith("https://benimogretmenim.onrender.com/")) {
          return new Response("<!DOCTYPE html><html></html>", {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }
        return new Response("missing", { status: 404 });
      }),
    );
  });

  afterEach(() => {
    vi.stubGlobal("fetch", originalFetch);
  });

  it("proxies www non-API paths to web upstream", async () => {
    const app = new Hono();
    app.use("/*", proxyMisplacedWebHost);
    app.get("/", (c) => c.json({ service: "api" }));

    const res = await app.request("https://www.benimogretmenim.com.tr/", {
      headers: { host: "www.benimogretmenim.com.tr" },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("<!DOCTYPE html>");
  });

  it("does not proxy /v1 on www", async () => {
    const app = new Hono();
    app.use("/*", proxyMisplacedWebHost);
    app.get("/v1/ping", (c) => c.json({ ok: true }));

    const res = await app.request("https://www.benimogretmenim.com.tr/v1/ping", {
      headers: { host: "www.benimogretmenim.com.tr" },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(fetch).not.toHaveBeenCalled();
  });
});
