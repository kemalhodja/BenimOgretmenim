import type { Pool, PoolClient } from "pg";
import { pool } from "../db.js";

type Db = Pool | PoolClient;

function netgsmConfigured(): boolean {
  return Boolean(
    process.env.NETGSM_USERCODE?.trim() &&
      process.env.NETGSM_PASSWORD?.trim() &&
      process.env.NETGSM_HEADER?.trim(),
  );
}

async function sendViaNetgsm(
  phone: string,
  body: string,
): Promise<{ ok: true; ref: string } | { ok: false; error: string }> {
  const usercode = process.env.NETGSM_USERCODE!.trim();
  const password = process.env.NETGSM_PASSWORD!.trim();
  const header = process.env.NETGSM_HEADER!.trim();
  const normalized = phone.replace(/\D/g, "");
  if (normalized.length < 10) return { ok: false, error: "invalid_phone" };

  try {
    const params = new URLSearchParams({
      usercode,
      password,
      gsmno: normalized,
      message: body,
      msgheader: header,
    });
    const res = await fetch(`https://api.netgsm.com.tr/sms/send/get?${params.toString()}`);
    const text = (await res.text()).trim();
    if (!res.ok || text.startsWith("2") === false) {
      return { ok: false, error: text.slice(0, 500) || "netgsm_failed" };
    }
    return { ok: true, ref: text };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send_failed" };
  }
}

export async function queueUserSms(
  input: {
    userId: string;
    templateKey: string;
    bodyText: string;
    payload?: Record<string, unknown>;
  },
  client: Db = pool,
): Promise<void> {
  const u = await client.query<{ phone: string | null }>(
    `select phone from users where id = $1`,
    [input.userId],
  );
  const phone = u.rows[0]?.phone?.trim();
  if (!phone) return;

  let outboxId: string | null = null;
  try {
    const ins = await client.query<{ id: string }>(
      `insert into sms_outbox (
         recipient_phone, recipient_user_id, body_text, template_key, payload_jsonb, status
       ) values ($1, $2, $3, $4, $5::jsonb, 'pending')
       returning id`,
      [
        phone,
        input.userId,
        input.bodyText,
        input.templateKey,
        JSON.stringify(input.payload ?? {}),
      ],
    );
    outboxId = ins.rows[0]?.id ?? null;
  } catch {
    if (!netgsmConfigured()) return;
  }

  if (!netgsmConfigured()) {
    if (outboxId) {
      await client.query(
        `update sms_outbox set status = 'skipped', error_message = 'sms_provider_not_configured' where id = $1`,
        [outboxId],
      );
    }
    return;
  }

  const sent = await sendViaNetgsm(phone, input.bodyText);
  if (outboxId) {
    if (sent.ok) {
      await client.query(
        `update sms_outbox
         set status = 'sent', provider = 'netgsm', provider_ref = $2, sent_at = now()
         where id = $1`,
        [outboxId, sent.ref],
      );
    } else {
      await client.query(
        `update sms_outbox set status = 'failed', provider = 'netgsm', error_message = $2 where id = $1`,
        [outboxId, sent.error],
      );
    }
  }
}
