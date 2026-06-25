import type { MiddlewareHandler } from "hono";

/** Render'da www yanlışlıkla API servisinde kaldığında web içeriğini upstream'ten sunar. */
const MISPLACED_WEB_HOSTS = new Set(["www.benimogretmenim.com.tr"]);

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
]);

const APEX_ORIGIN = "https://benimogretmenim.com.tr";
const WWW_ORIGIN = "https://www.benimogretmenim.com.tr";

function upstreamWebOrigin(): string {
  return process.env.WEB_UPSTREAM_ORIGIN?.trim() || "https://benimogretmenim.onrender.com";
}

function shouldProxyToWeb(pathname: string): boolean {
  if (pathname === "/health") return false;
  if (pathname.startsWith("/v1/")) return false;
  return true;
}

function rewriteLocationHeader(value: string): string {
  return value.replaceAll(APEX_ORIGIN, WWW_ORIGIN);
}

export const proxyMisplacedWebHost: MiddlewareHandler = async (c, next) => {
  const host = c.req.header("host")?.split(":")[0] ?? "";
  if (!MISPLACED_WEB_HOSTS.has(host) || !shouldProxyToWeb(c.req.path)) {
    await next();
    return;
  }

  const upstream = new URL(c.req.path, upstreamWebOrigin());
  upstream.search = new URL(c.req.url).search;

  const headers = new Headers();
  for (const [key, value] of c.req.raw.headers.entries()) {
    if (HOP_BY_HOP.has(key.toLowerCase())) continue;
    headers.set(key, value);
  }
  headers.set("x-forwarded-host", host);
  headers.set("x-forwarded-proto", "https");

  const method = c.req.method;
  const body =
    method === "GET" || method === "HEAD" || method === "OPTIONS"
      ? undefined
      : await c.req.raw.clone().arrayBuffer();

  let resp: Response;
  try {
    resp = await fetch(upstream, { method, headers, body, redirect: "manual" });
  } catch (err) {
    console.error("[api:web-proxy] upstream fetch failed", { upstream: upstream.toString(), err });
    return c.text("Web servisi geçici olarak ulaşılamıyor.", 502);
  }

  const outHeaders = new Headers();
  resp.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    if (key.toLowerCase() === "location") {
      outHeaders.set(key, rewriteLocationHeader(value));
      return;
    }
    outHeaders.set(key, value);
  });

  return new Response(resp.body, { status: resp.status, headers: outHeaders });
};
