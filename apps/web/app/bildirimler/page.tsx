"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import {
  clearToken,
  getCachedRole,
  getRoleFromToken,
  getToken,
  panelPathForRole,
  type UserRole,
} from "../lib/auth";
import { loginHrefWithReturn } from "../lib/authRedirect";
import {
  dispatchNotificationsChanged,
  groupNotificationsByDay,
  notificationActionLabel,
  notificationKindLabel,
  notificationPriority,
  priorityBorderClass,
  resolveNotificationHref,
  type NotificationRow,
} from "../lib/notifications";

type Filter = "all" | "unread";

export default function BildirimlerPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
    setRole(getRoleFromToken(t) ?? getCachedRole());
  }, [router, pathname]);

  const load = useCallback(async (t: string, f: Filter) => {
    const q = f === "unread" ? "?limit=50&unreadOnly=1" : "?limit=50";
    const r = await apiFetch<{ notifications: NotificationRow[] }>(`/v1/notifications${q}`, { token: t });
    setRows(r.notifications);
  }, []);

  useEffect(() => {
    if (!token) return;
    load(token, filter).catch((e) => {
      const m = e instanceof Error ? e.message : "yüklenemedi";
      if (m.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
        return;
      }
      setError(m);
    });
  }, [token, filter, load, router, pathname]);

  useEffect(() => {
    const on = () => {
      if (token) void load(token, filter);
    };
    window.addEventListener("bo:notifications-changed", on);
    return () => window.removeEventListener("bo:notifications-changed", on);
  }, [token, filter, load]);

  async function markRead(id: string) {
    if (!token) return;
    setBusyId(id);
    try {
      await apiFetch(`/v1/notifications/${id}/read`, { method: "PATCH", token });
      setRows((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n)),
      );
      dispatchNotificationsChanged();
    } finally {
      setBusyId(null);
    }
  }

  async function markAllRead() {
    if (!token) return;
    setMarkingAll(true);
    try {
      await apiFetch("/v1/notifications/read-all", { method: "PATCH", token });
      setRows((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
      dispatchNotificationsChanged();
    } finally {
      setMarkingAll(false);
    }
  }

  const unread = useMemo(() => rows.filter((n) => !n.read_at).length, [rows]);
  const groups = useMemo(() => groupNotificationsByDay(rows), [rows]);
  const panelHref = role ? panelPathForRole(role) : "/panel";

  if (!token) return null;

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Bildirimler</h1>
            <p className="mt-2 text-sm text-paper-800/75">
              Ders, ödev, video ve hesap güncellemeleri.{" "}
              {unread > 0 ? `${unread} okunmamış.` : "Tümü okundu."}
            </p>
          </div>
          {unread > 0 ? (
            <button
              type="button"
              disabled={markingAll}
              onClick={() => void markAllRead()}
              className="rounded-lg border border-paper-300 bg-white px-3 py-1.5 text-sm font-medium text-paper-900 hover:bg-paper-50 disabled:opacity-50"
            >
              {markingAll ? "İşleniyor…" : "Tümünü okundu işaretle"}
            </button>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              filter === "all" ? "bg-brand-700 text-white" : "bg-white text-paper-800 ring-1 ring-paper-200"
            }`}
          >
            Tümü
          </button>
          <button
            type="button"
            onClick={() => setFilter("unread")}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              filter === "unread" ? "bg-brand-700 text-white" : "bg-white text-paper-800 ring-1 ring-paper-200"
            }`}
          >
            Okunmamış
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link href={panelHref} className="text-brand-800 underline">
            Panele dön
          </Link>
          <Link href="/itiraz" className="text-brand-800 underline">
            İtiraz
          </Link>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        ) : null}

        <div className="mt-8 space-y-8">
          {rows.length === 0 ? (
            <div className="rounded-xl border border-paper-200 bg-white p-6 text-center text-sm text-paper-800/55">
              {filter === "unread" ? "Okunmamış bildirim yok." : "Bildirim yok."}
            </div>
          ) : (
            groups.map((group) => (
              <section key={group.label}>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-paper-800/45">{group.label}</h2>
                <ul className="mt-3 space-y-3">
                  {group.items.map((n) => {
                    const href = resolveNotificationHref(n.payload_jsonb, role);
                    const isUnread = !n.read_at;
                    const priority = notificationPriority(n.payload_jsonb);
                    const kindLabel = notificationKindLabel(n.payload_jsonb);
                    const action = notificationActionLabel(n.payload_jsonb);
                    return (
                      <li
                        key={n.id}
                        className={`rounded-xl border p-4 text-sm ${priorityBorderClass(priority, isUnread)}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-brand-800">{kindLabel}</span>
                          {(priority === "urgent" || priority === "high") && isUnread ? (
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                priority === "urgent" ? "bg-red-100 text-red-800" : "bg-brand-100 text-brand-900"
                              }`}
                            >
                              {priority === "urgent" ? "Acil" : "Önemli"}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 font-semibold text-paper-900">{n.title}</div>
                        <p className="mt-1 text-paper-800">{n.body}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-paper-800/55">
                          <span>{new Date(n.sent_at ?? n.created_at).toLocaleString("tr-TR")}</span>
                          {href ? (
                            <Link href={href} className="font-medium text-brand-800 underline">
                              {action}
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
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
