/**
 * Uygulama içi güvenli yol (açık yönlendirme için `returnUrl` doğrulaması).
 */
export function safeInternalPath(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const p = String(raw).trim();
  if (!p.startsWith("/")) return null;
  if (p.startsWith("//")) return null;
  if (p.includes("://")) return null;
  if (p.includes("\\")) return null;
  return p;
}

export function loginHrefWithReturn(path: string): string {
  const p = safeInternalPath(path) ?? "/";
  return `/login?returnUrl=${encodeURIComponent(p)}`;
}

export function registerHrefWithReturn(path: string): string {
  const p = safeInternalPath(path) ?? "/";
  return `/kayit?returnUrl=${encodeURIComponent(p)}`;
}
