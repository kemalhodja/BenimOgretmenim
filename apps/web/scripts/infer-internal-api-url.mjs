/**
 * Web ve NEXT_PUBLIC_API aynı kökte kaldığında (Render’da sık yapılan hata),
 * INTERNAL_API_BASE_URL yoksa bu repodaki varsayılan API hostunu dene.
 * Başka domainlerde null döner; o zaman Dashboard’da INTERNAL zorunludur.
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

  if (siteUrl.hostname === "benimogretmenim.onrender.com") {
    return "https://benim-ogretmenim.onrender.com";
  }
  return null;
}
