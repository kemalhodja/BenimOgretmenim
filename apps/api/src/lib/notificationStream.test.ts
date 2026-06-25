import { describe, expect, it } from "vitest";
import { summarySignature } from "./notificationStream.js";

describe("notificationStream", () => {
  it("builds stable summary signature", () => {
    const a = summarySignature({ unread: 2, total: 5, latestAt: "2026-01-01", byCategory: {} });
    const b = summarySignature({ unread: 2, total: 5, latestAt: "2026-01-01", byCategory: { lesson: 1 } });
    expect(a).toBe("2:2026-01-01:5");
    expect(b).toBe(a);
  });
});
