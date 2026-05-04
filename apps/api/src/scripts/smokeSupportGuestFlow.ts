/**
 * Misafir destek uçları için ortak duman adımları.
 * `022_support_guest_threads` migration uygulanmış olmalı.
 */

export type GuestSupportSmokeResult = { ok: true } | { ok: false; detail: unknown };

export async function runGuestSupportSmokeSteps(opts: {
  base: string;
  adminHeaders: Record<string, string>;
  logPrefix: string;
}): Promise<GuestSupportSmokeResult> {
  const { base, adminHeaders, logPrefix } = opts;
  const guestEmail = `smoke_guest_${Date.now()}@example.com`;

  const guestSess = await fetch(`${base}/v1/support/guest/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: guestEmail, pagePath: "/yardim" }),
  });
  const guestSessBody = (await guestSess.json()) as {
    guestToken?: string;
    thread?: { id?: string };
    messages?: unknown[];
  };
  console.log(`${logPrefix} POST /v1/support/guest/session`, guestSess.status);
  if (!guestSess.ok || !guestSessBody.guestToken || !guestSessBody.thread?.id) {
    return { ok: false, detail: guestSessBody };
  }
  const guestTok = guestSessBody.guestToken;
  const guestThreadId = guestSessBody.thread.id;
  const guestHdr = { "X-Support-Guest-Token": guestTok };

  const guestMe = await fetch(`${base}/v1/support/guest/me?pagePath=%2F`, {
    headers: guestHdr,
  });
  const guestMeBody = (await guestMe.json()) as { thread?: { id?: string }; messages?: unknown[] };
  console.log(`${logPrefix} GET /v1/support/guest/me`, guestMe.status);
  if (!guestMe.ok || guestMeBody.thread?.id !== guestThreadId) {
    return { ok: false, detail: guestMeBody };
  }

  const guestMsg = await fetch(`${base}/v1/support/guest/messages`, {
    method: "POST",
    headers: { ...guestHdr, "content-type": "application/json" },
    body: JSON.stringify({ content: "Smoke: misafir mesajı" }),
  });
  const guestMsgBody = (await guestMsg.json()) as { messages?: { sender?: string }[] };
  console.log(`${logPrefix} POST /v1/support/guest/messages`, guestMsg.status);
  if (!guestMsg.ok || !guestMsgBody.messages?.some((m) => m.sender === "user")) {
    return { ok: false, detail: guestMsgBody };
  }

  const adminThreads = await fetch(`${base}/v1/admin/support-threads?limit=100&offset=0`, {
    headers: adminHeaders,
  });
  const adminThreadsBody = (await adminThreads.json()) as {
    threads?: { id: string; visitor_email?: string | null; user_id?: string | null }[];
  };
  console.log(`${logPrefix} GET /v1/admin/support-threads (misafir satırı)`, adminThreads.status);
  if (!adminThreads.ok) {
    return { ok: false, detail: adminThreadsBody };
  }
  const guestRow = adminThreadsBody.threads?.find((t) => t.id === guestThreadId);
  if (!guestRow || guestRow.user_id != null) {
    return { ok: false, detail: { reason: "guest_row_missing_or_user_id_set", guestRow } };
  }
  if ((guestRow.visitor_email ?? "").toLowerCase() !== guestEmail.toLowerCase()) {
    return { ok: false, detail: { reason: "visitor_email_mismatch", guestRow, guestEmail } };
  }

  return { ok: true };
}
