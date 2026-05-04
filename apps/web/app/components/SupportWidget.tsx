"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../lib/api";
import { clearToken, getToken } from "../lib/auth";
import { loginHrefWithReturn } from "../lib/authRedirect";

const GUEST_TOKEN_KEY = "benimog_support_guest_token_v1";

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

type GuestSessionResponse = {
  guestToken: string;
  thread: MeResponse["thread"];
  visitorEmail: string;
  messages: SupportMessage[];
};

type GuestMeResponse = {
  thread: MeResponse["thread"];
  visitorEmail: string;
  messages: SupportMessage[];
};

function readGuestToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(GUEST_TOKEN_KEY)?.trim();
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

function writeGuestToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) localStorage.setItem(GUEST_TOKEN_KEY, token);
    else localStorage.removeItem(GUEST_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function SupportWidget() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [guestEmail, setGuestEmail] = useState("");
  const [guestBootstrapping, setGuestBootstrapping] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const hidden = pathname.startsWith("/admin");

  useEffect(() => {
    const a = getToken();
    setAuthToken(a);
    if (a) {
      writeGuestToken(null);
      setGuestToken(null);
    } else {
      setGuestToken(readGuestToken());
    }
  }, [open, pathname]);

  const pagePath = useMemo(() => pathname.slice(0, 500), [pathname]);

  const refreshAuth = useCallback(async () => {
    const t = getToken();
    if (!t) return;
    setError(null);
    const sp = new URLSearchParams();
    if (pagePath) sp.set("pagePath", pagePath);
    const r = await apiFetch<MeResponse>(`/v1/support/me?${sp.toString()}`, { token: t });
    setMessages(r.messages);
  }, [pagePath]);

  const refreshGuest = useCallback(async () => {
    const g = readGuestToken();
    if (!g) return;
    setError(null);
    const sp = new URLSearchParams();
    if (pagePath) sp.set("pagePath", pagePath);
    const r = await apiFetch<GuestMeResponse>(`/v1/support/guest/me?${sp.toString()}`, {
      supportGuestToken: g,
    });
    setMessages(r.messages);
  }, [pagePath]);

  const refresh = useCallback(async () => {
    if (getToken()) await refreshAuth();
    else if (readGuestToken()) await refreshGuest();
  }, [refreshAuth, refreshGuest]);

  useEffect(() => {
    if (!open || hidden) return;
    const hasAuth = !!getToken();
    const hasGuest = !!readGuestToken();
    if (!hasAuth && !hasGuest) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await refresh();
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "destek_yüklenemedi";
          if (msg.includes("[401]")) {
            if (hasAuth) {
              clearToken();
              setAuthToken(null);
              router.replace(loginHrefWithReturn(pathname));
              return;
            }
            writeGuestToken(null);
            setGuestToken(null);
            setError("Misafir oturumu süresi doldu veya geçersiz. E-postanızla yeniden başlayın.");
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
    if (!open || hidden) return;
    if (!getToken() && !readGuestToken()) return;
    const id = window.setInterval(() => {
      void refresh().catch(() => {});
    }, 10_000);
    return () => window.clearInterval(id);
  }, [open, hidden, refresh]);

  async function startGuestSession() {
    const email = guestEmail.trim();
    if (!email) return;
    setGuestBootstrapping(true);
    setError(null);
    try {
      const r = await apiFetch<GuestSessionResponse>("/v1/support/guest/session", {
        method: "POST",
        body: JSON.stringify({ email, pagePath }),
      });
      writeGuestToken(r.guestToken);
      setGuestToken(r.guestToken);
      setMessages(r.messages);
      setGuestEmail("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "başlatılamadı");
    } finally {
      setGuestBootstrapping(false);
    }
  }

  async function send() {
    const trimmed = text.trim();
    if (!trimmed) return;
    const t = getToken();
    const g = readGuestToken();
    setSending(true);
    setError(null);
    try {
      if (t) {
        const r = await apiFetch<MeResponse>("/v1/support/me/messages", {
          method: "POST",
          token: t,
          body: JSON.stringify({ content: trimmed, pagePath }),
        });
        setText("");
        setMessages(r.messages);
      } else if (g) {
        const r = await apiFetch<GuestMeResponse>("/v1/support/guest/messages", {
          method: "POST",
          supportGuestToken: g,
          body: JSON.stringify({ content: trimmed, pagePath }),
        });
        setText("");
        setMessages(r.messages);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "gönderilemedi";
      if (msg.includes("[401]")) {
        if (t) {
          clearToken();
          setAuthToken(null);
          router.replace(loginHrefWithReturn(pathname));
          return;
        }
        writeGuestToken(null);
        setGuestToken(null);
        setError("Misafir oturumu geçersiz. Lütfen e-postanızla yeniden başlayın.");
        return;
      }
      setError(msg);
    } finally {
      setSending(false);
    }
  }

  function clearGuest() {
    writeGuestToken(null);
    setGuestToken(null);
    setMessages([]);
  }

  if (hidden) return null;

  const loggedIn = !!authToken;
  const guestActive = !loggedIn && !!guestToken;

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

            {!loggedIn && !guestActive ? (
              <div className="space-y-4 px-4 py-6 text-sm text-zinc-700">
                <p className="font-medium text-zinc-900">Nasıl devam etmek istersiniz?</p>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-xs text-zinc-600">Hesabınız varsa giriş yapın (taleplerinizle ilişkilendirilir).</p>
                  <Link
                    href={loginHrefWithReturn(pathname)}
                    className="mt-2 inline-flex rounded-xl bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
                  >
                    Giriş yap
                  </Link>
                </div>
                <div className="rounded-xl border border-zinc-200 p-3">
                  <p className="text-xs text-zinc-600">Misafir olarak e-postanızı verin; aynı tarayıcıda konuşmaya devam edebilirsiniz.</p>
                  <label className="mt-2 block text-xs font-medium text-zinc-700">E-posta</label>
                  <input
                    type="email"
                    autoComplete="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="ornek@posta.com"
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={guestBootstrapping || !guestEmail.includes("@")}
                    onClick={() => void startGuestSession()}
                    className="mt-3 w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {guestBootstrapping ? "Başlatılıyor…" : "Misafir olarak devam et"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {guestActive ? (
                  <div className="flex items-center justify-between border-b border-zinc-50 px-4 py-2 text-xs text-zinc-500">
                    <span>Misafir oturumu</span>
                    <button type="button" onClick={clearGuest} className="text-brand-800 underline">
                      Sıfırla
                    </button>
                  </div>
                ) : null}

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
