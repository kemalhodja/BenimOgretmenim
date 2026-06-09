"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

type CampaignMessage = {
  id: string;
  sender_role: "student" | "teacher";
  sender_display_name?: string | null;
  body: string;
  created_at: string;
};

type Props = {
  token: string;
  campaignId: string;
  applicationId: string;
};

export function CampaignApplicationChat({ token, campaignId, applicationId }: Props) {
  const [messages, setMessages] = useState<CampaignMessage[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const r = await apiFetch<{ messages: CampaignMessage[] }>(
      `/v1/teacher-campaigns/${campaignId}/applications/${applicationId}/messages`,
      { token },
    );
    setMessages(r.messages);
  }, [applicationId, campaignId, token]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "messages_failed"));
  }, [load]);

  async function send() {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    setError(null);
    try {
      await apiFetch(`/v1/teacher-campaigns/${campaignId}/applications/${applicationId}/messages`, {
        method: "POST",
        token,
        body: JSON.stringify({ body: text }),
      });
      setBody("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "message_send_failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-brand-100 bg-brand-50/40 p-3">
      <div className="text-xs font-semibold text-brand-950">Platform içi kampanya sohbeti</div>
      {error ? <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</div> : null}
      <div className="mt-3 max-h-60 space-y-2 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-xs text-paper-800/60">Henüz mesaj yok.</div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="rounded-lg bg-white p-2 text-xs shadow-sm">
              <div className="font-semibold text-paper-900">
                {message.sender_display_name || (message.sender_role === "teacher" ? "Öğretmen" : "Öğrenci")}
              </div>
              <p className="mt-1 whitespace-pre-wrap leading-relaxed text-paper-800">{message.body}</p>
              <div className="mt-1 text-[11px] text-paper-800/45">
                {new Date(message.created_at).toLocaleString("tr-TR")}
              </div>
            </div>
          ))
        )}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={5000}
        className="mt-3 min-h-20 w-full rounded-xl border border-paper-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
        placeholder="Mesajınızı yazın..."
      />
      <button
        type="button"
        disabled={sending || body.trim().length === 0}
        onClick={() => void send()}
        className="mt-2 rounded-xl bg-brand-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
      >
        {sending ? "Gönderiliyor..." : "Mesaj gönder"}
      </button>
    </div>
  );
}
