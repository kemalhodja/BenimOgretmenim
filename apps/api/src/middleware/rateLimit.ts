import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { pool } from "../db.js";
import { getClientIp } from "../lib/clientIp.js";
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
const hitsByLimiter = new Map<string, { allowed: number; limited: number }>();

function nowMs() {
  return Date.now();
}

function rateLimitStore(): "memory" | "postgres" {
  const configured = process.env.API_RATE_LIMIT_STORE?.trim().toLowerCase();
  if (configured === "memory" || configured === "postgres") return configured;
  return process.env.NODE_ENV === "production" ? "postgres" : "memory";
}

function recordLimiterHit(name: string, limited: boolean) {
  const stats = hitsByLimiter.get(name) ?? { allowed: 0, limited: 0 };
  if (limited) stats.limited += 1;
  else stats.allowed += 1;
  hitsByLimiter.set(name, stats);
}

async function consumePostgresBucket(opts: {
  key: string;
  name: string;
  windowMs: number;
}): Promise<Bucket> {
  const r = await pool.query<{ hit_count: number; reset_at: Date }>(
    `insert into api_rate_limit_buckets (bucket_key, limiter_name, hit_count, reset_at)
     values ($1, $2, 1, now() + ($3::int * interval '1 millisecond'))
     on conflict (bucket_key) do update
       set hit_count = case
             when api_rate_limit_buckets.reset_at <= now() then 1
             else api_rate_limit_buckets.hit_count + 1
           end,
           reset_at = case
             when api_rate_limit_buckets.reset_at <= now()
               then now() + ($3::int * interval '1 millisecond')
             else api_rate_limit_buckets.reset_at
           end,
           updated_at = now()
     returning hit_count, reset_at`,
    [opts.key, opts.name, opts.windowMs],
  );
  const row = r.rows[0];
  if (!row) throw new Error("rate_limit_bucket_missing");
  return { count: Number(row.hit_count), resetAt: row.reset_at.getTime() };
}

function consumeMemoryBucket(opts: {
  key: string;
  name: string;
  windowMs: number;
}): Bucket {
  const t = nowMs();
  const existing = buckets.get(opts.key);
  if (!existing || existing.resetAt <= t) {
    const next = { resetAt: t + opts.windowMs, count: 1 };
    buckets.set(opts.key, next);
    return next;
  }

  existing.count += 1;
  buckets.set(opts.key, existing);
  return existing;
}

export function rateLimit(opts: RateLimitOptions) {
  return createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
    if (opts.skip?.(c)) {
      await next();
      return;
    }

    const ip = getClientIp(c);
    const suffix = opts.keySuffix ? `:${opts.keySuffix(c)}` : "";
    const key = `${opts.name}:${ip}${suffix}`;

    let bucket: Bucket;
    try {
      bucket =
        rateLimitStore() === "postgres"
          ? await consumePostgresBucket({ key, name: opts.name, windowMs: opts.windowMs })
          : consumeMemoryBucket({ key, name: opts.name, windowMs: opts.windowMs });
    } catch (e) {
      const requestId = c.get("requestId");
      console.error("[rate-limit] store unavailable", {
        name: opts.name,
        store: rateLimitStore(),
        error: e instanceof Error ? e.message : String(e),
        ...(requestId ? { requestId } : {}),
      });
      return c.json(
        { error: "rate_limit_unavailable", ...(requestId ? { requestId } : {}) },
        503,
      );
    }

    if (bucket.count > opts.limit) {
      recordLimiterHit(opts.name, true);
      const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - nowMs()) / 1000));
      c.header("retry-after", String(retryAfterSec));
      const requestId = c.get("requestId");
      return c.json(
        { error: "rate_limited", retryAfterSec, ...(requestId ? { requestId } : {}) },
        429,
      );
    }

    recordLimiterHit(opts.name, false);
    await next();
  });
}

export function rateLimitSnapshot() {
  return {
    store: rateLimitStore(),
    activeBuckets: buckets.size,
    limiters: [...hitsByLimiter.entries()].map(([name, stats]) => ({ name, ...stats })),
  };
}

