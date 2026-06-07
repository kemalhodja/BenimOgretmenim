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

function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    student: "Öğrenci",
    teacher: "Öğretmen",
    guardian: "Veli",
    admin: "Admin",
  };
  return labels[role] ?? role;
}

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
        `${u.email} kullanıcısının rolünü "${roleLabel(u.role)}" → "${roleLabel(next)}" olarak değiştirmek istediğinize emin misiniz?`,
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
      <div className="text-paper-800/75">
        <span>Öğretmen</span>
        <div className="mt-0.5 max-w-[12rem] text-[11px] leading-snug text-paper-800/45">
          Öğretmen rolü kaldırılamaz (profil satırı). Destek süreciyle ilerleyin.
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-[10rem]">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="rounded-lg border border-paper-200 bg-white px-2 py-1 text-sm"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        >
          <option value="student">Öğrenci</option>
          <option value="teacher">Öğretmen</option>
          <option value="guardian">Veli</option>
          <option value="admin">Admin</option>
        </select>
        <button
          type="button"
          disabled={!dirty || busy}
          onClick={() => void apply()}
          className="rounded-lg bg-brand-800 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40"
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
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Kullanıcılar</h1>
          <Link
            href="/admin"
            className="text-sm font-medium text-brand-800 underline decoration-brand-400 underline-offset-4"
          >
            Özet
          </Link>
        </div>
        <p className="mt-2 text-sm text-paper-800/75">
          E-posta veya görünen ad ile arayın. Rol filtresi isteğe bağlı. Öğretmen rolü satırda
          kilitlidir; diğer rollerde değişiklik sonrası kullanıcının yeniden giriş yapması gerekir.
        </p>

        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-paper-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
          <label className="block min-w-0 flex-1 text-sm">
            <span className="font-medium text-paper-800">Arama</span>
            <input
              className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2 text-sm"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="E-posta veya ad…"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-paper-800">Rol</span>
            <select
              className="mt-1 w-full min-w-[10rem] rounded-xl border border-paper-200 px-3 py-2 text-sm"
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setOffset(0);
              }}
            >
              <option value="">Tümü</option>
              <option value="student">Öğrenci</option>
              <option value="teacher">Öğretmen</option>
              <option value="guardian">Veli</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setAppliedQ(q);
              setOffset(0);
            }}
            className="rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white"
          >
            Ara
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        ) : null}

        <p className="mt-3 text-xs text-paper-800/55">
          Toplam {total} kayıt · sayfa {Math.floor(offset / limit) + 1}
        </p>

        <div className="mt-4 overflow-x-auto rounded-xl border border-paper-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-paper-200 bg-paper-50 text-xs font-semibold uppercase tracking-wide text-paper-800/75">
              <tr>
                <th className="px-3 py-2">Ad</th>
                <th className="px-3 py-2">E-posta</th>
                <th className="px-3 py-2">Rol</th>
                <th className="px-3 py-2">Rol değiştir</th>
                <th className="px-3 py-2">Kayıt</th>
                <th className="px-3 py-2">Son giriş</th>
                <th className="px-3 py-2">Kayıt kodu</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-paper-800/55">
                    Yükleniyor…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-paper-800/55">
                    Kayıt yok.
                  </td>
                </tr>
              ) : (
                rows.map((u) => (
                  <tr key={u.id} className="border-b border-paper-100 last:border-0">
                    <td className="px-3 py-2 font-medium text-paper-900">{u.display_name}</td>
                    <td className="px-3 py-2 text-paper-800">{u.email}</td>
                    <td className="px-3 py-2 text-paper-800/75">{roleLabel(u.role)}</td>
                    <td className="px-3 py-2 align-top">
                      <RoleEditor u={u} token={token} myId={myId} onDone={() => void load()} />
                    </td>
                    <td className="px-3 py-2 text-paper-800/75">{new Date(u.created_at).toLocaleString("tr-TR")}</td>
                    <td className="px-3 py-2 text-paper-800/75">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleString("tr-TR") : "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-paper-800/55">{u.id.slice(0, 8)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <nav className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm" aria-label="Sayfalama">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - limit))}
            className="font-medium text-brand-800 underline decoration-brand-400 underline-offset-4 disabled:cursor-not-allowed disabled:opacity-30 disabled:no-underline"
          >
            ← Önceki
          </button>
          <button
            type="button"
            disabled={offset + limit >= total}
            onClick={() => setOffset((o) => o + limit)}
            className="text-paper-800/75 underline decoration-paper-300 underline-offset-4 disabled:cursor-not-allowed disabled:opacity-30 disabled:no-underline"
          >
            Sonraki →
          </button>
        </nav>
      </div>
    </div>
  );
}
