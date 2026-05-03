import { afterEach, describe, expect, it, vi } from "vitest";
import {
  homeworkResolveMinutes,
  homeworkSatisfactionRewardMinor,
  releaseExpiredHomeworkClaims,
} from "./homeworkPosts.js";

describe("homeworkResolveMinutes", () => {
  afterEach(() => {
    delete process.env.HOMEWORK_CLAIM_RESOLVE_MINUTES;
  });

  it("defaults to 20 when env unset", () => {
    delete process.env.HOMEWORK_CLAIM_RESOLVE_MINUTES;
    expect(homeworkResolveMinutes()).toBe(20);
  });

  it("uses valid integer env", () => {
    process.env.HOMEWORK_CLAIM_RESOLVE_MINUTES = "45";
    expect(homeworkResolveMinutes()).toBe(45);
  });

  it("floors decimal env", () => {
    process.env.HOMEWORK_CLAIM_RESOLVE_MINUTES = "30.9";
    expect(homeworkResolveMinutes()).toBe(30);
  });

  it("rejects below 1", () => {
    process.env.HOMEWORK_CLAIM_RESOLVE_MINUTES = "0";
    expect(homeworkResolveMinutes()).toBe(20);
  });

  it("rejects above 24h", () => {
    process.env.HOMEWORK_CLAIM_RESOLVE_MINUTES = String(24 * 60 + 1);
    expect(homeworkResolveMinutes()).toBe(20);
  });

  it("rejects NaN", () => {
    process.env.HOMEWORK_CLAIM_RESOLVE_MINUTES = "x";
    expect(homeworkResolveMinutes()).toBe(20);
  });

  it("accepts max boundary 24h", () => {
    process.env.HOMEWORK_CLAIM_RESOLVE_MINUTES = String(24 * 60);
    expect(homeworkResolveMinutes()).toBe(24 * 60);
  });
});

describe("homeworkSatisfactionRewardMinor", () => {
  afterEach(() => {
    delete process.env.HOMEWORK_SATISFACTION_REWARD_MINOR;
  });

  it("defaults to 1000 minor (10 TL) when unset", () => {
    delete process.env.HOMEWORK_SATISFACTION_REWARD_MINOR;
    expect(homeworkSatisfactionRewardMinor()).toBe(1000);
  });

  it("uses valid env", () => {
    process.env.HOMEWORK_SATISFACTION_REWARD_MINOR = "2500";
    expect(homeworkSatisfactionRewardMinor()).toBe(2500);
  });

  it("rejects zero", () => {
    process.env.HOMEWORK_SATISFACTION_REWARD_MINOR = "0";
    expect(homeworkSatisfactionRewardMinor()).toBe(1000);
  });

  it("rejects above cap", () => {
    process.env.HOMEWORK_SATISFACTION_REWARD_MINOR = "1000001";
    expect(homeworkSatisfactionRewardMinor()).toBe(1000);
  });

  it("accepts max cap", () => {
    process.env.HOMEWORK_SATISFACTION_REWARD_MINOR = "1000000";
    expect(homeworkSatisfactionRewardMinor()).toBe(1_000_000);
  });

  it("floors decimal", () => {
    process.env.HOMEWORK_SATISFACTION_REWARD_MINOR = "1500.7";
    expect(homeworkSatisfactionRewardMinor()).toBe(1500);
  });
});

describe("releaseExpiredHomeworkClaims", () => {
  it("returns rowCount when set", async () => {
    const db = {
      query: vi.fn().mockResolvedValue({ rowCount: 4 }),
    };
    await expect(releaseExpiredHomeworkClaims(db as import("pg").Pool)).resolves.toBe(4);
    expect(db.query).toHaveBeenCalledTimes(1);
    const sql = String(db.query.mock.calls[0]?.[0] ?? "");
    expect(sql).toContain("student_homework_posts");
    expect(sql).toContain("resolve_deadline_at");
  });

  it("returns 0 when rowCount missing", async () => {
    const db = {
      query: vi.fn().mockResolvedValue({ rowCount: undefined }),
    };
    await expect(releaseExpiredHomeworkClaims(db as import("pg").Pool)).resolves.toBe(0);
  });
});
