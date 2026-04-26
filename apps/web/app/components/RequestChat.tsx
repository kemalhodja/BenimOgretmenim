"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../lib/api";
import { clearToken } from "../lib/auth";
import { loginHrefWithReturn } from "../lib/authRedirect";

export type RequestMessage = {
  id: string;
  role: string;
  content: string;
  created_at: string;
  sender_display_name: string | null;
};

type Props = {
  token: string;
  requestId: string;
};

export function RequestChat({ token, requestId }: Props) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [messages, setMessages] = useState<RequestMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    const r = await apiFetch<{ messages: RequestMessage[] }>(
      `/v1/lesson-requests/${requestId}/messages`,
      { token },
    );
    setMessages(r.messages);
  }, [token, requestId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await refresh();
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "messages_failed";
          if (msg.includes("[401]")) {
            clearToken();
            router.replace(loginHrefWithReturn(pathname));
            return;
          }
          setError(
            msg.includes("[403]")
              ? "Bu talepte mesajları görüntüleme izniniz yok."
              : msg,
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh, router, pathname]);

  async function send() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    setError(null);
    try {
      await apiFetch(`/v1/lesson-requests/${requestId}/messages`, {
        method: "POST",
        token,
        body: JSON.stringify({ content: trimmed }),
      });
      setText("");
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "send_failed";
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
        return;
      }
      setError(
        msg.includes("[403]") ? "Bu talebe mesaj gönderme izniniz yok." : msg,
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="mt-10 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-zinc-900">Mesajlar</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Talep sahibi ile teklif veren öğretmen yazışabilir (talep açık veya eşleşmişken).
      </p>

      {error && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 max-h-72 space-y-2 overflow-y-auto rounded-xl border border-zinc-100 bg-zinc-50 p-3">
        {loading ? (
          <div className="text-sm text-zinc-500">Yükleniyor…</div>
        ) : messages.length === 0 ? (
          <div className="text-sm text-zinc-500">Henüz mesaj yok.</div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
              <div className="text-xs text-zinc-500">
                {(m.sender_display_name ?? (m.role === "teacher" ? "Öğretmen" : "Öğrenci")) +
                  " · " +
                  new Date(m.created_at).toLocaleString("tr-TR")}
              </div>
              <div className="mt-1 whitespace-pre-wrap text-zinc-800">{m.content}</div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Mesajınız…"
          className="min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
          maxLength={5000}
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending || !text.trim()}
          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {sending ? "Gönderiliyor…" : "Gönder"}
        </button>
      </div>
    </section>
  );
}
