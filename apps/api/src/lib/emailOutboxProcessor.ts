import { pool } from "../db.js";
import type { EmailOutboxRow } from "./emailDelivery.js";

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

export type EmailOutboxRunResult = {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
};

/** Bekleyen / başarısız outbox kayıtlarını Resend ile gönderir. */
export async function processEmailOutbox(limit = 40): Promise<EmailOutboxRunResult> {
  const result: EmailOutboxRunResult = { processed: 0, sent: 0, failed: 0, skipped: 0 };

  if (!resendConfigured()) {
    const r = await pool
      .query(`update email_outbox set status = 'skipped', error_message = 'email_provider_not_configured' where status = 'pending'`)
      .catch(() => ({ rowCount: 0 }));
    result.skipped = r.rowCount ?? 0;
    return result;
  }

  const pending = await pool
    .query<EmailOutboxRow & { id: string }>(
      `select id, recipient_email, recipient_user_id, subject, body_text
       from email_outbox
       where status in ('pending', 'failed')
       order by created_at asc
       limit $1`,
      [limit],
    )
    .catch(() => ({ rows: [] as Array<EmailOutboxRow & { id: string }> }));

  for (const row of pending.rows) {
    result.processed += 1;
    const sent = await sendViaResend(row);
    if (sent.ok) {
      result.sent += 1;
      await pool.query(
        `update email_outbox
         set status = 'sent', provider = 'resend', provider_ref = $2, sent_at = now(), error_message = null
         where id = $1`,
        [row.id, sent.ref],
      );
    } else {
      result.failed += 1;
      await pool.query(
        `update email_outbox set status = 'failed', provider = 'resend', error_message = $2 where id = $1`,
        [row.id, sent.error],
      );
    }
  }

  return result;
}
