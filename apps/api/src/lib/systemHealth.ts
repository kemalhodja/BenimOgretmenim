export type SystemHealthStatus = "ok" | "degraded" | "down";

export type SystemHealthCheck = {
  name: string;
  status: SystemHealthStatus;
};

export function summarizeSystemHealth(checks: SystemHealthCheck[]): SystemHealthStatus {
  if (checks.some((check) => check.status === "down")) return "down";
  if (checks.some((check) => check.status === "degraded")) return "degraded";
  return "ok";
}

export function runtimeHealthSnapshot() {
  const memory = process.memoryUsage();
  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    nodeVersion: process.version,
    uptimeSeconds: Math.round(process.uptime()),
    memory: {
      rssMb: Math.round(memory.rss / 1024 / 1024),
      heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024),
    },
  };
}

const PRODUCTION_REQUIRED_ENV = [
  "CORS_ORIGINS",
  "DATABASE_URL",
  "JWT_SECRET",
  "ADMIN_API_SECRET",
  "PAYTR_MERCHANT_ID",
  "PAYTR_MERCHANT_KEY",
  "PAYTR_MERCHANT_SALT",
  "PAYTR_BASE_URL",
  "PAYTR_OK_URL",
  "PAYTR_FAIL_URL",
  "PAYTR_CALLBACK_URL",
] as const;

export function productionConfigurationErrors(): string[] {
  if (process.env.NODE_ENV !== "production") return [];
  return PRODUCTION_REQUIRED_ENV.filter((key) => !process.env[key]?.trim()).map(
    (key) => `${key} production ortamında tanımlı olmalı.`,
  );
}

export function assertProductionConfiguration(): void {
  const errors = productionConfigurationErrors();
  if (!errors.length) return;
  throw new Error(`[config] Production configuration missing: ${errors.join(" ")}`);
}

export function configurationHealthWarnings(): string[] {
  const warnings: string[] = [];
  warnings.push(...productionConfigurationErrors());
  const isProd = process.env.NODE_ENV === "production";
  if (isProd && process.env.API_RATE_LIMIT_STORE?.trim().toLowerCase() === "memory") {
    warnings.push("API_RATE_LIMIT_STORE=memory production ortamında çoklu instance için önerilmez.");
  }
  if (!isProd && !process.env.JWT_SECRET?.trim()) {
    warnings.push("JWT_SECRET tanımlı değil; varsayılan geliştirme secret'ı kullanılabilir.");
  }
  if (!isProd && !process.env.DATABASE_URL?.trim()) {
    warnings.push("DATABASE_URL tanımlı değil; yerel varsayılan bağlantı kullanılabilir.");
  }
  if (!isProd && !process.env.ADMIN_API_SECRET?.trim()) {
    warnings.push("ADMIN_API_SECRET tanımlı değil; kritik admin onayları ek secret olmadan çalışabilir.");
  }
  if (!isProd) {
    for (const key of ["PAYTR_MERCHANT_ID", "PAYTR_MERCHANT_KEY", "PAYTR_MERCHANT_SALT"]) {
      if (!process.env[key]?.trim()) {
        warnings.push(`${key} tanımlı değil; PayTR ödeme akışı tamamlanamaz.`);
      }
    }
  }
  return warnings;
}
