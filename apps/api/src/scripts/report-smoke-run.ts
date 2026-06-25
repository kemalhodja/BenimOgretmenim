/**
 * CI smoke sonucunu admin operational_smoke_runs tablosuna yazar.
 *
 *   SMOKE_RUN_SECRET=... SMOKE_API_URL=... SMOKE_STATUS=ok node dist/scripts/report-smoke-run.js
 */
const base = (process.env.SMOKE_API_URL ?? "http://127.0.0.1:3002").replace(/\/+$/, "");
const secret = process.env.SMOKE_RUN_SECRET?.trim();
const status = process.env.SMOKE_STATUS === "failed" ? "failed" : "ok";

async function main() {
  if (!secret) {
    console.log("[report-smoke-run] SMOKE_RUN_SECRET yok; atlandı.");
    return;
  }
  const payload = {
    status,
    targetUrl: base,
    workflow: process.env.SMOKE_WORKFLOW ?? "ci-smoke",
    runId: process.env.GITHUB_RUN_ID ?? null,
    commitSha: process.env.GITHUB_SHA ?? null,
    details: {
      source: process.env.SMOKE_WORKFLOW ?? "ci-smoke",
      suite: process.env.SMOKE_SUITE ?? "unknown",
      error: process.env.SMOKE_ERROR ?? null,
    },
  };
  const res = await fetch(`${base}/v1/admin/smoke-runs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-smoke-run-secret": secret,
    },
    body: JSON.stringify(payload),
  });
  const body = await res.text();
  if (!res.ok) {
    console.warn(`[report-smoke-run] HTTP ${res.status}`, body.slice(0, 300));
    if (res.status === 503 || res.status === 401) {
      console.warn("[report-smoke-run] Render SMOKE_RUN_SECRET eksik veya eşleşmiyor; CI yine de geçer.");
      return;
    }
    process.exitCode = 1;
    return;
  }
  console.log(`[report-smoke-run] HTTP ${res.status}`, body.slice(0, 300));
}

main().catch((e) => {
  console.error(String(e));
  process.exitCode = 1;
});
