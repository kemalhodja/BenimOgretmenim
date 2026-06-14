import { NextResponse } from "next/server";
import { CSRF_HEADER_NAME } from "../../lib/api";
import { makeRequestId } from "../../lib/requestId";

/** Sunucu tarafında Hono API adresi (Docker’da http://api:3002 gibi). */
export function internalApiBase(): string {
  return (
    process.env.INTERNAL_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    "http://127.0.0.1:3002"
  );
}

export function adminProxyHeaders(req: Request): Headers {
  const h = new Headers();
  const auth = req.headers.get("authorization");
  if (auth) h.set("authorization", auth);
  const cookie = req.headers.get("cookie");
  if (cookie) h.set("cookie", cookie);
  const csrf = req.headers.get(CSRF_HEADER_NAME);
  if (csrf) h.set(CSRF_HEADER_NAME, csrf);
  h.set("accept", "application/json");
  const incomingRid = req.headers.get("x-request-id")?.trim();
  h.set("x-request-id", incomingRid && incomingRid.length > 0 ? incomingRid : makeRequestId());
  const secret = process.env.ADMIN_API_SECRET?.trim();
  if (secret) h.set("x-admin-secret", secret);
  return h;
}

export function adminUnauthorizedResponse() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export function hasAdminProxySession(req: Request): boolean {
  const auth = req.headers.get("authorization");
  const cookie = req.headers.get("cookie") ?? "";
  return Boolean(auth?.startsWith("Bearer ") || cookie.includes("bo_session="));
}

export async function proxyAdminRequest(
  req: Request,
  path: string,
  init?: {
    method?: string;
    body?: string | null;
    includeSearch?: boolean;
  },
) {
  if (!hasAdminProxySession(req)) {
    return adminUnauthorizedResponse();
  }

  const source = new URL(req.url);
  const body = init?.body ?? null;
  const headers = adminProxyHeaders(req);
  if (body) headers.set("content-type", req.headers.get("content-type") ?? "application/json");

  const search = init?.includeSearch ? source.search : "";
  const res = await fetch(`${internalApiBase()}${path}${search}`, {
    method: init?.method ?? "GET",
    headers,
    body: body || undefined,
    cache: "no-store",
  });
  const text = await res.text();
  const rid = res.headers.get("x-request-id");
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/json; charset=utf-8",
      ...(rid ? { "x-request-id": rid } : {}),
    },
  });
}
