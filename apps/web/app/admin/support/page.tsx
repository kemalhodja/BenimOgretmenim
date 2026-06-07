"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useRequireAdmin } from "../useRequireAdmin";

type ThreadRow = {
  id: string;
  user_id: string | null;
  visitor_email: string | null;
  context_path: string;
  status: string;
  priority: "low" | "normal" | "high" | "urgent";
  assigned_admin_user_id: string | null;
  assigned_admin_display_name: string | null;
  first_response_due_at: string | null;
  resolved_at: string | null;
  last_user_message_at?: string | null;
  last_staff_message_at?: string | null;
  staff_response_count?: number;
  created_at: string;
  updated_at: string;
  user_email: string | null;
  user_display_name: string | null;
};

function threadListTitle(t: ThreadRow): string {
  if (t.user_id) return t.user_display_name ?? t.user_email ?? "Kullanıcı";
  return t.visitor_email ? `Misafir · ${t.visitor_email}` : "Misafir";
}

function threadListSubtitle(t: ThreadRow): string {
  if (t.user_id) return t.user_email ?? "—";
  return t.visitor_email ?? "E-posta yok";
}

function priorityLabel(priority: string): string {
  if (priority === "urgent") return "Acil";
  if (priority === "high") return "Yüksek";
  if (priority === "low") return "Düşük";
  return "Normal";
}

function threadStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    open: "Açık",
    closed: "Kapandı",
    pending: "Yanıt bekliyor",
  };
  return labels[status] ?? status;
}

function priorityClass(priority: string): string {
  if (priority === "urgent") return "bg-red-50 text-red-800";
  if (priority === "high") return "bg-amber-50 text-amber-900";
  if (priority === "low") return "bg-paper-100 text-paper-700";
  return "bg-brand-50 text-brand-900";
}

function slaLabel(t: ThreadRow): string {
  if (t.resolved_at) return "Çözüldü";
  if (!t.first_response_due_at) return "Yanıt hedefi yok";
  if ((t.staff_response_count ?? 0) > 0) return "Yanıtlandı";
  const due = new Date(t.first_response_due_at).getTime();
  const diff = due - Date.now();
  if (diff <= 0) return "Yanıt süresi geçti";
  const minutes = Math.ceil(diff / 60_000);
  if (minutes < 60) return `${minutes} dk kaldı`;
  return `${Math.ceil(minutes / 60)} sa kaldı`;
}

type MessageRow = {
  id: string;
  sender: "user" | "staff";
  body: string;
  created_at: string;
};

export default function AdminSupportPage() {
  const token = useRequireAdmin();
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [threadMeta, setThreadMeta] = useState<ThreadRow | null>(null);
  const [reply, setReply] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "open" | "closed">("open");
  const [priorityFilter, setPriorityFilter] = useState<"" | "low" | "normal" | "high" | "urgent">("");
  const [listLoading, setListLoading] = useState(false);
  const [msgLoading, setMsgLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [metaBusy, setMetaBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    if (!token) return;
    setListLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      sp.set("limit", "50");
      sp.set("offset", "0");
      if (statusFilter) sp.set("status", statusFilter);
      if (priorityFilter) sp.set("priority", priorityFilter);
      const r = await apiFetch<{ threads: ThreadRow[]; total: number }>(
        `/api/admin/support-threads?${sp.toString()}`,
        { token },
      );
      setThreads(r.threads);
      setTotal(r.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "liste_alınamadı");
    } finally {
      setListLoading(false);
    }
  }, [token, statusFilter, priorityFilter]);

  const loadThread = useCallback(
    async (id: string) => {
      if (!token) return;
      setMsgLoading(true);
      setError(null);
      try {
        const r = await apiFetch<{ thread: ThreadRow; messages: MessageRow[] }>(
          `/api/admin/support-threads/${encodeURIComponent(id)}/messages`,
          { token },
        );
        setThreadMeta(r.thread);
        setMessages(r.messages);
      } catch (e) {
        setError(e instanceof Error ? e.message : "mesajlar_alınamadı");
      } finally {
        setMsgLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (selectedId) void loadThread(selectedId);
  }, [selectedId, loadThread]);

  async function sendReply() {
    const trimmed = reply.trim();
    if (!trimmed || !token || !selectedId) return;
    setSending(true);
    setError(null);
    try {
      const r = await apiFetch<{ messages: MessageRow[] }>(
        `/api/admin/support-threads/${encodeURIComponent(selectedId)}/messages`,
        { method: "POST", token, body: JSON.stringify({ content: trimmed }) },
      );
      setReply("");
      setMessages(r.messages);
      if (selectedId) await loadThread(selectedId);
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "gönderilemedi");
    } finally {
      setSending(false);
    }
  }

  async function updateThreadMeta(patch: {
    status?: "open" | "closed";
    priority?: "low" | "normal" | "high" | "urgent";
    assignedToMe?: boolean;
  }) {
    if (!token || !selectedId) return;
    setMetaBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/support-threads/${encodeURIComponent(selectedId)}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(patch),
      });
      await loadThread(selectedId);
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "güncellenemedi");
    } finally {
      setMetaBusy(false);
    }
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link
              href="/admin"
              className="text-sm font-medium text-brand-800 underline decoration-brand-400 underline-offset-4"
            >
              ← Özet
            </Link>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-paper-900">Canlı destek</h1>
          </div>
          <Link
            href="/admin/merkez"
            className="text-sm font-medium text-brand-800 underline decoration-brand-400 underline-offset-4"
          >
            Merkez
          </Link>
        </div>
        <p className="mt-2 text-sm text-paper-800/75">
          Kullanıcıların site içi destek kutusundan gönderdiği mesajlar. Toplam:{" "}
          <span className="font-mono tabular-nums">{total}</span>
        </p>

        <div className="mt-4 grid gap-3 rounded-xl border border-paper-200 bg-white p-4 shadow-sm sm:grid-cols-3">
          <label className="block text-sm">
            <span className="font-medium text-paper-800">Durum</span>
            <select
              className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "" | "open" | "closed")}
            >
              <option value="">Tümü</option>
              <option value="open">Açık</option>
              <option value="closed">Kapalı</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-paper-800">Öncelik</span>
            <select
              className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2 text-sm"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as "" | "low" | "normal" | "high" | "urgent")}
            >
              <option value="">Tümü</option>
              <option value="urgent">Acil</option>
              <option value="high">Yüksek</option>
              <option value="normal">Normal</option>
              <option value="low">Düşük</option>
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void loadList()}
              className="w-full rounded-xl border border-paper-200 bg-white px-3 py-2 text-sm font-medium text-paper-900"
            >
              Listeyi yenile
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="rounded-xl border border-paper-200 bg-white">
            <div className="border-b border-paper-100 px-4 py-3 text-sm font-semibold text-paper-800">
              Konuşmalar
            </div>
            <div className="max-h-[520px] overflow-y-auto">
              {listLoading ? (
                <p className="p-4 text-sm text-paper-800/55">Yükleniyor…</p>
              ) : threads.length === 0 ? (
                <p className="p-4 text-sm text-paper-800/55">Henüz kayıt yok.</p>
              ) : (
                <ul className="divide-y divide-paper-100">
                  {threads.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(t.id)}
                        className={`w-full px-4 py-3 text-left text-sm transition hover:bg-paper-50 ${
                          selectedId === t.id ? "bg-brand-50" : ""
                        }`}
                      >
                        <div className="font-medium text-paper-900">{threadListTitle(t)}</div>
                        <div className="mt-0.5 truncate text-xs text-paper-800/55">{threadListSubtitle(t)}</div>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                          <span className={`rounded-full px-2 py-0.5 font-medium ${priorityClass(t.priority)}`}>
                            {priorityLabel(t.priority)}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 font-medium ${
                              slaLabel(t) === "Yanıt süresi geçti" ? "bg-red-50 text-red-800" : "bg-paper-100 text-paper-800"
                            }`}
                          >
                            {slaLabel(t)}
                          </span>
                          {t.assigned_admin_display_name ? (
                            <span className="rounded-full bg-paper-100 px-2 py-0.5 font-medium text-paper-800">
                              {t.assigned_admin_display_name}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 truncate text-xs text-paper-800/45">
                          {t.context_path ? `Sayfa: ${t.context_path}` : "Sayfa bilgisi yok"}
                        </div>
                        <div className="mt-1 text-[10px] uppercase text-paper-800/45">
                          {threadStatusLabel(t.status)} · {new Date(t.updated_at).toLocaleString("tr-TR")}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex min-h-[400px] flex-col rounded-xl border border-paper-200 bg-white">
            <div className="border-b border-paper-100 px-4 py-3">
              <p className="text-sm font-semibold text-paper-800">Mesajlar</p>
              {threadMeta ? (
                <div className="mt-1 space-y-2">
                  <p className="text-xs text-paper-800/55">
                    {threadMeta.user_id
                      ? threadMeta.user_email
                      : threadMeta.visitor_email
                        ? `Misafir: ${threadMeta.visitor_email}`
                        : "Misafir"}
                    {threadMeta.context_path ? ` · ${threadMeta.context_path}` : ""}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className={`rounded-full px-2 py-0.5 font-medium ${priorityClass(threadMeta.priority)}`}>
                      {priorityLabel(threadMeta.priority)}
                    </span>
                    <span className="rounded-full bg-paper-100 px-2 py-0.5 font-medium text-paper-800">
                      {threadStatusLabel(threadMeta.status)}
                    </span>
                    <span className="rounded-full bg-paper-100 px-2 py-0.5 font-medium text-paper-800">
                      {slaLabel(threadMeta)}
                    </span>
                    {threadMeta.assigned_admin_display_name ? (
                      <span className="rounded-full bg-paper-100 px-2 py-0.5 font-medium text-paper-800">
                        Atanan: {threadMeta.assigned_admin_display_name}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select
                      className="rounded-lg border border-paper-200 px-2 py-1 text-xs"
                      disabled={metaBusy}
                      value={threadMeta.priority}
                      onChange={(e) =>
                        void updateThreadMeta({
                          priority: e.target.value as "low" | "normal" | "high" | "urgent",
                        })
                      }
                    >
                      <option value="urgent">Acil</option>
                      <option value="high">Yüksek</option>
                      <option value="normal">Normal</option>
                      <option value="low">Düşük</option>
                    </select>
                    <button
                      type="button"
                      disabled={metaBusy}
                      onClick={() => void updateThreadMeta({ assignedToMe: true })}
                      className="rounded-lg border border-paper-200 bg-white px-2 py-1 text-xs font-medium text-paper-900 disabled:opacity-50"
                    >
                      Bana ata
                    </button>
                    <button
                      type="button"
                      disabled={metaBusy}
                      onClick={() =>
                        void updateThreadMeta({ status: threadMeta.status === "closed" ? "open" : "closed" })
                      }
                      className="rounded-lg bg-brand-800 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                    >
                      {threadMeta.status === "closed" ? "Yeniden aç" : "Çözüldü kapat"}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-xs text-paper-800/55">Soldan bir konuşma seçin.</p>
              )}
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
              {!selectedId ? (
                <p className="text-sm text-paper-800/55">Liste üzerinden seçim yapın.</p>
              ) : msgLoading ? (
                <p className="text-sm text-paper-800/55">Yükleniyor…</p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${
                      m.sender === "staff"
                        ? "ml-auto bg-brand-50 text-brand-950"
                        : "mr-auto border border-paper-100 bg-paper-50"
                    }`}
                  >
                    <p className="text-[10px] font-medium uppercase text-paper-800/55">
                      {m.sender === "staff" ? "Yönetim" : threadMeta?.user_id ? "Kullanıcı" : "Misafir"}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-paper-100 p-3">
              <div className="flex gap-2">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={2}
                  disabled={!selectedId}
                  placeholder={selectedId ? "Yanıt yazın…" : "Önce konuşma seçin"}
                  className="min-h-[44px] flex-1 resize-none rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400 disabled:bg-paper-100"
                />
                <button
                  type="button"
                  disabled={!selectedId || sending || !reply.trim()}
                  onClick={() => void sendReply()}
                  className="shrink-0 self-end rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {sending ? "…" : "Gönder"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
