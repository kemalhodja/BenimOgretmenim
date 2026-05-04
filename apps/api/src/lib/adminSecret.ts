import type { Context } from "hono";
import type { AppVariables } from "../types.js";

type Ctx = Context<{ Variables: AppVariables }>;

/** Üretimde ADMIN_API_SECRET tanımlıysa admin uçları ek başlık ister. */
export function assertAdminApiSecret(c: Ctx): Response | undefined {
  const want = process.env.ADMIN_API_SECRET?.trim();
  if (!want) return undefined;
  const got = c.req.header("x-admin-secret")?.trim();
  if (got !== want) {
    return c.json({ error: "forbidden_admin_secret" }, 403);
  }
  return undefined;
}
