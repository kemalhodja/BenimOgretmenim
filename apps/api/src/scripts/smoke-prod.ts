/**
 * Production-safe smoke: only read-only public checks.
 *
 * Usage:
 *   SMOKE_API_URL=https://your-api.example.com npm run -s smoke:prod
 */
const defaultPort = process.env.PORT ?? "3002";
const base = (process.env.SMOKE_API_URL ?? `http://127.0.0.1:${defaultPort}`).replace(/\/+$/, "");

type Json = Record<string, unknown>;

async function getJson(path: string): Promise<{ status: number; ok: boolean; json: Json }> {
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      headers: { accept: "application/json" },
    });
  } catch (e) {
    throw new Error(
      `[smoke:prod] ${path} isteği başarısız. API ayakta mı? SMOKE_API_URL doğru mu? Hata: ${String(e)}`,
    );
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `[smoke:prod] ${path} JSON değil (status=${res.status}, content-type=${contentType}). İlk 200 karakter: ${body.slice(0, 200)}`,
    );
  }

  const json = (await res.json().catch((e) => {
    throw new Error(`[smoke:prod] ${path} JSON parse edilemedi: ${String(e)}`);
  })) as Json;

  return { status: res.status, ok: res.ok, json };
}

async function main() {
  const health = await getJson("/health");
  console.log("[smoke:prod] GET /health", health.status, health.json);
  if (!health.ok) process.exitCode = 1;
  if (health.json.db !== true) {
    console.error("[smoke:prod] db !== true; migration / DATABASE_URL / network kontrol edin.");
    process.exitCode = 1;
  }

  const branches = await getJson("/v1/meta/branches");
  console.log("[smoke:prod] GET /v1/meta/branches", branches.status);
  if (!branches.ok) process.exitCode = 1;

  const cities = await getJson("/v1/meta/cities");
  console.log("[smoke:prod] GET /v1/meta/cities", cities.status);
  if (!cities.ok) process.exitCode = 1;

  const teachers = await getJson("/v1/teachers?limit=1");
  console.log("[smoke:prod] GET /v1/teachers?limit=1", teachers.status);
  if (!teachers.ok) process.exitCode = 1;

  if (process.exitCode) {
    console.error("[smoke:prod] FAIL");
  } else {
    console.log("[smoke:prod] OK");
  }
}

main().catch((e) => {
  console.error(String(e));
  process.exitCode = 1;
});

