import { describe, expect, it, vi } from "vitest";
import { getLessonVideoSchemaStatus } from "./lessonVideoDbReady.js";

describe("getLessonVideoSchemaStatus", () => {
  it("reports ready when tables and moderation column exist", async () => {
    const db = {
      query: vi.fn().mockResolvedValue({
        rows: [{ tables: true, views: true, moderation: true }],
      }),
    };
    await expect(getLessonVideoSchemaStatus(db as import("pg").Pool)).resolves.toEqual({
      ready: true,
      tables: true,
      views: true,
      moderation: true,
    });
  });

  it("reports not ready when moderation column missing", async () => {
    const db = {
      query: vi.fn().mockResolvedValue({
        rows: [{ tables: true, views: true, moderation: false }],
      }),
    };
    await expect(getLessonVideoSchemaStatus(db as import("pg").Pool)).resolves.toEqual({
      ready: false,
      tables: true,
      views: true,
      moderation: false,
    });
  });
});
