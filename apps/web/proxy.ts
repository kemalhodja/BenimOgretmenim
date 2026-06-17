import { NextResponse, type NextRequest } from "next/server";
import { PRODUCTION_SITE_ORIGIN } from "./app/lib/siteUrl";

const LEGACY_WEB_HOSTS = new Set(["benimogretmenim.onrender.com"]);
const WWW_HOST = "www.benimogretmenim.com.tr";

function canonicalSiteOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || PRODUCTION_SITE_ORIGIN;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

function makeRequestId(): string {
  const c = globalThis.crypto;
  if (c && "randomUUID" in c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  return `rid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function proxy(req: NextRequest) {
  const host = req.headers.get("host")?.split(":")[0] ?? "";
  const canonical = canonicalSiteOrigin();

  if (canonical) {
    const canonicalHost = new URL(canonical).hostname;
    const shouldRedirectLegacy = LEGACY_WEB_HOSTS.has(host);
    const shouldRedirectWww = host === WWW_HOST && canonicalHost === "benimogretmenim.com.tr";
    if (shouldRedirectLegacy || shouldRedirectWww) {
      const target = new URL(req.nextUrl.pathname + req.nextUrl.search, canonical);
      return NextResponse.redirect(target, 308);
    }
  }

  const res = NextResponse.next();
  const incoming = req.headers.get("x-request-id")?.trim();
  const id = incoming && incoming.length > 0 ? incoming : makeRequestId();
  res.headers.set("x-request-id", id);
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|sw.js|\\.well-known|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
