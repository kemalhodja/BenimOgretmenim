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

export function configurationHealthWarnings(): string[] {
  const warnings: string[] = [];
  if (process.env.NODE_ENV === "production" && !process.env.CORS_ORIGINS?.trim()) {
    warnings.push("CORS_ORIGINS production ortamında tanımlı olmalı.");
  }
  if (!process.env.JWT_SECRET?.trim()) {
    warnings.push("JWT_SECRET tanımlı değil; varsayılan geliştirme secret'ı kullanılabilir.");
  }
  if (!process.env.DATABASE_URL?.trim()) {
    warnings.push("DATABASE_URL tanımlı değil; yerel varsayılan bağlantı kullanılabilir.");
  }
  if (!process.env.ADMIN_API_SECRET?.trim()) {
    warnings.push("ADMIN_API_SECRET tanımlı değil; kritik admin onayları ek secret olmadan çalışabilir.");
  }
  for (const key of ["PAYTR_MERCHANT_ID", "PAYTR_MERCHANT_KEY", "PAYTR_MERCHANT_SALT"]) {
    if (!process.env[key]?.trim()) {
      warnings.push(`${key} tanımlı değil; PayTR ödeme akışı tamamlanamaz.`);
    }
  }
  return warnings;
}
