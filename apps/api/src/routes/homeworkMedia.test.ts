import { describe, expect, it } from "vitest";
import { app } from "../app.js";

describe("homework media route", () => {
  it("returns 503 when storage is not configured", async () => {
    const prevDir = process.env.HOMEWORK_STORAGE_DIR;
    const prevBase = process.env.HOMEWORK_STORAGE_PUBLIC_BASE;
    delete process.env.HOMEWORK_STORAGE_DIR;
    delete process.env.HOMEWORK_STORAGE_PUBLIC_BASE;
    const res = await app.request("http://localhost/v1/homework-media/user/draft/test.jpg");
    expect(res.status).toBe(503);
    if (prevDir) process.env.HOMEWORK_STORAGE_DIR = prevDir;
    if (prevBase) process.env.HOMEWORK_STORAGE_PUBLIC_BASE = prevBase;
  });

  it("rejects path traversal", async () => {
    const prevDir = process.env.HOMEWORK_STORAGE_DIR;
    const prevBase = process.env.HOMEWORK_STORAGE_PUBLIC_BASE;
    process.env.HOMEWORK_STORAGE_DIR = "/tmp/homework-test";
    process.env.HOMEWORK_STORAGE_PUBLIC_BASE = "https://api.example.com/v1/homework-media";
    const res = await app.request("http://localhost/v1/homework-media/../etc/passwd");
    expect([400, 403, 404]).toContain(res.status);
    if (prevDir) process.env.HOMEWORK_STORAGE_DIR = prevDir;
    else delete process.env.HOMEWORK_STORAGE_DIR;
    if (prevBase) process.env.HOMEWORK_STORAGE_PUBLIC_BASE = prevBase;
    else delete process.env.HOMEWORK_STORAGE_PUBLIC_BASE;
  });
});
