import { describe, expect, it, vi } from "vitest";
import {
  accountStatusBlocksAccess,
  isAccountStatusExemptPath,
  loadUserAccountStatus,
  notifyLessonVideoPublishedToGradeStudents,
} from "./accountLifecycle.js";

describe("accountLifecycle", () => {
  it("blocks suspended and deletion_requested", () => {
    expect(accountStatusBlocksAccess("active")).toBe(false);
    expect(accountStatusBlocksAccess("suspended")).toBe(true);
    expect(accountStatusBlocksAccess("deletion_requested")).toBe(true);
  });

  it("exempts auth and support paths", () => {
    expect(isAccountStatusExemptPath("/v1/auth/me")).toBe(true);
    expect(isAccountStatusExemptPath("/v1/auth/account/deletion-request")).toBe(true);
    expect(isAccountStatusExemptPath("/v1/support/disputes")).toBe(true);
    expect(isAccountStatusExemptPath("/health")).toBe(true);
    expect(isAccountStatusExemptPath("/v1/wallet/me")).toBe(false);
  });

  it("defaults to active when account_status column is missing", async () => {
    const db = {
      query: vi.fn().mockRejectedValue(Object.assign(new Error("column does not exist"), { code: "42703" })),
    };
    await expect(loadUserAccountStatus("user-1", db as import("pg").Pool)).resolves.toEqual({
      account_status: "active",
      suspension_reason: null,
      suspended_at: null,
      deletion_requested_at: null,
      deletion_reason: null,
    });
  });

  it("returns null for non-uuid user ids", async () => {
    const db = {
      query: vi.fn().mockRejectedValue(Object.assign(new Error("invalid input syntax for type uuid"), { code: "22P02" })),
    };
    await expect(loadUserAccountStatus("user-cookie-1", db as import("pg").Pool)).resolves.toBeNull();
  });

  it("defaults to active when database credentials fail", async () => {
    const db = {
      query: vi.fn().mockRejectedValue(Object.assign(new Error("password authentication failed"), { code: "28P01" })),
    };
    await expect(loadUserAccountStatus("00000000-0000-0000-0000-000000000001", db as import("pg").Pool)).resolves.toEqual({
      account_status: "active",
      suspension_reason: null,
      suspended_at: null,
      deletion_requested_at: null,
      deletion_reason: null,
    });
  });

  it("dedupes lesson video publish notifications per video and daily cap", async () => {
    const inserts: unknown[][] = [];
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [{ user_id: "user-a" }, { user_id: "user-b" }],
        rowCount: 2,
      })
      .mockImplementationOnce(async (_sql: string, params?: unknown[]) => {
        inserts.push(params ?? []);
        return { rows: [], rowCount: 1 };
      })
      .mockImplementationOnce(async (_sql: string, params?: unknown[]) => {
        inserts.push(params ?? []);
        return { rows: [], rowCount: 1 };
      })
      .mockResolvedValueOnce({ rows: [{ c: 2 }] });
    const db = { query };

    const result = await notifyLessonVideoPublishedToGradeStudents(
      {
        id: "video-1",
        title: "Test video",
        gradeLevel: 8,
        branchId: 1,
        branchName: "Matematik",
      },
      db as import("pg").Pool,
    );

    expect(result).toEqual({ notified: 2, skipped: 0 });
    expect(inserts).toHaveLength(2);
    expect(String(inserts[0]?.[3])).toContain("lesson_video_published");
  });
});
