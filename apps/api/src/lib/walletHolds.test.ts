import type { PoolClient } from "pg";
import { describe, expect, it, vi } from "vitest";
import { reduceWalletHoldAmount } from "./walletHolds.js";

describe("wallet hold helpers", () => {
  it("marks a fully consumed hold charged without writing amount_minor = 0", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [] });
    const client = { query } as unknown as PoolClient;

    await reduceWalletHoldAmount({ holdId: "00000000-0000-0000-0000-000000000001", newAmountMinor: 0n }, client);

    expect(query).toHaveBeenCalledTimes(1);
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("set status = 'charged'");
    expect(sql).not.toContain("amount_minor = 0");
  });
});
