/** Canlı web kökü (DNS + Render custom domain). */
export const PRODUCTION_SITE_ORIGIN = "https://benimogretmenim.com.tr";

/** Render varsayılan web hostları — artık yönlendirilmez (www proxy köprüsü için doğrudan sunulur). */
export const RENDER_DEFAULT_WEB_HOSTS = new Set([
  "benimogretmenim.onrender.com",
  "benimogretmenim-web.onrender.com",
]);

/** www — Turhost apex→www ile uyumlu birincil host. */
export const PRODUCTION_WWW_HOST = "www.benimogretmenim.com.tr";

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

/** Render *.onrender.com hostlarında yönlendirme yok — API www proxy upstream'i 200 HTML alır. */
export function shouldRedirectHostToCanonical(_host: string): boolean {
  return false;
}
