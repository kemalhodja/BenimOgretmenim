"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useRequireAdmin } from "../useRequireAdmin";

type TeacherRow = {
  teacher_id: string;
  user_id: string;
  verification_status: string;
  teacher_created_at: string;
  email: string;
  display_name: string;
  last_login_at: string | null;
  city_name: string | null;
};

export default function AdminTeachersPage() {
  const token = useRequireAdmin();
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 30;
  const [rows, setRows] = useState<TeacherRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftVer, setDraftVer] = useState<Record<string, string>>({});
  const [busyTid, setBusyTid] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      if (appliedQ.trim()) sp.set("q", appliedQ.trim());
      sp.set("limit", String(limit));
      sp.set("offset", String(offset));
      const r = await apiFetch<{ teachers: TeacherRow[]; total: number }>(
        `/api/admin/teachers?${sp.toString()}`,
        { token },
      );
      setRows(r.teachers);
      setTotal(r.total);
      const d: Record<string, string> = {};
      for (const x of r.teachers) d[x.teacher_id] = x.verification_status;
      setDraftVer(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [token, appliedQ, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveVerification(teacherId: string, verificationStatus: string) {
    if (!token) return;
    if (!window.confirm(`Doğrulama durumu "${verificationStatus}" olarak kaydedilsin mi?`)) return;
    setBusyTid(teacherId);
    setError(null);
    try {
      await apiFetch(`/api/admin/teachers/${teacherId}/verification`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ verificationStatus }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "hata");
    } finally {
      setBusyTid(null);
    }
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-sm font-medium text-zinc-500">Yönetim</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Öğretmenler</h1>
          <Link href="/admin/merkez" className="text-sm font-medium text-brand-800 underline">
            Merkez
          </Link>
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
          <label className="block min-w-0 flex-1 text-sm">
            <span className="font-medium text-zinc-700">Arama</span>
            <input
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ad veya e-posta…"
            />
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
          Toplam {total} profil · sayfa {Math.floor(offset / limit) + 1}
        </p>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              <tr>
                <th className="px-3 py-2">Öğretmen</th>
                <th className="px-3 py-2">Doğrulama</th>
                <th className="px-3 py-2">Şehir</th>
                <th className="px-3 py-2">Profil</th>
                <th className="px-3 py-2 font-mono text-[11px]">teacher_id</th>
                <th className="px-3 py-2">Doğrulama yönet</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                    Yükleniyor…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                    Kayıt yok.
                  </td>
                </tr>
              ) : (
                rows.map((t) => (
                  <tr key={t.teacher_id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-3 py-2">
                      <div className="font-medium text-zinc-900">{t.display_name}</div>
                      <div className="text-xs text-zinc-600">{t.email}</div>
                    </td>
                    <td className="px-3 py-2 capitalize text-zinc-700">{t.verification_status}</td>
                    <td className="px-3 py-2 text-zinc-600">{t.city_name ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/ogretmenler/${t.teacher_id}`}
                        className="text-brand-800 underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Halka açık profil
                      </Link>
                    </td>
                    <td className="max-w-[7rem] truncate px-3 py-2 font-mono text-[11px] text-zinc-500">
                      {t.teacher_id}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1">
                        <select
                          className="rounded border border-zinc-200 px-1 py-1 text-xs capitalize"
                          value={draftVer[t.teacher_id] ?? t.verification_status}
                          onChange={(e) =>
                            setDraftVer((d) => ({ ...d, [t.teacher_id]: e.target.value }))
                          }
                        >
                          <option value="unverified">unverified</option>
                          <option value="pending">pending</option>
                          <option value="verified">verified</option>
                          <option value="rejected">rejected</option>
                        </select>
                        <button
                          type="button"
                          disabled={
                            busyTid === t.teacher_id ||
                            (draftVer[t.teacher_id] ?? t.verification_status) === t.verification_status
                          }
                          onClick={() =>
                            void saveVerification(
                              t.teacher_id,
                              draftVer[t.teacher_id] ?? t.verification_status,
                            )
                          }
                          className="rounded bg-zinc-900 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40"
                        >
                          {busyTid === t.teacher_id ? "…" : "Kaydet"}
                        </button>
                      </div>
                    </td>
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
