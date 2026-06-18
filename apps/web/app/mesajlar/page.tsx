"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../lib/api";
import { clearToken, getToken } from "../lib/auth";
import { loginHrefWithReturn } from "../lib/authRedirect";
import { StudentPanelHeader } from "../components/StudentPanelHeader";

type Thread = {
  id: string;
  kind: string;
  subject: string | null;
  last_message_at: string | null;
  counterpart_display_name: string | null;
  last_body_preview: string | null;
  unread_count: number;
};

type Message = {
  id: string;
  body_text: string;
  created_at: string;
  sender_display_name: string;
  is_mine: boolean;
};

export default function MesajlarPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [router, pathname]);

  const loadThreads = useCallback(async () => {
    if (!token) return;
    const r = await apiFetch<{ threads: Thread[] }>("/v1/messages/threads", { token });
    setThreads(r.threads);
    if (!activeId && r.threads[0]?.id) setActiveId(r.threads[0].id);
  }, [token, activeId]);

  const loadMessages = useCallback(
    async (threadId: string) => {
      if (!token) return;
      const r = await apiFetch<{ messages: Message[] }>(`/v1/messages/threads/${threadId}`, { token });
      setMessages(r.messages);
    },
    [token],
  );

  useEffect(() => {
    loadThreads().catch((e) => {
      const msg = e instanceof Error ? e.message : "load_failed";
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
        return;
      }
      setError(msg);
    });
  }, [loadThreads, router, pathname]);

  useEffect(() => {
    if (!activeId || !token) return;
    loadMessages(activeId).catch((e) => setError(e instanceof Error ? e.message : "messages_failed"));
  }, [activeId, token, loadMessages]);

  async function sendMessage() {
    if (!token || !activeId || !draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/v1/messages/threads/${activeId}/messages`, {
        method: "POST",
        token,
        body: JSON.stringify({ bodyText: draft.trim() }),
      });
      setDraft("");
      await Promise.all([loadMessages(activeId), loadThreads()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "send_failed");
    } finally {
      setBusy(false);
    }
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-paper-50">
      <StudentPanelHeader />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold text-paper-900">Mesajlar</h1>
        <p className="mt-1 text-sm text-paper-800/70">
          Doğrudan ders anlaşmaları ve öğretmen iletişimi tek yerde.
        </p>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        ) : null}

        <div className="mt-6 grid gap-4 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-2xl border border-paper-200 bg-white p-3 shadow-sm">
            <h2 className="px-2 text-xs font-semibold uppercase tracking-wide text-paper-800/55">Konuşmalar</h2>
            <ul className="mt-2 space-y-1">
              {threads.length === 0 ? (
                <li className="px-2 py-3 text-sm text-paper-800/55">
                  Henüz mesaj yok. Doğrudan ders ödemesi sonrası thread açılır.
                </li>
              ) : (
                threads.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(t.id)}
                      className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
                        activeId === t.id ? "bg-brand-50 text-brand-900" : "hover:bg-paper-50"
                      }`}
                    >
                      <div className="font-medium text-paper-900">
                        {t.counterpart_display_name ?? t.subject ?? "Konuşma"}
                        {t.unread_count > 0 ? (
                          <span className="ml-2 rounded-full bg-brand-800 px-1.5 py-0.5 text-[10px] text-white">
                            {t.unread_count}
                          </span>
                        ) : null}
                      </div>
                      {t.last_body_preview ? (
                        <div className="mt-0.5 truncate text-xs text-paper-800/60">{t.last_body_preview}</div>
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </aside>

          <section className="flex min-h-[420px] flex-col rounded-2xl border border-paper-200 bg-white shadow-sm">
            {activeId ? (
              <>
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                        m.is_mine ? "ml-auto bg-brand-800 text-white" : "bg-paper-50 text-paper-900"
                      }`}
                    >
                      <div className="text-[10px] opacity-70">{m.sender_display_name}</div>
                      <div className="mt-0.5 whitespace-pre-wrap">{m.body_text}</div>
                      <div className="mt-1 text-[10px] opacity-60">
                        {new Date(m.created_at).toLocaleString("tr-TR")}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-paper-100 p-3">
                  <div className="flex gap-2">
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      className="min-w-0 flex-1 rounded-xl border border-paper-200 px-3 py-2 text-sm"
                      placeholder="Mesaj yazın…"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void sendMessage();
                        }
                      }}
                    />
                    <button
                      type="button"
                      disabled={busy || !draft.trim()}
                      onClick={() => void sendMessage()}
                      className="rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Gönder
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-8 text-sm text-paper-800/55">
                Bir konuşma seçin veya doğrudan ders ödemesi yapın.
              </div>
            )}
          </section>
        </div>

        <div className="mt-4 text-sm">
          <Link href="/student/panel" className="text-brand-800 underline">
            Öğrenci paneline dön
          </Link>
        </div>
      </div>
    </div>
  );
}
