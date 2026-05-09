import type { APIRequestContext } from "@playwright/test";

function defaultHealthUrl(): string {
  const explicit = process.env.PLAYWRIGHT_API_HEALTH_URL?.trim();
  if (explicit) return explicit;
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.trim()?.replace(/\/+$/, "");
  if (base) return `${base}/health`;
  return "http://127.0.0.1:3002/health";
}

/**
 * Gerçek oturum / giriş akışları için API’nin ayakta olması gerekir.
 * Veritabanı + migrate + seed yapılmadıysa false döner.
 */
export async function isApiHealthy(request: APIRequestContext): Promise<boolean> {
  try {
    const res = await request.get(defaultHealthUrl(), {
      timeout: 5000,
      failOnStatusCode: false,
    });
    return res.ok();
  } catch {
    return false;
  }
}
