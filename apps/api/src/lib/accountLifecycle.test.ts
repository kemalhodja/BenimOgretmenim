import { describe, expect, it, vi } from "vitest";
import {
  accountStatusBlocksAccess,
  isAccountStatusExemptPath,
  loadUserAccountStatus,
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
});
