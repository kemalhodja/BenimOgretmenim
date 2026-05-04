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
  const [listLoading, setListLoading] = useState(false);
  const [msgLoading, setMsgLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    if (!token) return;
    setListLoading(true);
    setError(null);
    try {
      const r = await apiFetch<{ threads: ThreadRow[]; total: number }>(
        "/api/admin/support-threads?limit=50&offset=0",
        { token },
      );
      setThreads(r.threads);
      setTotal(r.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "liste_alınamadı");
    } finally {
      setListLoading(false);
    }
  }, [token]);

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
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "gönderilemedi");
    } finally {
      setSending(false);
    }
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-sm font-medium text-zinc-500">Yönetim</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Canlı destek</h1>
          <Link href="/admin/merkez" className="text-sm font-medium text-brand-800 underline">
            Merkez
          </Link>
        </div>
        <p className="mt-2 text-sm text-zinc-600">
          Kullanıcıların site içi destek kutusundan gönderdiği mesajlar. Toplam:{" "}
          <span className="font-mono tabular-nums">{total}</span>
        </p>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-800">
              Konuşmalar
            </div>
            <div className="max-h-[520px] overflow-y-auto">
              {listLoading ? (
                <p className="p-4 text-sm text-zinc-500">Yükleniyor…</p>
              ) : threads.length === 0 ? (
                <p className="p-4 text-sm text-zinc-500">Henüz kayıt yok.</p>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {threads.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(t.id)}
                        className={`w-full px-4 py-3 text-left text-sm transition hover:bg-zinc-50 ${
                          selectedId === t.id ? "bg-brand-50" : ""
                        }`}
                      >
                        <div className="font-medium text-zinc-900">{threadListTitle(t)}</div>
                        <div className="mt-0.5 truncate text-xs text-zinc-500">{threadListSubtitle(t)}</div>
                        <div className="mt-1 truncate text-xs text-zinc-400">
                          {t.context_path ? `Sayfa: ${t.context_path}` : "Sayfa bilgisi yok"}
                        </div>
                        <div className="mt-1 text-[10px] uppercase text-zinc-400">
                          {t.status} · {new Date(t.updated_at).toLocaleString("tr-TR")}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex min-h-[400px] flex-col rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-4 py-3">
              <p className="text-sm font-semibold text-zinc-800">Mesajlar</p>
              {threadMeta ? (
                <p className="mt-1 text-xs text-zinc-500">
                  {threadMeta.user_id
                    ? threadMeta.user_email
                    : threadMeta.visitor_email
                      ? `Misafir: ${threadMeta.visitor_email}`
                      : "Misafir"}
                  {threadMeta.context_path ? ` · ${threadMeta.context_path}` : ""}
                </p>
              ) : (
                <p className="mt-1 text-xs text-zinc-500">Soldan bir konuşma seçin.</p>
              )}
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
              {!selectedId ? (
                <p className="text-sm text-zinc-500">Liste üzerinden seçim yapın.</p>
              ) : msgLoading ? (
                <p className="text-sm text-zinc-500">Yükleniyor…</p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${
                      m.sender === "staff"
                        ? "ml-auto bg-emerald-50 text-emerald-950"
                        : "mr-auto border border-zinc-100 bg-zinc-50"
                    }`}
                  >
                    <p className="text-[10px] font-medium uppercase text-zinc-500">
                      {m.sender === "staff" ? "Yönetim" : threadMeta?.user_id ? "Kullanıcı" : "Misafir"}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-zinc-100 p-3">
              <div className="flex gap-2">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={2}
                  disabled={!selectedId}
                  placeholder={selectedId ? "Yanıt yazın…" : "Önce konuşma seçin"}
                  className="min-h-[44px] flex-1 resize-none rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand-400 disabled:bg-zinc-100"
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
