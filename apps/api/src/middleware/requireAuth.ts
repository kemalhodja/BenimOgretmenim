import { createMiddleware } from "hono/factory";
import { verifyAccessToken } from "../auth/jwt.js";
import { hasValidCsrfHeader, isUnsafeHttpMethod, readSessionCookie } from "../auth/sessionCookie.js";

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
    const { userId, role } = await verifyAccessToken(token);
    c.set("userId", userId);
    c.set("userRole", role);
    c.set("authMethod", authMethod);
    await next();
  } catch {
    return c.json({ error: "invalid_token" }, 401);
  }
});
