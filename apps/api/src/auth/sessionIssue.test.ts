import { describe, expect, it } from "vitest";
import { briefSessionMaxAgeSeconds, rememberSessionMaxAgeSeconds } from "./sessionCookie.js";
import { sessionAuthDuration } from "./sessionIssue.js";

describe("sessionIssue", () => {
  it("uses longer duration when rememberMe is true", () => {
    const remember = sessionAuthDuration(true);
    const brief = sessionAuthDuration(false);
    expect(remember.maxAgeSeconds).toBeGreaterThan(brief.maxAgeSeconds);
    expect(remember.maxAgeSeconds).toBe(rememberSessionMaxAgeSeconds());
    expect(brief.maxAgeSeconds).toBe(briefSessionMaxAgeSeconds());
    expect(remember.jwtExpires).toBe("90d");
    expect(brief.jwtExpires).toBe("1d");
  });
});
