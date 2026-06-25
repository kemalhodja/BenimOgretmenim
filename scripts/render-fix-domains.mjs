#!/usr/bin/env node
/**
 * Render custom domain düzeltmesi:
 *   - www.benimogretmenim.com.tr → API'den sil
 *   - www + apex → Web servisine ekle
 *
 * Kullanım (Render Dashboard → Account → API Keys):
 *   $env:RENDER_API_KEY="rnd_..."
 *   node scripts/render-fix-domains.mjs
 */
const API_BASE = "https://api.render.com/v1";
const TOKEN = process.env.RENDER_API_KEY?.trim();
const WEB_DOMAIN = "www.benimogretmenim.com.tr";
const APEX_DOMAIN = "benimogretmenim.com.tr";
const API_DOMAIN = "api.benimogretmenim.com.tr";
const WEB_SERVICE = "benimogretmenim-web";
const API_SERVICE = "benimogretmenim-api";

if (!TOKEN) {
  console.error("RENDER_API_KEY gerekli. Render Dashboard → Account Settings → API Keys");
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
  if (!res.ok) {
    throw new Error(`${opts.method ?? "GET"} ${path} → ${res.status}: ${text}`);
  }
  return json;
}

async function listServices() {
  const page = await api("/services?limit=100");
  return (page ?? []).map((row) => row.service).filter(Boolean);
}

async function listCustomDomains(serviceId) {
  const rows = await api(`/services/${serviceId}/custom-domains`);
  return (rows ?? []).map((r) => r.customDomain ?? r);
}

async function deleteCustomDomain(serviceId, domainId) {
  await api(`/services/${serviceId}/custom-domains/${domainId}`, { method: "DELETE" });
}

async function addCustomDomain(serviceId, name) {
  await api(`/services/${serviceId}/custom-domains`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

async function patchEnvVar(serviceId, key, value) {
  await api(`/services/${serviceId}/env-vars/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: JSON.stringify({ value }),
  });
}

async function main() {
  const services = await listServices();
  const web = services.find((s) => s.name === WEB_SERVICE);
  const apiSvc = services.find((s) => s.name === API_SERVICE);
  if (!web?.id || !apiSvc?.id) {
    throw new Error(`Servis bulunamadı. web=${WEB_SERVICE} api=${API_SERVICE}`);
  }

  console.log("[render] API servis domainleri...");
  const apiDomains = await listCustomDomains(apiSvc.id);
  for (const d of apiDomains) {
    const name = d.name ?? d;
    if (name === WEB_DOMAIN) {
      console.log(`  siliniyor: ${name}`);
      await deleteCustomDomain(apiSvc.id, d.id);
    }
  }

  console.log("[render] Web servis domainleri...");
  const webDomains = await listCustomDomains(web.id);
  const webNames = new Set(webDomains.map((d) => d.name ?? d));
  for (const name of [APEX_DOMAIN, WEB_DOMAIN]) {
    if (!webNames.has(name)) {
      console.log(`  ekleniyor: ${name}`);
      await addCustomDomain(web.id, name);
    }
  }

  console.log("[render] Web env...");
  await patchEnvVar(web.id, "NEXT_PUBLIC_SITE_URL", "https://www.benimogretmenim.com.tr");
  await patchEnvVar(web.id, "NEXT_PUBLIC_API_BASE_URL", `https://${API_DOMAIN}`);
  await patchEnvVar(web.id, "INTERNAL_API_BASE_URL", `https://${API_DOMAIN}`);

  console.log("[render] API env...");
  await patchEnvVar(apiSvc.id, "PUBLIC_WEB_URL", `https://${WEB_DOMAIN}`);
  await patchEnvVar(
    apiSvc.id,
    "CORS_ORIGINS",
    `https://${APEX_DOMAIN},https://${WEB_DOMAIN}`,
  );

  console.log("[render] Tamam. Web/API manual deploy tetikleyin veya autoDeploy bekleyin.");
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
