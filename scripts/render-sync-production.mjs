#!/usr/bin/env node
/**
 * Render prod senkronu (domain + env + deploy tetikleme).
 *
 * Gerekli:
 *   RENDER_API_KEY  — Render Dashboard → Account → API Keys
 *   SMOKE_RUN_SECRET (opsiyonel) — GitHub secret ile aynı değer; admin smoke kaydı
 *
 *   node scripts/render-sync-production.mjs
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const API_BASE = "https://api.render.com/v1";
const TOKEN = process.env.RENDER_API_KEY?.trim();
const API_SERVICE = "benimogretmenim-api";
const WEB_SERVICE = "benimogretmenim-web";
const API_DOMAIN = "api.benimogretmenim.com.tr";
const WEB_DOMAIN = "www.benimogretmenim.com.tr";
const APEX_DOMAIN = "benimogretmenim.com.tr";
const API_ONRENDER = "https://benim-ogretmenim.onrender.com";

if (!TOKEN) {
  console.error("RENDER_API_KEY gerekli.");
  process.exit(1);
}

async function api(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    },
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) throw new Error(`${opts.method ?? "GET"} ${path} → ${res.status}: ${text}`);
  return json;
}

async function listServices() {
  const page = await api("/services?limit=100");
  return (page ?? []).map((row) => row.service).filter(Boolean);
}

async function patchEnvVar(serviceId, key, value) {
  await api(`/services/${serviceId}/env-vars/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: JSON.stringify({ value }),
  });
  console.log(`  env ${key}=${value.length > 60 ? value.slice(0, 57) + "..." : value}`);
}

async function triggerDeploy(serviceId, clearCache = false) {
  await api(`/services/${serviceId}/deploys`, {
    method: "POST",
    body: JSON.stringify({ clearCache }),
  });
  console.log(`  deploy tetiklendi (${serviceId})`);
}

async function main() {
  console.log("[render] Domain sync (render-fix-domains.mjs)...");
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const r = spawnSync(process.execPath, [path.join(scriptDir, "render-fix-domains.mjs")], {
    stdio: "inherit",
    env: process.env,
  });
  if (r.status !== 0) process.exit(r.status ?? 1);

  const services = await listServices();
  const apiSvc = services.find((s) => s.name === API_SERVICE);
  const web = services.find((s) => s.name === WEB_SERVICE);
  if (!apiSvc?.id || !web?.id) throw new Error("API veya Web servisi bulunamadı");

  console.log("[render] API env (operasyon)...");
  await patchEnvVar(apiSvc.id, "HOMEWORK_STORAGE_DIR", "/var/data/homework");
  await patchEnvVar(
    apiSvc.id,
    "HOMEWORK_STORAGE_PUBLIC_BASE",
    `${API_ONRENDER}/v1/homework-media`,
  );
  await patchEnvVar(apiSvc.id, "PUBLIC_WEB_URL", `https://${WEB_DOMAIN}`);
  await patchEnvVar(
    apiSvc.id,
    "CORS_ORIGINS",
    `https://${APEX_DOMAIN},https://${WEB_DOMAIN}`,
  );

  const smokeSecret = process.env.SMOKE_RUN_SECRET?.trim();
  if (smokeSecret) {
    await patchEnvVar(apiSvc.id, "SMOKE_RUN_SECRET", smokeSecret);
  } else {
    console.log("  SMOKE_RUN_SECRET atlandı (env yok)");
  }

  if (process.env.LAUNCH_DNS_VERIFIED?.trim() === "1") {
    await patchEnvVar(apiSvc.id, "LAUNCH_DNS_VERIFIED", "1");
  }

  const playSha = process.env.PLAY_STORE_SHA256?.trim();
  if (playSha) {
    await patchEnvVar(apiSvc.id, "PLAY_STORE_SHA256", playSha);
  }

  console.log("[render] Web env (API kökü — onrender, api custom domain SSL düzelene kadar)...");
  await patchEnvVar(web.id, "NEXT_PUBLIC_API_BASE_URL", API_ONRENDER);
  await patchEnvVar(web.id, "INTERNAL_API_BASE_URL", API_ONRENDER);
  await patchEnvVar(web.id, "NEXT_PUBLIC_SITE_URL", `https://${WEB_DOMAIN}`);

  console.log("[render] Deploy tetikleme...");
  await triggerDeploy(apiSvc.id);
  await triggerDeploy(web.id);

  console.log("");
  console.log("[render] Tamam.");
  console.log("Turhost DNS: api.benimogretmenim.com.tr CNAME → benim-ogretmenim.onrender.com");
  console.log("SSL doğrulandıktan sonra Web env'i api custom domain'e çevirebilirsiniz.");
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
