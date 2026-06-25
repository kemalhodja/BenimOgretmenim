"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useNotificationInbox } from "../hooks/useNotificationInbox";
import {
  formatNotificationWhen,
  notificationActionLabel,
  notificationKindLabel,
  notificationPriority,
  resolveNotificationHref,
} from "../lib/notifications";

export function NotificationBell() {
  const { token, role, summary, preview, markRead, markAllRead } = useNotificationInbox(6);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  if (!token) return null;

  const unread = summary.unread;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={unread > 0 ? `${unread} okunmamış bildirim` : "Bildirimler"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-paper-300 bg-white text-paper-800 hover:bg-paper-50"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 1 0-14 0v5l-2 2v1h18v-1l-2-2Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Bildirim önizlemesi"
          className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-paper-200 bg-white shadow-lg"
        >
          <div className="flex items-center justify-between gap-2 border-b border-paper-100 px-3 py-2.5">
            <div>
              <div className="text-sm font-semibold text-paper-900">Bildirimler</div>
              <div className="text-xs text-paper-800/55">
                {unread > 0 ? `${unread} okunmamış` : "Güncel"}
              </div>
            </div>
            {unread > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs font-medium text-brand-800 underline"
              >
                Tümünü okundu
              </button>
            ) : null}
          </div>

          <ul className="max-h-80 overflow-y-auto">
            {preview.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-paper-800/55">Bildirim yok.</li>
            ) : (
              preview.map((n) => {
                const href = resolveNotificationHref(n.payload_jsonb, role);
                const isUnread = !n.read_at;
                const priority = notificationPriority(n.payload_jsonb);
                const kindLabel = notificationKindLabel(n.payload_jsonb);
                const action = notificationActionLabel(n.payload_jsonb);
                const inner = (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-medium text-brand-800">{kindLabel}</span>
                      {priority === "urgent" || priority === "high" ? (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                            priority === "urgent" ? "bg-red-100 text-red-800" : "bg-brand-100 text-brand-900"
                          }`}
                        >
                          {priority === "urgent" ? "Acil" : "Önemli"}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-sm font-semibold text-paper-900 line-clamp-2">{n.title}</div>
                    <p className="mt-0.5 text-xs text-paper-800/75 line-clamp-2">{n.body}</p>
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-paper-800/50">
                      <span>{formatNotificationWhen(n.sent_at ?? n.created_at)}</span>
                      {href ? <span className="font-medium text-brand-800">{action}</span> : null}
                    </div>
                  </>
                );
                return (
                  <li
                    key={n.id}
                    className={`border-b border-paper-100 last:border-b-0 ${
                      isUnread ? "bg-brand-50/40" : "bg-white"
                    }`}
                  >
                    {href ? (
                      <Link
                        href={href}
                        onClick={() => {
                          if (isUnread) void markRead(n.id);
                          setOpen(false);
                        }}
                        className="block px-3 py-2.5 no-underline hover:bg-paper-50"
                      >
                        {inner}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (isUnread) void markRead(n.id);
                        }}
                        className="block w-full px-3 py-2.5 text-left hover:bg-paper-50"
                      >
                        {inner}
                      </button>
                    )}
                  </li>
                );
              })
            )}
          </ul>

          <div className="border-t border-paper-100 px-3 py-2">
            <Link
              href="/bildirimler"
              onClick={() => setOpen(false)}
              className="block text-center text-sm font-medium text-brand-800 underline"
            >
              Tüm bildirimleri aç
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
