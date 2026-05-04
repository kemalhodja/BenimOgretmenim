"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { getUserIdFromToken } from "../../lib/auth";
import { useRequireAdmin } from "../useRequireAdmin";

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  role: string;
  created_at: string;
  last_login_at: string | null;
};

function RoleEditor({
  u,
  token,
  myId,
  onDone,
}: {
  u: UserRow;
  token: string;
  myId: string | null;
  onDone: () => void;
}) {
  const [next, setNext] = useState(u.role);
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  useEffect(() => {
    setNext(u.role);
  }, [u.role]);

  const dirty = next !== u.role;
  const lockedTeacher = u.role === "teacher";

  async function apply() {
    if (!dirty || lockedTeacher) return;
    if (
      !window.confirm(
        `${u.email} kullanıcısının rolünü "${u.role}" → "${next}" olarak değiştirmek istediğinize emin misiniz?`,
      )
    ) {
      return;
    }
    setBusy(true);
    setLocalErr(null);
    try {
      await apiFetch(`/api/admin/users/${u.id}/role`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ role: next }),
      });
      onDone();
    } catch (e) {
      setLocalErr(e instanceof Error ? e.message : "hata");
    } finally {
      setBusy(false);
    }
  }

  if (lockedTeacher) {
    return (
      <div className="text-zinc-600">
        <span className="capitalize">teacher</span>
        <div className="mt-0.5 max-w-[12rem] text-[11px] leading-snug text-zinc-400">
          Öğretmen rolü kaldırılamaz (profil satırı). Destek süreciyle ilerleyin.
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-[10rem]">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm capitalize"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        >
          <option value="student">student</option>
          <option value="teacher">teacher</option>
          <option value="guardian">guardian</option>
          <option value="admin">admin</option>
        </select>
        <button
          type="button"
          disabled={!dirty || busy}
          onClick={() => void apply()}
          className="rounded-lg bg-zinc-900 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40"
        >
          {busy ? "…" : "Uygula"}
        </button>
      </div>
      {myId === u.id ? (
        <p className="mt-1 text-[11px] text-amber-800">Bu satır sizin hesabınız.</p>
      ) : null}
      {localErr ? <p className="mt-1 text-[11px] text-red-700">{localErr}</p> : null}
    </div>
  );
}

export default function AdminUsersPage() {
  const token = useRequireAdmin();
  const myId = useMemo(() => getUserIdFromToken(token), [token]);
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [role, setRole] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 40;
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      if (appliedQ.trim()) sp.set("q", appliedQ.trim());
      if (role) sp.set("role", role);
      sp.set("limit", String(limit));
      sp.set("offset", String(offset));
      const r = await apiFetch<{ users: UserRow[]; total: number }>(`/api/admin/users?${sp.toString()}`, {
        token,
      });
      setRows(r.users);
      setTotal(r.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [token, appliedQ, role, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!token) return null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-sm font-medium text-zinc-500">Yönetim</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Kullanıcılar</h1>
          <Link href="/admin" className="text-sm font-medium text-brand-800 underline">
            Özet
          </Link>
        </div>
        <p className="mt-2 text-sm text-zinc-600">
          E-posta veya görünen ad ile arayın. Rol filtresi isteğe bağlı. Öğretmen rolü satırda
          kilitlidir; diğer rollerde değişiklik sonrası kullanıcının yeniden giriş yapması gerekir.
        </p>

        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
          <label className="block min-w-0 flex-1 text-sm">
            <span className="font-medium text-zinc-700">Arama</span>
            <input
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="E-posta veya ad…"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-zinc-700">Rol</span>
            <select
              className="mt-1 w-full min-w-[10rem] rounded-xl border border-zinc-200 px-3 py-2 text-sm"
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setOffset(0);
              }}
            >
              <option value="">Tümü</option>
              <option value="student">student</option>
              <option value="teacher">teacher</option>
              <option value="guardian">guardian</option>
              <option value="admin">admin</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setAppliedQ(q);
              setOffset(0);
            }}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Ara
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        ) : null}

        <p className="mt-3 text-xs text-zinc-500">
          Toplam {total} kayıt · sayfa {Math.floor(offset / limit) + 1}
        </p>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              <tr>
                <th className="px-3 py-2">Ad</th>
                <th className="px-3 py-2">E-posta</th>
                <th className="px-3 py-2">Rol</th>
                <th className="px-3 py-2">Rol değiştir</th>
                <th className="px-3 py-2">Kayıt</th>
                <th className="px-3 py-2">Son giriş</th>
                <th className="px-3 py-2 font-mono text-[11px]">id</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-zinc-500">
                    Yükleniyor…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-zinc-500">
                    Kayıt yok.
                  </td>
                </tr>
              ) : (
                rows.map((u) => (
                  <tr key={u.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-3 py-2 font-medium text-zinc-900">{u.display_name}</td>
                    <td className="px-3 py-2 text-zinc-700">{u.email}</td>
                    <td className="px-3 py-2 capitalize text-zinc-600">{u.role}</td>
                    <td className="px-3 py-2 align-top">
                      <RoleEditor u={u} token={token} myId={myId} onDone={() => void load()} />
                    </td>
                    <td className="px-3 py-2 text-zinc-600">{new Date(u.created_at).toLocaleString("tr-TR")}</td>
                    <td className="px-3 py-2 text-zinc-600">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleString("tr-TR") : "—"}
                    </td>
                    <td className="max-w-[8rem] truncate px-3 py-2 font-mono text-[11px] text-zinc-500">{u.id}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - limit))}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Önceki
          </button>
          <button
            type="button"
            disabled={offset + limit >= total}
            onClick={() => setOffset((o) => o + limit)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Sonraki
          </button>
        </div>
      </div>
    </div>
  );
}
