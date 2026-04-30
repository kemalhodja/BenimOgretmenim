/**
 * Web ve NEXT_PUBLIC_API aynı kökte kaldığında (Render’da sık yapılan hata),
 * INTERNAL yoksa veya site ile aynı kökteyse bu repodaki varsayılan API kökünü dene.
 *
 * Bilinmeyen host için Render Web’e şunu ekleyebilirsiniz:
 *   INFER_INTERNAL_API_FALLBACK_URL=https://api-sizin-host.onrender.com
 */
export function inferInternalApiUrlIfNeeded(siteRaw, publicApiRaw, existingInternalRaw) {
  if (existingInternalRaw?.trim()) return null;
  let siteUrl;
  let apiUrl;
  try {
    siteUrl = new URL(siteRaw);
    apiUrl = new URL(publicApiRaw);
  } catch {
    return null;
  }
  if (siteUrl.origin !== apiUrl.origin) return null;

  const forced = process.env.INFER_INTERNAL_API_FALLBACK_URL?.trim();
  if (forced) {
    try {
      return new URL(forced).origin;
    } catch {
      return null;
    }
  }

  if (siteUrl.hostname === "benimogretmenim.onrender.com") {
    return "https://benim-ogretmenim.onrender.com";
  }
  return null;
}
