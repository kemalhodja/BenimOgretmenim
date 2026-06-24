import { NextResponse, type NextRequest } from "next/server";
import {
  resolveCanonicalRedirectOrigin,
  shouldRedirectHostToCanonical,
} from "./app/lib/siteUrl";

const SESSION_COOKIE = "bo_session";
const ROLE_COOKIE = "bo_session_role";
const VALID_ROLES = new Set(["teacher", "student", "guardian", "admin"]);

const PROTECTED_PREFIXES = [
  "/student",
  "/teacher",
  "/guardian",
  "/admin",
  "/panel",
  "/classroom",
  "/mesajlar",
  "/bildirimler",
  "/ayarlar",
  "/hesap-askida",
] as const;

function hasSession(req: NextRequest): boolean {
  if (req.cookies.get(SESSION_COOKIE)?.value) return true;
  const role = req.cookies.get(ROLE_COOKIE)?.value;
  return Boolean(role && VALID_ROLES.has(role));
}

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
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
  const canonical = resolveCanonicalRedirectOrigin();
  const canonicalHost = new URL(canonical).hostname;

  if (shouldRedirectHostToCanonical(host) && host !== canonicalHost) {
    const target = new URL(req.nextUrl.pathname + req.nextUrl.search, canonical);
    return NextResponse.redirect(target, 308);
  }

  const { pathname } = req.nextUrl;
  if (isProtectedPath(pathname) && !hasSession(req)) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = `returnUrl=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(loginUrl);
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
