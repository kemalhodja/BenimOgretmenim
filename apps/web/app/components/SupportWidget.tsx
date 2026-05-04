"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../lib/api";
import { clearToken, getToken } from "../lib/auth";
import { loginHrefWithReturn } from "../lib/authRedirect";

type SupportMessage = {
  id: string;
  sender: "user" | "staff";
  body: string;
  created_at: string;
};

type MeResponse = {
  thread: {
    id: string;
    context_path: string;
    status: string;
    created_at: string;
    updated_at: string;
  };
  messages: SupportMessage[];
};

export function SupportWidget() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const hidden = pathname.startsWith("/admin");

  useEffect(() => {
    setToken(getToken());
  }, [open, pathname]);

  const pagePath = useMemo(() => pathname.slice(0, 500), [pathname]);

  const refresh = useCallback(async () => {
    const t = getToken();
    if (!t) return;
    setError(null);
    const sp = new URLSearchParams();
    if (pagePath) sp.set("pagePath", pagePath);
    const r = await apiFetch<MeResponse>(`/v1/support/me?${sp.toString()}`, { token: t });
    setMessages(r.messages);
  }, [pagePath]);

  useEffect(() => {
    if (!open || hidden) return;
    const t = getToken();
    if (!t) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await refresh();
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "destek_yüklenemedi";
          if (msg.includes("[401]")) {
            clearToken();
            setToken(null);
            router.replace(loginHrefWithReturn(pathname));
            return;
          }
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, hidden, refresh, router, pathname]);

  useEffect(() => {
    if (!open || hidden || !getToken()) return;
    const id = window.setInterval(() => {
      void refresh().catch(() => {});
    }, 10_000);
    return () => window.clearInterval(id);
  }, [open, hidden, refresh]);

  async function send() {
    const trimmed = text.trim();
    if (!trimmed) return;
    const t = getToken();
    if (!t) return;
    setSending(true);
    setError(null);
    try {
      const r = await apiFetch<MeResponse>("/v1/support/me/messages", {
        method: "POST",
        token: t,
        body: JSON.stringify({ content: trimmed, pagePath }),
      });
      setText("");
      setMessages(r.messages);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "gönderilemedi";
      if (msg.includes("[401]")) {
        clearToken();
        setToken(null);
        router.replace(loginHrefWithReturn(pathname));
        return;
      }
      setError(msg);
    } finally {
      setSending(false);
    }
  }

  if (hidden) return null;

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="support-widget-panel"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-full bg-brand-800 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-brand-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        <span className="hidden sm:inline">Destek</span>
        <span className="sm:hidden" aria-hidden>
          ?
        </span>
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[55] bg-black/30"
            aria-label="Destek panelini kapat"
            onClick={() => setOpen(false)}
          />
          <div
            id="support-widget-panel"
            className="fixed bottom-0 right-0 z-[60] flex max-h-[min(520px,85vh)] w-full max-w-md flex-col rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:bottom-6 sm:right-6 sm:max-h-[min(480px,80vh)] sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-zinc-900">Canlı destek</p>
                <p className="text-xs text-zinc-500">Sayfadan ayrılmadan yazın; ekibimiz yanıtlar.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100"
              >
                Kapat
              </button>
            </div>

            {!token ? (
              <div className="space-y-3 px-4 py-6 text-sm text-zinc-700">
                <p>Destek mesajı göndermek için giriş yapmanız gerekir.</p>
                <Link
                  href={loginHrefWithReturn(pathname)}
                  className="inline-flex rounded-xl bg-brand-800 px-4 py-2 font-medium text-white hover:bg-brand-900"
                >
                  Giriş yap
                </Link>
              </div>
            ) : (
              <>
                {error ? (
                  <div className="mx-4 mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                    {error}
                  </div>
                ) : null}

                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
                  {loading ? (
                    <p className="text-sm text-zinc-500">Yükleniyor…</p>
                  ) : messages.length === 0 ? (
                    <p className="text-sm text-zinc-500">Merhaba! Nasıl yardımcı olabiliriz?</p>
                  ) : (
                    messages.map((m) => (
                      <div
                        key={m.id}
                        className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm ${
                          m.sender === "user"
                            ? "ml-auto bg-brand-50 text-brand-950"
                            : "mr-auto border border-zinc-100 bg-zinc-50 text-zinc-900"
                        }`}
                      >
                        <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                          {m.sender === "user" ? "Siz" : "Destek"}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                        <p className="mt-1 text-[10px] text-zinc-400">
                          {new Date(m.created_at).toLocaleString("tr-TR", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <div className="border-t border-zinc-100 p-3">
                  <div className="flex gap-2">
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      rows={2}
                      maxLength={4000}
                      placeholder="Mesajınız…"
                      className="min-h-[44px] flex-1 resize-none rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                    />
                    <button
                      type="button"
                      disabled={sending || !text.trim()}
                      onClick={() => void send()}
                      className="shrink-0 self-end rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {sending ? "…" : "Gönder"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      ) : null}
    </>
  );
}
