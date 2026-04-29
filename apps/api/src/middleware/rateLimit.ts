import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import type { AppVariables } from "../types.js";

type RateLimitOptions = {
  /** Logical bucket name (included in key) */
  name: string;
  /** Requests allowed per window */
  limit: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Optional extra key factor (e.g. user agent) */
  keySuffix?: (c: Context<{ Variables: AppVariables }>) => string;
  /** When true, this request does not consume the bucket */
  skip?: (c: Context<{ Variables: AppVariables }>) => boolean;
};

type Bucket = { resetAt: number; count: number };

const buckets = new Map<string, Bucket>();

function nowMs() {
  return Date.now();
}

function clientIp(c: Context<{ Variables: AppVariables }>): string {
  // Render/Cloudflare/Proxies: prefer explicit IP headers.
  const cf = c.req.header("cf-connecting-ip");
  if (cf) return cf.trim();

  const xff = c.req.header("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";

  const xrip = c.req.header("x-real-ip");
  if (xrip) return xrip.trim();

  // Fallback: no reliable socket info in Fetch API here.
  return "unknown";
}

export function rateLimit(opts: RateLimitOptions) {
  return createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
    if (opts.skip?.(c)) {
      await next();
      return;
    }

    const ip = clientIp(c);
    const suffix = opts.keySuffix ? `:${opts.keySuffix(c)}` : "";
    const key = `${opts.name}:${ip}${suffix}`;

    const t = nowMs();
    const existing = buckets.get(key);
    if (!existing || existing.resetAt <= t) {
      buckets.set(key, { resetAt: t + opts.windowMs, count: 1 });
      await next();
      return;
    }

    existing.count += 1;
    buckets.set(key, existing);

    if (existing.count > opts.limit) {
      const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - t) / 1000));
      c.header("retry-after", String(retryAfterSec));
      const requestId = c.get("requestId");
      return c.json(
        { error: "rate_limited", retryAfterSec, ...(requestId ? { requestId } : {}) },
        429,
      );
    }

    await next();
  });
}

