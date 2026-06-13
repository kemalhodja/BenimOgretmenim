import { createMiddleware } from "hono/factory";
import { verifyAccessToken } from "../auth/jwt.js";
import { readSessionCookie } from "../auth/sessionCookie.js";

export const requireAuth = createMiddleware(async (c, next) => {
  const header = c.req.header("authorization") ?? "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  const token = m?.[1]?.trim() || readSessionCookie(c);
  if (!token) {
    return c.json({ error: "missing_auth_token" }, 401);
  }
  try {
    const { userId, role } = await verifyAccessToken(token);
    c.set("userId", userId);
    c.set("userRole", role);
    await next();
  } catch {
    return c.json({ error: "invalid_token" }, 401);
  }
});
