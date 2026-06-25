import { describe, expect, it } from "vitest";
import { computeLaunchReadiness } from "./launchReadiness.js";

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

  it("includes dns and play store growth gaps", () => {
    const r = computeLaunchReadiness();
    expect(r.gaps.some((g) => g.id === "dns_domains")).toBe(true);
    expect(r.gaps.some((g) => g.id === "play_store")).toBe(true);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(10);
  });
});
