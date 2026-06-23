import { createMiddleware } from "hono/factory";
import { verifyAccessToken } from "../auth/jwt.js";
import { hasValidCsrfHeader, isUnsafeHttpMethod, readSessionCookie } from "../auth/sessionCookie.js";
import {
  accountStatusBlocksAccess,
  isAccountStatusExemptPath,
  loadUserAccountStatus,
  type UserAccountStatus,
} from "../lib/accountLifecycle.js";

export const requireAuth = createMiddleware(async (c, next) => {
  const header = c.req.header("authorization") ?? "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  const bearerToken = m?.[1]?.trim();
  const cookieToken = bearerToken ? undefined : readSessionCookie(c);
  const token = bearerToken || cookieToken;
  if (!token) {
    return c.json({ error: "missing_auth_token" }, 401);
  }
  const authMethod = bearerToken ? "bearer" : "cookie";
  if (authMethod === "cookie" && isUnsafeHttpMethod(c.req.method) && !hasValidCsrfHeader(c)) {
    return c.json({ error: "csrf_token_required" }, 403);
  }
  try {
    const { userId, role, adminScope } = await verifyAccessToken(token);
    c.set("userId", userId);
    c.set("userRole", role);
    if (role === "admin" && (adminScope === "full" || adminScope === "finance" || adminScope === "support")) {
      c.set("adminScope", adminScope);
    } else if (role === "admin") {
      c.set("adminScope", "full");
    }
    c.set("authMethod", authMethod);

    let account: Awaited<ReturnType<typeof loadUserAccountStatus>> = null;
    try {
      account = await loadUserAccountStatus(userId);
    } catch {
      account = null;
    }
    const accountStatus = (account?.account_status ?? "active") as UserAccountStatus;
    c.set("accountStatus", accountStatus);

    const path = new URL(c.req.url).pathname;
    if (account && accountStatusBlocksAccess(accountStatus) && !isAccountStatusExemptPath(path)) {
      return c.json(
        {
          error: accountStatus === "suspended" ? "account_suspended" : "account_deletion_pending",
          accountStatus,
          suspensionReason: account.suspension_reason,
          deletionReason: account.deletion_reason,
          appealHref: "/itiraz",
          accountSettingsHref: "/ayarlar/hesap",
        },
        403,
      );
    }

    await next();
  } catch {
    return c.json({ error: "invalid_token" }, 401);
  }
});
