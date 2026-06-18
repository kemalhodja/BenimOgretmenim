import { describe, expect, it, vi, beforeEach } from "vitest";
import { allocateGuardianLessonCredits } from "./guardianLessonCredits.js";
import { getWalletAvailableMinor } from "./walletHolds.js";

function mockClient(opts: {
  link?: boolean;
  existingPoolId?: string | null;
  availableMinor?: bigint;
}) {
  const query = vi.fn(async (sql: string, params?: unknown[]) => {
    const s = String(sql);
    if (s.includes("student_guardians")) {
      return { rowCount: opts.link === false ? 0 : 1, rows: [] };
    }
    if (s.includes("from guardian_lesson_credit_pools") && s.includes("period_month")) {
      if (opts.existingPoolId) return { rowCount: 1, rows: [{ id: opts.existingPoolId }] };
      return { rowCount: 0, rows: [] };
    }
    if (s.includes("insert into guardian_lesson_credit_pools")) {
      return { rowCount: 1, rows: [{ id: "pool-new-1" }] };
    }
    if (s.includes("update guardian_lesson_credit_pools")) {
      return { rowCount: 1, rows: [] };
    }
    if (s.includes("balance_minor")) {
      return { rowCount: 1, rows: [{ balance_minor: String(opts.availableMinor ?? 500_000n) }] };
    }
    if (s.includes("user_wallet_holds")) {
      return { rowCount: 1, rows: [{ s: "0" }] };
    }
    if (s.includes("insert into user_wallets") || s.includes("user_wallets")) {
      return { rowCount: 1, rows: [] };
    }
    return { rowCount: 0, rows: [] };
  });
  return { query };
}

vi.mock("./walletHolds.js", () => ({
  getWalletAvailableMinor: vi.fn(async () => 500_000n),
}));

describe("allocateGuardianLessonCredits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new monthly pool when none exists", async () => {
    const client = mockClient({ link: true });
    const result = await allocateGuardianLessonCredits(
      {
        guardianUserId: "g-1",
        studentId: "s-1",
        monthlyCredits: 3,
        perLessonBudgetMinor: 20000,
      },
      client as never,
    );
    expect(result.poolId).toBe("pool-new-1");
    expect(result.creditsRemaining).toBe(3);
  });

  it("updates existing pool for the same period", async () => {
    const client = mockClient({ link: true, existingPoolId: "pool-existing" });
    const result = await allocateGuardianLessonCredits(
      {
        guardianUserId: "g-1",
        studentId: "s-1",
        monthlyCredits: 5,
        perLessonBudgetMinor: 10000,
      },
      client as never,
    );
    expect(result.poolId).toBe("pool-existing");
    expect(result.creditsRemaining).toBe(5);
    const updateCall = client.query.mock.calls.find((c) => String(c[0]).includes("update guardian_lesson_credit_pools"));
    expect(updateCall).toBeTruthy();
  });

  it("throws when guardian is not linked to student", async () => {
    const client = mockClient({ link: false });
    await expect(
      allocateGuardianLessonCredits(
        {
          guardianUserId: "g-1",
          studentId: "s-1",
          monthlyCredits: 2,
          perLessonBudgetMinor: 15000,
        },
        client as never,
      ),
    ).rejects.toMatchObject({ code: "guardian_not_linked" });
  });

  it("throws when wallet available balance is insufficient", async () => {
    vi.mocked(getWalletAvailableMinor).mockResolvedValueOnce(1000n);
    const client = mockClient({ link: true });
    await expect(
      allocateGuardianLessonCredits(
        {
          guardianUserId: "g-1",
          studentId: "s-1",
          monthlyCredits: 4,
          perLessonBudgetMinor: 20000,
        },
        client as never,
      ),
    ).rejects.toMatchObject({ code: "insufficient_wallet_available" });
  });
});
