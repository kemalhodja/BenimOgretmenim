/** Canlı web kökü (DNS + Render custom domain). */
export const PRODUCTION_SITE_ORIGIN = "https://benimogretmenim.com.tr";

/** www alt alanı — proxy ile apex'e yönlendirilir (TWA / assetlinks apex'te kalır). */
export const PRODUCTION_WWW_HOST = "www.benimogretmenim.com.tr";

export const PRODUCTION_SITE_HOST = "benimogretmenim.com.tr";

/** Render varsayılan web hostları — proxy bunları .com.tr'ye yönlendirir. */
export const RENDER_DEFAULT_WEB_HOSTS = new Set([
  "benimogretmenim.onrender.com",
  "benimogretmenim-web.onrender.com",
]);

/** Canlı API kökü (api alt alanı). */
export const PRODUCTION_API_ORIGIN = "https://api.benimogretmenim.com.tr";

/** Kamuya açık canonical ve Open Graph için kök URL (sonunda `/` yok). */
export function publicSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000"
  );
}

/** Profil paylaşımı ve iletişim satırları için host (örn. benimogretmenim.com.tr). */
export function publicSiteHost(): string {
  try {
    return new URL(publicSiteUrl()).host;
  } catch {
    return "localhost:3000";
  }
}

/** Host yönlendirmeleri için canonical kök — asla Render *.onrender.com hedefi dönmez. */
export function resolveCanonicalRedirectOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) {
    try {
      const host = new URL(raw).hostname;
      if (!RENDER_DEFAULT_WEB_HOSTS.has(host) && !host.endsWith(".onrender.com")) {
        return new URL(raw).origin;
      }
    } catch {
      // fall through
    }
  }
  return PRODUCTION_SITE_ORIGIN;
}

export function shouldRedirectHostToCanonical(host: string): boolean {
  if (RENDER_DEFAULT_WEB_HOSTS.has(host)) return true;
  return host === PRODUCTION_WWW_HOST;
}
