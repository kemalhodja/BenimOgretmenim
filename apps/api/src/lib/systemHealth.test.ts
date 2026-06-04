import { afterEach, describe, expect, it } from "vitest";
import { configurationHealthWarnings, summarizeSystemHealth } from "./systemHealth.js";

describe("summarizeSystemHealth", () => {
  it("returns ok when every check is ok", () => {
    expect(
      summarizeSystemHealth([
        { name: "database", status: "ok" },
        { name: "configuration", status: "ok" },
      ]),
    ).toBe("ok");
  });

  it("returns degraded when at least one check is degraded", () => {
    expect(
      summarizeSystemHealth([
        { name: "database", status: "ok" },
        { name: "migrations", status: "degraded" },
      ]),
    ).toBe("degraded");
  });

  it("returns down when any check is down", () => {
    expect(
      summarizeSystemHealth([
        { name: "database", status: "down" },
        { name: "configuration", status: "degraded" },
      ]),
    ).toBe("down");
  });
});

describe("configurationHealthWarnings", () => {
  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    CORS_ORIGINS: process.env.CORS_ORIGINS,
    JWT_SECRET: process.env.JWT_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    ADMIN_API_SECRET: process.env.ADMIN_API_SECRET,
    PAYTR_MERCHANT_ID: process.env.PAYTR_MERCHANT_ID,
    PAYTR_MERCHANT_KEY: process.env.PAYTR_MERCHANT_KEY,
    PAYTR_MERCHANT_SALT: process.env.PAYTR_MERCHANT_SALT,
  };

  function restoreEnv(key: keyof typeof originalEnv) {
    const value = originalEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  afterEach(() => {
    restoreEnv("NODE_ENV");
    restoreEnv("CORS_ORIGINS");
    restoreEnv("JWT_SECRET");
    restoreEnv("DATABASE_URL");
    restoreEnv("ADMIN_API_SECRET");
    restoreEnv("PAYTR_MERCHANT_ID");
    restoreEnv("PAYTR_MERCHANT_KEY");
    restoreEnv("PAYTR_MERCHANT_SALT");
  });

  it("warns about missing production CORS origins without leaking secret values", () => {
    process.env.NODE_ENV = "production";
    delete process.env.CORS_ORIGINS;
    process.env.JWT_SECRET = "secret-value";
    process.env.DATABASE_URL = "postgres://example";
    process.env.ADMIN_API_SECRET = "admin-secret";
    process.env.PAYTR_MERCHANT_ID = "merchant-id";
    process.env.PAYTR_MERCHANT_KEY = "merchant-key";
    process.env.PAYTR_MERCHANT_SALT = "merchant-salt";

    expect(configurationHealthWarnings()).toEqual([
      "CORS_ORIGINS production ortamında tanımlı olmalı.",
    ]);
  });

  it("warns about missing sensitive runtime configuration by key name only", () => {
    process.env.NODE_ENV = "development";
    process.env.CORS_ORIGINS = "http://localhost:3000";
    delete process.env.JWT_SECRET;
    delete process.env.DATABASE_URL;
    delete process.env.ADMIN_API_SECRET;
    delete process.env.PAYTR_MERCHANT_ID;
    delete process.env.PAYTR_MERCHANT_KEY;
    delete process.env.PAYTR_MERCHANT_SALT;

    const warnings = configurationHealthWarnings();
    expect(warnings.join(" ")).toContain("JWT_SECRET");
    expect(warnings.join(" ")).toContain("DATABASE_URL");
    expect(warnings.join(" ")).toContain("ADMIN_API_SECRET");
    expect(warnings.join(" ")).toContain("PAYTR_MERCHANT_ID");
    expect(warnings.join(" ")).not.toContain("postgres://");
  });
});
