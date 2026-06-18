import { describe, expect, it } from "vitest";
import {
  TEACHER_WITHDRAWAL_SLA_BUSINESS_DAYS,
  addBusinessDays,
  estimatedWithdrawalCompletion,
  withdrawalSlaLabelTr,
} from "./teacherWithdrawalSla.js";

describe("teacherWithdrawalSla", () => {
  it("adds only weekdays", () => {
    // 2026-06-12 Fri + 1 business day => Mon 2026-06-15
    const fri = new Date("2026-06-12T10:00:00+03:00");
    const mon = addBusinessDays(fri, 1);
    expect(mon.getDay()).toBe(1);
    expect(mon.getDate()).toBe(15);
  });

  it("skips weekend for 5 business days from Monday", () => {
    const mon = new Date("2026-06-15T09:00:00+03:00");
    const done = addBusinessDays(mon, TEACHER_WITHDRAWAL_SLA_BUSINESS_DAYS);
    expect(done.getDay()).toBe(1);
    expect(done.getDate()).toBe(22);
  });

  it("estimated completion uses SLA constant", () => {
    const base = new Date("2026-06-17T12:00:00+03:00");
    const est = estimatedWithdrawalCompletion(base);
    expect(est.getTime()).toBeGreaterThan(base.getTime());
  });

  it("label mentions business days in Turkish", () => {
    expect(withdrawalSlaLabelTr()).toContain(String(TEACHER_WITHDRAWAL_SLA_BUSINESS_DAYS));
    expect(withdrawalSlaLabelTr()).toContain("iş günü");
  });
});
