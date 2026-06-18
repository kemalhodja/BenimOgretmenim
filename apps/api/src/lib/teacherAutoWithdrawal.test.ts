import { describe, expect, it } from "vitest";
import { evaluateAutoWithdrawal, normalizeIban } from "./teacherAutoWithdrawal.js";
import type { TeacherAutoWithdrawalSettings } from "./platformOpsSettings.js";

const baseSettings: TeacherAutoWithdrawalSettings = {
  enabled: true,
  autoApproveEnabled: false,
  maxAmountMinor: 250_000,
  requireVerified: true,
  requireSameIbanAsLastPaid: true,
  minPriorPaidCount: 1,
  maxDailyAutoApprovals: 3,
};

describe("teacherAutoWithdrawal", () => {
  it("normalizes iban spacing", () => {
    expect(normalizeIban("tr12 3456")).toBe("TR123456");
  });

  it("approves eligible verified teacher under cap", () => {
    const r = evaluateAutoWithdrawal({
      settings: baseSettings,
      verificationStatus: "verified",
      amountMinor: 100_000,
      iban: "TR123",
      priorPaidSameIbanCount: 2,
      openDisputeCount: 0,
      autoApprovalsToday: 0,
    });
    expect(r.eligible).toBe(true);
  });

  it("rejects when verification missing", () => {
    const r = evaluateAutoWithdrawal({
      settings: baseSettings,
      verificationStatus: "pending",
      amountMinor: 50_000,
      iban: "TR123",
      priorPaidSameIbanCount: 2,
      openDisputeCount: 0,
      autoApprovalsToday: 0,
    });
    expect(r.eligible).toBe(false);
    expect(r.reasons.some((x) => /doğrulanmamış/i.test(x))).toBe(true);
  });

  it("rejects when open dispute exists", () => {
    const r = evaluateAutoWithdrawal({
      settings: baseSettings,
      verificationStatus: "verified",
      amountMinor: 50_000,
      iban: "TR123",
      priorPaidSameIbanCount: 2,
      openDisputeCount: 1,
      autoApprovalsToday: 0,
    });
    expect(r.eligible).toBe(false);
  });
});
