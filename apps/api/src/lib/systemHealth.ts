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

const PRODUCTION_CORE_REQUIRED = [
  "CORS_ORIGINS",
  "DATABASE_URL",
  "JWT_SECRET",
  "ADMIN_API_SECRET",
] as const;

const PAYTR_PRODUCTION_REQUIRED = [
  "PAYTR_MERCHANT_ID",
  "PAYTR_MERCHANT_KEY",
  "PAYTR_MERCHANT_SALT",
  "PAYTR_BASE_URL",
  "PAYTR_OK_URL",
  "PAYTR_FAIL_URL",
  "PAYTR_CALLBACK_URL",
] as const;

/** Ödeme canlıya alınmadan önce geçici olarak 1 — API açılır, PayTR uçları yapılandırma hatası döner. */
export function paytrOptionalInProduction(): boolean {
  return process.env.PAYTR_OPTIONAL?.trim() === "1";
}

/** Merchant ID girildiyse tam PayTR env zorunlu; aksi halde boot kilitleme. */
export function paytrRequiredInProduction(): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  if (paytrOptionalInProduction()) return false;
  return Boolean(process.env.PAYTR_MERCHANT_ID?.trim());
}

export function isPaytrFullyConfigured(): boolean {
  return PAYTR_PRODUCTION_REQUIRED.every((key) => Boolean(process.env[key]?.trim()));
}

export function productionConfigurationErrors(): string[] {
  if (process.env.NODE_ENV !== "production") return [];
  const required: string[] = [...PRODUCTION_CORE_REQUIRED];
  if (paytrRequiredInProduction()) {
    required.push(...PAYTR_PRODUCTION_REQUIRED);
  }
  return required.filter((key) => !process.env[key]?.trim()).map(
    (key) => `${key} production ortamında tanımlı olmalı.`,
  );
}

export function assertProductionConfiguration(): void {
  const errors = productionConfigurationErrors();
  if (!errors.length) return;
  const paytrHint = paytrOptionalInProduction()
    ? ""
    : " PayTR merchant bilgileri için Render → benimogretmenim-api → Environment; geçici olarak ödeme hariç açmak için PAYTR_OPTIONAL=1.";
  throw new Error(`[config] Production configuration missing: ${errors.join(" ")}${paytrHint}`);
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
  if (isProd && paytrOptionalInProduction() && !isPaytrFullyConfigured()) {
    warnings.push(
      "PAYTR_OPTIONAL=1: API ödeme hariç açık; PayTR merchant ve URL env'leri tamamlanınca PAYTR_OPTIONAL kaldırın.",
    );
  }
  if (isProd && !paytrRequiredInProduction() && !isPaytrFullyConfigured()) {
    warnings.push(
      "PayTR merchant env'leri tanımlı değil; API açılır ancak kart ödemesi çalışmaz. Canlı ödeme için merchant bilgilerini girin.",
    );
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
