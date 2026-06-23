const DEFAULT_PRODUCTION_WEB = "https://benimogretmenim.com.tr";
const DEFAULT_DEV_WEB = "http://localhost:3000";

/** Kamuya açık web kökü (API kökünden tarayıcı yönlendirmesi için). */
export function publicWebUrl(): string {
  const explicit = process.env.PUBLIC_WEB_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const corsFirst = process.env.CORS_ORIGINS?.split(",")
    .map((s) => s.trim())
    .find(Boolean);
  if (corsFirst) return corsFirst.replace(/\/$/, "");

  if (process.env.NODE_ENV === "production") return DEFAULT_PRODUCTION_WEB;
  return DEFAULT_DEV_WEB;
}

export function prefersHtmlResponse(acceptHeader: string | undefined): boolean {
  const accept = (acceptHeader ?? "").toLowerCase();
  if (!accept.includes("text/html")) return false;
  if (accept.includes("application/json") && !accept.includes("text/html")) return false;
  return true;
}
