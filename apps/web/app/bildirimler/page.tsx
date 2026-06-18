"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { clearToken, getToken } from "../lib/auth";
import { loginHrefWithReturn } from "../lib/authRedirect";

type Notification = {
  id: string;
  title: string;
  body: string;
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
  payload_jsonb?: unknown;
};

function payloadHref(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const o = payload as { href?: string; kind?: string; homeworkPostId?: string };
  if (typeof o.href === "string" && o.href.startsWith("/")) return o.href;
  if (o.kind === "account_suspended") return "/hesap-askida";
  if (o.kind === "account_deletion_requested") return "/ayarlar/hesap";
  if (typeof o.homeworkPostId === "string") return `/student/odev-sor/${o.homeworkPostId}`;
  return null;
}

export default function BildirimlerPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [rows, setRows] = useState<Notification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [router, pathname]);

  const load = useCallback(async (t: string) => {
    const r = await apiFetch<{ notifications: Notification[] }>("/v1/notifications?limit=50", { token: t });
    setRows(r.notifications);
  }, []);

  useEffect(() => {
    if (!token) return;
    load(token).catch((e) => {
      const m = e instanceof Error ? e.message : "yüklenemedi";
      if (m.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
        return;
      }
      setError(m);
    });
  }, [token, load, router, pathname]);

  async function markRead(id: string) {
    if (!token) return;
    setBusyId(id);
    try {
      await apiFetch(`/v1/notifications/${id}/read`, { method: "PATCH", token });
      setRows((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n)),
      );
    } finally {
      setBusyId(null);
    }
  }

  if (!token) return null;

  const unread = rows.filter((n) => !n.read_at).length;

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Bildirimler</h1>
        <p className="mt-2 text-sm text-paper-800/75">
          Ders, ödev, hesap ve ödeme güncellemeleri. {unread > 0 ? `${unread} okunmamış.` : "Tümü okundu."}
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link href="/panel" className="text-brand-800 underline">
            Panele dön
          </Link>
          <Link href="/itiraz" className="text-brand-800 underline">
            İtiraz
          </Link>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        ) : null}

        <ul className="mt-8 space-y-3">
          {rows.length === 0 ? (
            <li className="rounded-xl border border-paper-200 bg-white p-4 text-sm text-paper-800/55">Bildirim yok.</li>
          ) : (
            rows.map((n) => {
              const href = payloadHref(n.payload_jsonb);
              const isUnread = !n.read_at;
              return (
                <li
                  key={n.id}
                  className={`rounded-xl border p-4 text-sm ${
                    isUnread ? "border-brand-200 bg-brand-50/50" : "border-paper-200 bg-white"
                  }`}
                >
                  <div className="font-semibold text-paper-900">{n.title}</div>
                  <p className="mt-1 text-paper-800">{n.body}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-paper-800/55">
                    <span>{new Date(n.sent_at ?? n.created_at).toLocaleString("tr-TR")}</span>
                    {href ? (
                      <Link href={href} className="font-medium text-brand-800 underline">
                        Detay
                      </Link>
                    ) : null}
                    {isUnread ? (
                      <button
                        type="button"
                        disabled={busyId === n.id}
                        onClick={() => void markRead(n.id)}
                        className="font-medium text-paper-900 underline disabled:opacity-50"
                      >
                        Okundu işaretle
                      </button>
                    ) : (
                      <span>Okundu</span>
                    )}
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
