import type { Context } from "hono";

/** Render / proxy önünde istemci IP’si (socket bilgisi yok). */
export function getClientIp(c: Context): string {
  const cf = c.req.header("cf-connecting-ip");
  if (cf) return cf.trim();

  const xff = c.req.header("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";

  const xrip = c.req.header("x-real-ip");
  if (xrip) return xrip.trim();

  return "unknown";
}
