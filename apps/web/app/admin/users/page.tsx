"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "../../lib/api";
import {
  adminScopeLabel,
  getAdminScopeFromSession,
  getUserIdFromToken,
  setAdminScopeHintCookie,
  type AdminScope,
} from "../../lib/auth";
import { useRequireAdmin } from "../useRequireAdmin";

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  role: string;
  account_status: string;
  admin_scope?: string | null;
  suspension_reason: string | null;
  created_at: string;
  last_login_at: string | null;
};

function accountStatusLabel(status: string): string {
  if (status === "active") return "Aktif";
  if (status === "suspended") return "Askıda";
  if (status === "deletion_requested") return "Silme talebi";
  return status;
}

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

function AccountStatusEditor({
  u,
  token,
  onDone,
}: {
  u: UserRow;
  token: string;
  onDone: () => void;
}) {
  const [next, setNext] = useState(u.account_status);
  const [reason, setReason] = useState(u.suspension_reason ?? "");
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  useEffect(() => {
    setNext(u.account_status);
    setReason(u.suspension_reason ?? "");
  }, [u.account_status, u.suspension_reason]);

  const dirty = next !== u.account_status || (next === "suspended" && reason.trim() !== (u.suspension_reason ?? "").trim());

  async function apply() {
    if (!dirty) return;
    if (next === "suspended" && reason.trim().length < 3) {
      setLocalErr("Askıya alma için en az 3 karakterlik gerekçe girin.");
      return;
    }
    const label = accountStatusLabel(next);
    if (!window.confirm(`${u.email} hesap durumunu "${label}" yapmak istediğinize emin misiniz?`)) return;

    setBusy(true);
    setLocalErr(null);
    try {
      await apiFetch(`/api/admin/users/${u.id}/account-status`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          status: next,
          reason: next === "suspended" ? reason.trim() : reason.trim() || undefined,
        }),
      });
      onDone();
    } catch (e) {
      setLocalErr(e instanceof Error ? e.message : "hata");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-w-[12rem]">
      <select
        className="w-full rounded-lg border border-paper-200 bg-white px-2 py-1 text-sm"
        value={next}
        onChange={(e) => setNext(e.target.value)}
      >
        <option value="active">Aktif</option>
        <option value="suspended">Askıda</option>
        <option value="deletion_requested">Silme talebi</option>
      </select>
      {next === "suspended" ? (
        <textarea
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Askıya alma gerekçesi (kullanıcıya gösterilir)"
          className="mt-1 w-full rounded-lg border border-paper-200 px-2 py-1 text-xs"
        />
      ) : null}
      <button
        type="button"
        disabled={!dirty || busy}
        onClick={() => void apply()}
        className="mt-1 rounded-lg bg-paper-900 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40"
      >
        {busy ? "…" : "Durumu kaydet"}
      </button>
      {localErr ? <p className="mt-1 text-[11px] text-red-700">{localErr}</p> : null}
    </div>
  );
}

function AdminScopeEditor({
  u,
  token,
  myId,
  canEdit,
  onDone,
}: {
  u: UserRow;
  token: string;
  myId: string | null;
  canEdit: boolean;
  onDone: () => void;
}) {
  const [next, setNext] = useState<AdminScope>((u.admin_scope as AdminScope) ?? "full");
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  useEffect(() => {
    setNext((u.admin_scope as AdminScope) ?? "full");
  }, [u.admin_scope]);

  if (u.role !== "admin") return <span className="text-paper-800/45">—</span>;
  if (!canEdit) {
    return <span className="text-xs text-paper-800/75">{adminScopeLabel(u.admin_scope)}</span>;
  }

  const dirty = next !== ((u.admin_scope as AdminScope) ?? "full");

  async function apply() {
    if (!dirty) return;
    if (
      !window.confirm(
        `${u.email} admin kapsamını "${adminScopeLabel(u.admin_scope)}" → "${adminScopeLabel(next)}" olarak değiştirmek istediğinize emin misiniz?`,
      )
    ) {
      return;
    }
    setBusy(true);
    setLocalErr(null);
    try {
      const r = await apiFetch<{ reloginRequired?: boolean; adminScope?: AdminScope }>(
        `/api/admin/users/${u.id}/admin-scope`,
        {
          method: "PATCH",
          token,
          body: JSON.stringify({ scope: next }),
        },
      );
      if (r.reloginRequired && myId === u.id && r.adminScope) {
        setAdminScopeHintCookie(r.adminScope);
        window.location.reload();
        return;
      }
      onDone();
    } catch (e) {
      setLocalErr(e instanceof Error ? e.message : "hata");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-w-[10rem]">
      <select
        className="w-full rounded-lg border border-paper-200 bg-white px-2 py-1 text-sm"
        value={next}
        onChange={(e) => setNext(e.target.value as AdminScope)}
      >
        <option value="full">Tam yetki</option>
        <option value="finance">Finans</option>
        <option value="support">Destek</option>
      </select>
      <button
        type="button"
        disabled={!dirty || busy}
        onClick={() => void apply()}
        className="mt-1 rounded-lg bg-brand-800 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40"
      >
        {busy ? "…" : "Kapsamı kaydet"}
      </button>
      {localErr ? <p className="mt-1 text-[11px] text-red-700">{localErr}</p> : null}
    </div>
  );
}

function AdminUsersPageInner() {
  const token = useRequireAdmin();
  const searchParams = useSearchParams();
  const myId = useMemo(() => getUserIdFromToken(token), [token]);
  const canEditAdminScope = getAdminScopeFromSession() === "full";
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [role, setRole] = useState("");
  const [accountStatus, setAccountStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 40;
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const status = searchParams.get("status")?.trim() ?? "";
    if (status === "suspended" || status === "deletion_requested" || status === "active") {
      setAccountStatus(status);
      setOffset(0);
    }
  }, [searchParams]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      if (appliedQ.trim()) sp.set("q", appliedQ.trim());
      if (role) sp.set("role", role);
      if (accountStatus) sp.set("status", accountStatus);
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
  }, [token, appliedQ, role, accountStatus, offset]);

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
          <label className="block text-sm">
            <span className="font-medium text-paper-800">Hesap durumu</span>
            <select
              className="mt-1 w-full min-w-[10rem] rounded-xl border border-paper-200 px-3 py-2 text-sm"
              value={accountStatus}
              onChange={(e) => {
                setAccountStatus(e.target.value);
                setOffset(0);
              }}
            >
              <option value="">Tümü</option>
              <option value="active">Aktif</option>
              <option value="suspended">Askıda</option>
              <option value="deletion_requested">Silme talebi</option>
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
                <th className="px-3 py-2">Admin kapsamı</th>
                <th className="px-3 py-2">Hesap durumu</th>
                <th className="px-3 py-2">Kayıt</th>
                <th className="px-3 py-2">Son giriş</th>
                <th className="px-3 py-2">Kayıt kodu</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-paper-800/55">
                    Yükleniyor…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-paper-800/55">
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
                    <td className="px-3 py-2 align-top">
                      <AdminScopeEditor
                        u={u}
                        token={token}
                        myId={myId}
                        canEdit={canEditAdminScope}
                        onDone={() => void load()}
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="mb-1 text-xs font-medium text-paper-800/55">{accountStatusLabel(u.account_status)}</div>
                      <AccountStatusEditor u={u} token={token} onDone={() => void load()} />
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

export default function AdminUsersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-paper-50 px-4 py-8 text-sm text-paper-800/55 sm:px-6">Yükleniyor…</div>
      }
    >
      <AdminUsersPageInner />
    </Suspense>
  );
}
