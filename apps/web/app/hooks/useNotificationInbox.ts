"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/api";
import { getToken, getCachedRole, getRoleFromToken } from "../lib/auth";
import {
  dispatchNotificationsChanged,
  type NotificationRow,
  type NotificationSummary,
} from "../lib/notifications";

const POLL_MS = 60_000;

export function useNotificationInbox(limit = 8) {
  const [token, setToken] = useState<string | null>(null);
  const [summary, setSummary] = useState<NotificationSummary>({
    unread: 0,
    total: 0,
    byCategory: {},
    latestAt: null,
  });
  const [preview, setPreview] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const streamRef = useRef<EventSource | null>(null);

  useEffect(() => {
    setToken(getToken());
    const on = () => setToken(getToken());
    window.addEventListener("bo:auth-changed", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("bo:auth-changed", on);
      window.removeEventListener("storage", on);
    };
  }, []);

  const refresh = useCallback(async () => {
    const t = getToken();
    if (!t) {
      setSummary({ unread: 0, total: 0, byCategory: {}, latestAt: null });
      setPreview([]);
      return;
    }
    setLoading(true);
    try {
      const [s, list] = await Promise.all([
        apiFetch<NotificationSummary>("/v1/notifications/summary", { token: t }),
        apiFetch<{ notifications: NotificationRow[] }>(`/v1/notifications?limit=${limit}`, { token: t }),
      ]);
      setSummary(s);
      setPreview(list.notifications);
    } catch {
      /* sessiz */
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void refresh();

    const t = getToken();
    if (t && typeof EventSource !== "undefined") {
      try {
        const es = new EventSource("/v1/notifications/stream", { withCredentials: true });
        streamRef.current = es;
        es.addEventListener("summary", (ev) => {
          try {
            const data = JSON.parse((ev as MessageEvent).data) as NotificationSummary;
            setSummary(data);
          } catch {
            /* yoksay */
          }
        });
        es.onerror = () => {
          es.close();
          streamRef.current = null;
        };
      } catch {
        streamRef.current = null;
      }
    }

    const iv = window.setInterval(() => {
      if (document.visibilityState === "visible" && !streamRef.current) void refresh();
    }, POLL_MS);

    const on = () => void refresh();
    window.addEventListener("bo:notifications-changed", on);
    window.addEventListener("bo:auth-changed", on);

    return () => {
      window.clearInterval(iv);
      streamRef.current?.close();
      streamRef.current = null;
      window.removeEventListener("bo:notifications-changed", on);
      window.removeEventListener("bo:auth-changed", on);
    };
  }, [refresh]);

  const markRead = useCallback(
    async (id: string) => {
      const t = getToken();
      if (!t) return;
      await apiFetch(`/v1/notifications/${id}/read`, { method: "PATCH", token: t });
      setPreview((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n)),
      );
      setSummary((prev) => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));
      dispatchNotificationsChanged();
    },
    [],
  );

  const markAllRead = useCallback(async () => {
    const t = getToken();
    if (!t) return;
    await apiFetch("/v1/notifications/read-all", { method: "PATCH", token: t });
    setPreview((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    setSummary((prev) => ({ ...prev, unread: 0 }));
    dispatchNotificationsChanged();
  }, []);

  const role = getRoleFromToken(token) ?? getCachedRole();

  return { token, role, summary, preview, loading, refresh, markRead, markAllRead };
}
