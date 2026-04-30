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

if (!allowHttp && apiUrl.origin === siteUrl.origin) {
  const internalOk = internalUrl && internalUrl.origin !== siteUrl.origin;
  if (!internalOk) {
    fail(
      "NEXT_PUBLIC_API_BASE_URL ile NEXT_PUBLIC_SITE_URL aynı köke işaret ediyor; " +
        "tarayıcıdaki /v1 istekleri Next.js 404 HTML döner. Çözüm: API için ayrı kök kullanın " +
        "(ör. Render API servis URL'si) veya INTERNAL_API_BASE_URL'i gerçek API köküne ayarlayıp yeniden derleyin.",
    );
  }
}

console.log("[web:env] OK", {
  api: apiUrl.origin,
  site: siteUrl.origin,
  internal: internalUrl?.origin ?? null,
  allowHttp,
});
