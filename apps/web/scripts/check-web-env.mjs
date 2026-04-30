import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inferInternalApiUrlIfNeeded } from "./infer-internal-api-url.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");

function fail(msg) {
  console.error(`[web:env] ${msg}`);
  process.exit(1);
}

const allowHttp = process.env.WEB_ALLOW_HTTP === "1";

const api = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();

if (!api) fail("NEXT_PUBLIC_API_BASE_URL is required for `next build`.");
if (!site) fail("NEXT_PUBLIC_SITE_URL is required for `next build`.");

let apiUrl;
let siteUrl;
try {
  apiUrl = new URL(api);
} catch {
  fail(`NEXT_PUBLIC_API_BASE_URL is not a valid URL: ${api}`);
}
try {
  siteUrl = new URL(site);
} catch {
  fail(`NEXT_PUBLIC_SITE_URL is not a valid URL: ${site}`);
}

if (!allowHttp) {
  if (apiUrl.protocol !== "https:") {
    fail(
      `NEXT_PUBLIC_API_BASE_URL must use https in production builds (got ${apiUrl.protocol}). ` +
        `For local http builds, set WEB_ALLOW_HTTP=1.`,
    );
  }
  if (siteUrl.protocol !== "https:") {
    fail(
      `NEXT_PUBLIC_SITE_URL must use https in production builds (got ${siteUrl.protocol}). ` +
        `For local http builds, set WEB_ALLOW_HTTP=1.`,
    );
  }
}

let internalUrl = null;
const internalRaw = process.env.INTERNAL_API_BASE_URL?.trim();
if (internalRaw) {
  try {
    internalUrl = new URL(internalRaw);
  } catch {
    fail(`INTERNAL_API_BASE_URL is not a valid URL: ${internalRaw}`);
  }
}

let effectiveInternal = internalRaw;

if (!allowHttp && apiUrl.origin === siteUrl.origin) {
  const internalOk = internalUrl && internalUrl.origin !== siteUrl.origin;
  if (!internalOk) {
    const inferred = inferInternalApiUrlIfNeeded(site, api, effectiveInternal);
    if (!inferred) {
      fail(
        "NEXT_PUBLIC_API_BASE_URL ile NEXT_PUBLIC_SITE_URL aynı köke işaret ediyor; " +
          "INTERNAL_API_BASE_URL yok veya site ile aynı. Render Web ortamına gerçek API kökünü " +
          "INTERNAL_API_BASE_URL olarak ekleyin veya NEXT_PUBLIC_API_BASE_URL'i API servis URL'si yapın.",
      );
    }
    console.warn(
      `[web:env] INTERNAL_API_BASE_URL yoktu; bilinen prod eşlemesi kullanılıyor: ${inferred} ` +
        "(Kalıcı çözüm: Render Dashboard'da INTERNAL_API_BASE_URL tanımlayın.)",
    );
    effectiveInternal = inferred;
    internalUrl = new URL(inferred);
  }
}

const buildEnv = { ...process.env };
if (effectiveInternal?.trim()) {
  buildEnv.INTERNAL_API_BASE_URL = effectiveInternal.trim();
}

console.log("[web:env] OK", {
  api: apiUrl.origin,
  site: siteUrl.origin,
  internal: internalUrl?.origin ?? null,
  allowHttp,
});

const isCheckOnly = process.argv.includes("--check-only");
if (isCheckOnly) {
  process.exit(0);
}

const r = spawnSync("npx", ["next", "build"], {
  cwd: webRoot,
  stdio: "inherit",
  env: buildEnv,
  shell: process.platform === "win32",
});

if (r.status !== 0) {
  process.exit(r.status ?? 1);
}
