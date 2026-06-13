import type { Context } from "hono";
import type { AppVariables } from "../types.js";

type Ctx = Context<{ Variables: AppVariables }>;

/** Admin uçları prod ortamında ek secret olmadan çalışmaz; dev/test'te opsiyoneldir. */
export function assertAdminApiSecret(c: Ctx): Response | undefined {
  const want = process.env.ADMIN_API_SECRET?.trim();
  if (!want) {
    if (process.env.NODE_ENV === "production") {
      return c.json({ error: "admin_api_secret_required_in_production" }, 503);
    }
    return undefined;
  }
  const got = c.req.header("x-admin-secret")?.trim();
  if (got !== want) {
    return c.json({ error: "forbidden_admin_secret" }, 403);
  }
  return undefined;
}
