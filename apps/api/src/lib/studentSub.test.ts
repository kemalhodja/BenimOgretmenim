import { describe, expect, it } from "vitest";
import { getStudentSubPriceConfig, studentUsagePolicyForSubscription } from "./studentSub.js";

describe("student subscription policy", () => {
  it("uses annual 1500 TL pricing by default", () => {
    const price = getStudentSubPriceConfig();
    expect(price.annualMonths).toBe(12);
    expect(price.annualPriceMinor).toBe(150_000);
    expect(price.pricePerMonthMinor).toBe(12_500);
  });

  it("gives free and annual students different daily limits", () => {
    expect(studentUsagePolicyForSubscription(null)).toEqual({
      tier: "free",
      dailyLessonRequestLimit: 1,
      dailyHomeworkPostLimit: 5,
    });
    expect(studentUsagePolicyForSubscription({ months_count: 12 })).toEqual({
      tier: "annual",
      dailyLessonRequestLimit: 5,
      dailyHomeworkPostLimit: 10,
    });
  });
});
