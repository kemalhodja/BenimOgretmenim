import { describe, expect, it } from "vitest";
import {
  computeLaunchReadiness,
  isDnsProxyBridgeActive,
  isPlayStoreShaConfigured,
} from "./launchReadiness.js";

describe("launchReadiness", () => {
  it("reports PayTR as open when optional mode is on", () => {
    const prev = process.env.PAYTR_OPTIONAL;
    process.env.PAYTR_OPTIONAL = "1";
    const r = computeLaunchReadiness();
    const paytr = r.gaps.find((g) => g.id === "paytr");
    expect(paytr?.status).toBe("open");
    expect(r.readyForRevenue).toBe(false);
    if (prev === undefined) delete process.env.PAYTR_OPTIONAL;
    else process.env.PAYTR_OPTIONAL = prev;
  });

  it("marks DNS ok when LAUNCH_DNS_VERIFIED=1", () => {
    const prev = process.env.LAUNCH_DNS_VERIFIED;
    process.env.LAUNCH_DNS_VERIFIED = "1";
    const dns = computeLaunchReadiness().gaps.find((g) => g.id === "dns_domains");
    expect(dns?.status).toBe("ok");
    if (prev === undefined) delete process.env.LAUNCH_DNS_VERIFIED;
    else process.env.LAUNCH_DNS_VERIFIED = prev;
  });

  it("detects DNS proxy bridge via WEB_UPSTREAM_ORIGIN", () => {
    const prev = process.env.WEB_UPSTREAM_ORIGIN;
    process.env.WEB_UPSTREAM_ORIGIN = "https://example-web.onrender.com";
    expect(isDnsProxyBridgeActive()).toBe(true);
    const dns = computeLaunchReadiness().gaps.find((g) => g.id === "dns_domains");
    expect(dns?.title).toContain("köprü");
    if (prev === undefined) delete process.env.WEB_UPSTREAM_ORIGIN;
    else process.env.WEB_UPSTREAM_ORIGIN = prev;
  });

  it("detects Play Store SHA when PLAY_STORE_SHA256 is set", () => {
    const prev = process.env.PLAY_STORE_SHA256;
    process.env.PLAY_STORE_SHA256 = "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA";
    expect(isPlayStoreShaConfigured()).toBe(true);
    const play = computeLaunchReadiness().gaps.find((g) => g.id === "play_store");
    expect(play?.status).toBe("ok");
    if (prev === undefined) delete process.env.PLAY_STORE_SHA256;
    else process.env.PLAY_STORE_SHA256 = prev;
  });

  it("includes all gap categories", () => {
    const r = computeLaunchReadiness();
    expect(r.gaps.some((g) => g.id === "paytr")).toBe(true);
    expect(r.gaps.some((g) => g.id === "homework_storage")).toBe(true);
    expect(r.gaps.some((g) => g.id === "email")).toBe(true);
    expect(r.gaps.some((g) => g.id === "smoke_runs")).toBe(true);
    expect(r.gaps.some((g) => g.id === "dns_domains")).toBe(true);
    expect(r.gaps.some((g) => g.id === "play_store")).toBe(true);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(10);
  });
});
