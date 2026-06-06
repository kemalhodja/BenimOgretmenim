import crypto from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import { pool } from "../db.js";
import { verifyAccessToken } from "../auth/jwt.js";
import type { AppVariables } from "../types.js";

const eventSchema = z.object({
  eventName: z.enum([
    "teacher_search",
    "teacher_profile_view",
    "teacher_shortlist",
    "demo_request_start",
    "lesson_request_created",
    "registration_completed",
    "payment_checkout_start",
    "campaign_application_created",
    "homework_post_created",
    "student_subscription_purchase_start",
  ]),
  entityType: z.string().trim().max(80).optional().nullable(),
  entityId: z.string().trim().max(160).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

async function bearerUserId(authHeader: string | undefined): Promise<string | null> {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  if (!token) return null;
  try {
    return (await verifyAccessToken(token)).userId;
  } catch {
    return null;
  }
}

function ipHash(raw: string | undefined): string | null {
  const value = raw?.split(",")[0]?.trim();
  if (!value) return null;
  return crypto.createHash("sha256").update(value).digest("hex");
}

export const analytics = new Hono<{ Variables: AppVariables }>();

analytics.post("/events", async (c) => {
  const parsed = eventSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const userId = await bearerUserId(c.req.header("authorization"));
  const requestId = c.req.header("x-request-id") ?? c.get("requestId") ?? null;
  await pool.query(
    `insert into funnel_events (
       user_id, event_name, entity_type, entity_id, request_id, user_agent, ip_hash, metadata_jsonb
     ) values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [
      userId,
      parsed.data.eventName,
      parsed.data.entityType ?? null,
      parsed.data.entityId ?? null,
      requestId,
      c.req.header("user-agent") ?? null,
      ipHash(c.req.header("x-forwarded-for") ?? c.req.header("cf-connecting-ip")),
      JSON.stringify(parsed.data.metadata ?? {}),
    ],
  );

  return c.json({ ok: true }, 202);
});
