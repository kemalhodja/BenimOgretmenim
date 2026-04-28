import { randomUUID } from "node:crypto";
import { createMiddleware } from "hono/factory";
import type { AppVariables } from "../types.js";

export const requestId = createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
  const incoming = c.req.header("x-request-id")?.trim();
  const id = incoming && incoming.length <= 128 ? incoming : randomUUID();
  c.set("requestId", id);
  c.header("x-request-id", id);
  await next();
});
