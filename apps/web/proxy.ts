import { NextResponse, type NextRequest } from "next/server";

function makeRequestId(): string {
  const c = globalThis.crypto;
  if (c && "randomUUID" in c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  return `rid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function proxy(req: NextRequest) {
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
