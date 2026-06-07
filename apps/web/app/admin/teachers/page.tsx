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
  profile_quality_score: number | null;
  has_video: boolean;
  has_exam_docs: boolean;
  branch_count: number;
  completed_sessions_count: number;
};

function verificationReadiness(t: TeacherRow): { label: string; className: string } {
  const score = t.profile_quality_score ?? 0;
  if (t.verification_status === "verified") {
    return { label: "Doğrulandı", className: "bg-brand-50 text-brand-900" };
  }
  if (score >= 70 && t.branch_count > 0 && (t.has_video || t.has_exam_docs)) {
    return { label: "Hazır görünüyor", className: "bg-brand-50 text-brand-900" };
  }
  if (score >= 40) {
    return { label: "Eksikler var", className: "bg-amber-50 text-amber-900" };
  }
  return { label: "Zayıf profil", className: "bg-red-50 text-red-800" };
}

function verificationStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    unverified: "Doğrulanmadı",
    pending: "İnceleme bekliyor",
    verified: "Doğrulandı",
    rejected: "Reddedildi",
  };
  return labels[status] ?? status;
}

export default function AdminTeachersPage() {
  const token = useRequireAdmin();
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [verificationFilter, setVerificationFilter] = useState("");
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
      if (verificationFilter) sp.set("verificationStatus", verificationFilter);
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
  }, [token, appliedQ, verificationFilter, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveVerification(teacherId: string, verificationStatus: string) {
    if (!token) return;
    if (!window.confirm(`Doğrulama durumu "${verificationStatusLabel(verificationStatus)}" olarak kaydedilsin mi?`)) return;
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
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Öğretmenler</h1>
          <Link
            href="/admin/merkez"
            className="text-sm font-medium text-brand-800 underline decoration-brand-400 underline-offset-4"
          >
            Merkez
          </Link>
        </div>

        <div className="mt-4 grid gap-3 rounded-xl border border-paper-200 bg-white p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:items-end">
          <label className="block min-w-0 flex-1 text-sm">
            <span className="font-medium text-paper-800">Arama</span>
            <input
              className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2 text-sm"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ad veya e-posta…"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-paper-800">Doğrulama durumu</span>
            <select
              className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2 text-sm"
              value={verificationFilter}
              onChange={(e) => {
                setVerificationFilter(e.target.value);
                setOffset(0);
              }}
            >
              <option value="">Tümü</option>
              <option value="pending">İnceleme bekliyor</option>
              <option value="unverified">Doğrulanmadı</option>
              <option value="verified">Doğrulandı</option>
              <option value="rejected">Reddedildi</option>
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
          Toplam {total} profil · sayfa {Math.floor(offset / limit) + 1}
        </p>

        <div className="mt-4 overflow-x-auto rounded-xl border border-paper-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-paper-200 bg-paper-50 text-xs font-semibold uppercase tracking-wide text-paper-800/75">
              <tr>
                <th className="px-3 py-2">Öğretmen</th>
                <th className="px-3 py-2">Doğrulama</th>
                <th className="px-3 py-2">Kalite</th>
                <th className="px-3 py-2">Şehir</th>
                <th className="px-3 py-2">Profil</th>
                <th className="px-3 py-2">Kayıt kodu</th>
                <th className="px-3 py-2">Doğrulama yönet</th>
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
                rows.map((t) => (
                  <tr key={t.teacher_id} className="border-b border-paper-100 last:border-0">
                    <td className="px-3 py-2">
                      <div className="font-medium text-paper-900">{t.display_name}</div>
                      <div className="text-xs text-paper-800/75">{t.email}</div>
                    </td>
                    <td className="px-3 py-2 text-paper-800">
                      <div>{verificationStatusLabel(t.verification_status)}</div>
                      {(() => {
                        const readiness = verificationReadiness(t);
                        return (
                          <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${readiness.className}`}>
                            {readiness.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2 text-paper-800">
                      <div className="font-mono text-xs font-semibold text-paper-900">
                        {t.profile_quality_score ?? 0}/100
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <span className="rounded bg-paper-100 px-1.5 py-0.5 text-[11px]">
                          {t.branch_count} branş
                        </span>
                        {t.has_video && (
                          <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[11px] text-brand-900">
                            video
                          </span>
                        )}
                        {t.has_exam_docs && (
                          <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[11px] text-brand-900">
                            doküman
                          </span>
                        )}
                        {t.completed_sessions_count > 0 && (
                          <span className="rounded bg-paper-100 px-1.5 py-0.5 text-[11px]">
                            {t.completed_sessions_count} ders
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-paper-800/75">{t.city_name ?? "—"}</td>
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
                    <td className="max-w-[7rem] truncate px-3 py-2 font-mono text-[11px] text-paper-800/55">
                      {t.teacher_id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1">
                        <select
                          className="rounded border border-paper-200 px-1 py-1 text-xs"
                          value={draftVer[t.teacher_id] ?? t.verification_status}
                          onChange={(e) =>
                            setDraftVer((d) => ({ ...d, [t.teacher_id]: e.target.value }))
                          }
                        >
                          <option value="unverified">Doğrulanmadı</option>
                          <option value="pending">İnceleme bekliyor</option>
                          <option value="verified">Doğrulandı</option>
                          <option value="rejected">Reddedildi</option>
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
                          className="rounded bg-brand-800 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40"
                        >
                          {busyTid === t.teacher_id ? "…" : "Kaydet"}
                        </button>
                        <button
                          type="button"
                          disabled={busyTid === t.teacher_id || t.verification_status === "verified"}
                          onClick={() => void saveVerification(t.teacher_id, "verified")}
                          className="rounded bg-brand-700 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40"
                        >
                          Hızlı onay
                        </button>
                        <button
                          type="button"
                          disabled={busyTid === t.teacher_id || t.verification_status === "rejected"}
                          onClick={() => void saveVerification(t.teacher_id, "rejected")}
                          className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-800 disabled:opacity-40"
                        >
                          Eksik
                        </button>
                      </div>
                    </td>
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
