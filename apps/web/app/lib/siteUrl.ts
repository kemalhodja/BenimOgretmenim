/** Canlı web kökü (DNS + Render custom domain). */
export const PRODUCTION_SITE_ORIGIN = "https://benimogretmenim.com.tr";

/** www alt alanı — proxy ile apex'e yönlendirilir (TWA / assetlinks apex'te kalır). */
export const PRODUCTION_WWW_HOST = "www.benimogretmenim.com.tr";

export const PRODUCTION_SITE_HOST = "benimogretmenim.com.tr";

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
