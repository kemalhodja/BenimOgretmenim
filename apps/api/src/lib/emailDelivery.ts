import type { Pool, PoolClient } from "pg";
import { pool } from "../db.js";

type Db = Pool | PoolClient;

export type EmailOutboxRow = {
  id: string;
  recipient_email: string;
  recipient_user_id: string | null;
  subject: string;
  body_text: string;
};

function resendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

async function sendViaResend(row: EmailOutboxRow): Promise<{ ok: true; ref: string } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY!.trim();
  const from = process.env.EMAIL_FROM!.trim();
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [row.recipient_email],
        subject: row.subject,
        text: row.body_text,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: text.slice(0, 500) };
    }
    const payload = (await res.json()) as { id?: string };
    return { ok: true, ref: payload.id ?? "resend" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send_failed" };
  }
}

export async function queueUserEmail(
  input: {
    userId: string;
    templateKey: string;
    subject: string;
    bodyText: string;
    payload?: Record<string, unknown>;
  },
  client: Db = pool,
): Promise<void> {
  const u = await client.query<{ email: string }>(`select email from users where id = $1`, [input.userId]);
  const email = u.rows[0]?.email?.trim();
  if (!email) return;

  let outboxId: string | null = null;
  try {
    const ins = await client.query<{ id: string }>(
      `insert into email_outbox (
         recipient_email, recipient_user_id, subject, body_text, template_key, payload_jsonb, status
       ) values ($1, $2, $3, $4, $5, $6::jsonb, 'pending')
       returning id`,
      [
        email,
        input.userId,
        input.subject,
        input.bodyText,
        input.templateKey,
        JSON.stringify(input.payload ?? {}),
      ],
    );
    outboxId = ins.rows[0]?.id ?? null;
  } catch {
    if (!resendConfigured()) return;
  }

  if (!resendConfigured()) {
    if (outboxId) {
      await client.query(
        `update email_outbox set status = 'skipped', error_message = 'email_provider_not_configured' where id = $1`,
        [outboxId],
      );
    }
    return;
  }

  const sent = await sendViaResend({
    id: outboxId ?? "direct",
    recipient_email: email,
    recipient_user_id: input.userId,
    subject: input.subject,
    body_text: input.bodyText,
  });

  if (outboxId) {
    if (sent.ok) {
      await client.query(
        `update email_outbox
         set status = 'sent', provider = 'resend', provider_ref = $2, sent_at = now()
         where id = $1`,
        [outboxId, sent.ref],
      );
    } else {
      await client.query(
        `update email_outbox set status = 'failed', provider = 'resend', error_message = $2 where id = $1`,
        [outboxId, sent.error],
      );
    }
  }
}

export async function queueGuardianEmail(
  input: {
    guardianUserId: string;
    templateKey: string;
    subject: string;
    bodyText: string;
    payload?: Record<string, unknown>;
  },
  client: Db = pool,
): Promise<void> {
  const u = await client.query<{ email: string }>(`select email from users where id = $1`, [input.guardianUserId]);
  const email = u.rows[0]?.email?.trim();
  if (!email) return;

  const prefs = await client.query<{ homework_enabled: boolean; lesson_enabled: boolean; payment_enabled: boolean }>(
    `select homework_enabled, lesson_enabled, payment_enabled
     from guardian_email_preferences
     where guardian_user_id = $1`,
    [input.guardianUserId],
  ).catch(() => ({ rows: [] as Array<{ homework_enabled: boolean; lesson_enabled: boolean; payment_enabled: boolean }> }));

  const p = prefs.rows[0];
  const key = input.templateKey;
  if (p) {
    if (key.startsWith("homework_") && !p.homework_enabled) return;
    if (key.startsWith("lesson_") && !p.lesson_enabled) return;
    if (key.startsWith("payment_") && !p.payment_enabled) return;
  }

  let outboxId: string | null = null;
  try {
    const ins = await client.query<{ id: string }>(
      `insert into email_outbox (
         recipient_email, recipient_user_id, subject, body_text, template_key, payload_jsonb, status
       ) values ($1, $2, $3, $4, $5, $6::jsonb, 'pending')
       returning id`,
      [
        email,
        input.guardianUserId,
        input.subject,
        input.bodyText,
        input.templateKey,
        JSON.stringify(input.payload ?? {}),
      ],
    );
    outboxId = ins.rows[0]?.id ?? null;
  } catch {
    if (!resendConfigured()) return;
  }

  if (!resendConfigured()) {
    if (outboxId) {
      await client.query(
        `update email_outbox set status = 'skipped', error_message = 'email_provider_not_configured' where id = $1`,
        [outboxId],
      );
    }
    return;
  }

  const sent = await sendViaResend({
    id: outboxId ?? "direct",
    recipient_email: email,
    recipient_user_id: input.guardianUserId,
    subject: input.subject,
    body_text: input.bodyText,
  });

  if (outboxId) {
    if (sent.ok) {
      await client.query(
        `update email_outbox
         set status = 'sent', provider = 'resend', provider_ref = $2, sent_at = now()
         where id = $1`,
        [outboxId, sent.ref],
      );
    } else {
      await client.query(
        `update email_outbox set status = 'failed', provider = 'resend', error_message = $2 where id = $1`,
        [outboxId, sent.error],
      );
    }
  }
}
