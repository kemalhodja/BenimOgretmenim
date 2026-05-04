import type { Context } from "hono";
import type { AppVariables } from "../types.js";
import { assertAdminApiSecret } from "./adminSecret.js";

export type AdminCtx = Context<{ Variables: AppVariables }>;

export function assertAdminGate(c: AdminCtx): Response | undefined {
  const role = c.get("userRole");
  if (role !== "admin") {
    return c.json({ error: "forbidden_admin_only" }, 403);
  }
  return assertAdminApiSecret(c);
}
