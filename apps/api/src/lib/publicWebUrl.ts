const DEFAULT_PRODUCTION_WEB = "https://benimogretmenim.com.tr";
const DEFAULT_DEV_WEB = "http://localhost:3000";

function isDisallowedPublicWebHost(hostname: string): boolean {
  return hostname.endsWith(".onrender.com") || hostname === "localhost" || hostname.startsWith("127.");
}

function normalizeOrigin(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (isDisallowedPublicWebHost(url.hostname)) return null;
    return url.origin.replace(/\/$/, "");
  } catch {
    return null;
  }
}

/** Kamuya açık web kökü (API kökünden tarayıcı yönlendirmesi için). Asla *.onrender.com dönmez. */
export function publicWebUrl(): string {
  const explicit = process.env.PUBLIC_WEB_URL?.trim();
  if (explicit) {
    const normalized = normalizeOrigin(explicit);
    if (normalized) return normalized;
  }

  const corsOrigins = process.env.CORS_ORIGINS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (corsOrigins) {
    for (const origin of corsOrigins) {
      const normalized = normalizeOrigin(origin);
      if (normalized) return normalized;
    }
  }

  if (process.env.NODE_ENV === "production") return DEFAULT_PRODUCTION_WEB;
  return DEFAULT_DEV_WEB;
}

export function prefersHtmlResponse(acceptHeader: string | undefined): boolean {
  const accept = (acceptHeader ?? "").toLowerCase();
  if (!accept.includes("text/html")) return false;
  if (accept.includes("application/json") && !accept.includes("text/html")) return false;
  return true;
}
