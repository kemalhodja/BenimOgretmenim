import { createMiddleware } from "hono/factory";
import { verifyAccessToken } from "../auth/jwt.js";

export const requireAuth = createMiddleware(async (c, next) => {
  const header = c.req.header("authorization") ?? "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m?.[1]) {
    return c.json({ error: "missing_bearer_token" }, 401);
  }
  try {
    const { userId, role } = await verifyAccessToken(m[1].trim());
    c.set("userId", userId);
    c.set("userRole", role);
    await next();
  } catch {
    return c.json({ error: "invalid_token" }, 401);
  }
});
