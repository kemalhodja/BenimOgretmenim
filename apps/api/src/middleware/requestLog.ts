import { createMiddleware } from "hono/factory";
import { getClientIp } from "../lib/clientIp.js";
import type { AppVariables } from "../types.js";

function requestLogEnabled(): boolean {
  if (process.env.VITEST === "true" || process.env.NODE_ENV === "test") return false;
  if (process.env.API_REQUEST_LOG?.trim() === "0") return false;
  if (process.env.API_REQUEST_LOG?.trim() === "1") return true;
  return process.env.NODE_ENV === "production";
}

/** Tek satır JSON — Render / log agregatörleri için. */
export const requestLog = createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
  if (!requestLogEnabled()) {
    await next();
    return;
  }

  const t0 = Date.now();
  await next();
  const ms = Date.now() - t0;
  const path = c.req.path;
  const method = c.req.method;
  const status = c.res.status;
  if (path === "/health" && method === "GET" && status === 200) return;

  const requestId = c.get("requestId");
  const ip = getClientIp(c);
  console.log(
    JSON.stringify({
      level: "info",
      msg: "http",
      ...(requestId ? { requestId } : {}),
      method,
      path,
      status,
      ms,
      ip,
    }),
  );
});
