import type { Context } from "hono";
import type { AdminScope, AppVariables } from "../types.js";
import { pool } from "../db.js";
import { assertAdminApiSecret } from "./adminSecret.js";

export type AdminCtx = Context<{ Variables: AppVariables }>;

export function assertAdminGate(c: AdminCtx): Response | undefined {
  const role = c.get("userRole");
  if (role !== "admin") {
    return c.json({ error: "forbidden_admin_only" }, 403);
  }
  return assertAdminApiSecret(c);
}

export function getAdminScope(c: AdminCtx): AdminScope {
  const scope = c.get("adminScope");
  if (scope === "finance" || scope === "support") return scope;
  return "full";
}

async function syncAdminScopeFromDb(c: AdminCtx): Promise<AdminScope> {
  try {
    const r = await pool.query<{ admin_scope: string }>(
      `select admin_scope::text as admin_scope
       from users
       where id = $1 and role = 'admin'::user_role`,
      [c.get("userId")],
    );
    const scope = r.rows[0]?.admin_scope;
    if (scope === "finance" || scope === "support" || scope === "full") {
      c.set("adminScope", scope);
      return scope;
    }
  } catch {
    // migration öncesi veya geçici DB hatası — JWT fallback
  }
  const fallback = getAdminScope(c);
  c.set("adminScope", fallback);
  return fallback;
}

/** Belirtilen kapsamlardan biri değilse 403 döner. Kapsam DB ile doğrulanır (JWT bayat olabilir). */
export async function assertAdminScope(c: AdminCtx, allowed: AdminScope[]): Promise<Response | undefined> {
  const denied = assertAdminGate(c);
  if (denied) return denied;
  const scope = await syncAdminScopeFromDb(c);
  if (scope === "full" || allowed.includes(scope)) return undefined;
  return c.json({ error: "forbidden_admin_scope", requiredScope: allowed }, 403);
}

export async function assertAdminFinanceScope(c: AdminCtx): Promise<Response | undefined> {
  return assertAdminScope(c, ["full", "finance"]);
}

export async function assertAdminSupportScope(c: AdminCtx): Promise<Response | undefined> {
  return assertAdminScope(c, ["full", "support"]);
}
