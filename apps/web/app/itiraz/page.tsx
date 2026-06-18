"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { clearToken, getToken } from "../lib/auth";
import { loginHrefWithReturn } from "../lib/authRedirect";

type Dispute = {
  id: string;
  subject_type: string;
  subject_id: string | null;
  status: string;
  reason: string;
  description: string;
  created_at: string;
  updated_at: string;
};

const SUBJECT_OPTIONS = [
  { value: "wallet_transaction", label: "Ödeme / cüzdan" },
  { value: "homework_post", label: "Ödev / soru" },
  { value: "lesson_package", label: "Ders paketi" },
  { value: "direct_booking", label: "Doğrudan ders" },
  { value: "course_enrollment", label: "Kurs kaydı" },
  { value: "teacher_withdrawal", label: "Para çekme (öğretmen)" },
  { value: "other", label: "Diğer" },
] as const;

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    open: "Açık",
    waiting_admin: "İnceleniyor",
    waiting_user: "Sizden yanıt bekleniyor",
    resolved: "Çözüldü",
    rejected: "Reddedildi",
  };
  return map[status] ?? status;
}

export default function ItirazPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [subjectType, setSubjectType] = useState<string>("other");
  const [subjectId, setSubjectId] = useState("");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [requestedResolution, setRequestedResolution] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [router, pathname]);

  const load = useCallback(async (t: string) => {
    const r = await apiFetch<{ disputes: Dispute[] }>("/v1/support/disputes", { token: t });
    setDisputes(r.disputes);
  }, []);

  useEffect(() => {
    if (!token) return;
    load(token).catch((e) => {
      const m = e instanceof Error ? e.message : "yüklenemedi";
      if (m.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
        return;
      }
      setError(m);
    });
  }, [token, load, router, pathname]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await apiFetch("/v1/support/disputes", {
        method: "POST",
        token,
        body: JSON.stringify({
          subjectType,
          subjectId: subjectId.trim() || undefined,
          reason: reason.trim(),
          description: description.trim(),
          requestedResolution: requestedResolution.trim() || undefined,
        }),
      });
      setOk("İtirazınız kaydedildi. Destek ekibi en geç 24 saat içinde yanıtlar.");
      setReason("");
      setDescription("");
      setRequestedResolution("");
      setSubjectId("");
      await load(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gönderilemedi");
    } finally {
      setBusy(false);
    }
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-paper-900">İtiraz ve anlaşmazlık</h1>
        <p className="mt-2 text-sm leading-relaxed text-paper-800/75">
          Ödeme, ders, ödev veya hesap durumu hakkında kayıt açın. Her itiraz numarası ile takip edilir; sebepsiz
          engel veya geciken ödeme şikayetlerine karşı şeffaf süreç.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/iade" className="text-brand-800 underline">
            İade politikası
          </Link>
          {" · "}
          <Link href="/yardim" className="text-brand-800 underline">
            Yardım
          </Link>
        </p>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        ) : null}
        {ok ? (
          <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">{ok}</div>
        ) : null}

        <form onSubmit={(e) => void submit(e)} className="mt-8 space-y-4 rounded-2xl border border-paper-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-paper-900">Yeni itiraz</h2>
          <label className="block text-sm">
            <span className="font-medium text-paper-800">Konu</span>
            <select
              value={subjectType}
              onChange={(e) => setSubjectType(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-paper-200 px-3 py-2 text-sm"
            >
              {SUBJECT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-paper-800">İlgili kayıt no (opsiyonel)</span>
            <input
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              placeholder="Ders, ödev veya işlem ID"
              className="mt-1 block w-full rounded-lg border border-paper-200 px-3 py-2 font-mono text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-paper-800">Kısa başlık</span>
            <input
              required
              minLength={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-paper-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-paper-800">Açıklama</span>
            <textarea
              required
              minLength={5}
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-paper-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-paper-800">Beklentiniz (opsiyonel)</span>
            <input
              value={requestedResolution}
              onChange={(e) => setRequestedResolution(e.target.value)}
              placeholder="Örn. iade, hesabın açılması"
              className="mt-1 block w-full rounded-lg border border-paper-200 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Gönderiliyor…" : "İtiraz gönder"}
          </button>
        </form>

        <h2 className="mt-10 text-sm font-semibold text-paper-900">İtirazlarım</h2>
        <ul className="mt-3 space-y-3">
          {disputes.length === 0 ? (
            <li className="rounded-xl border border-paper-200 bg-white p-4 text-sm text-paper-800/55">Henüz itiraz yok.</li>
          ) : (
            disputes.map((d) => (
              <li key={d.id} className="rounded-xl border border-paper-200 bg-white p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-paper-900">{d.reason}</span>
                  <span className="rounded-full bg-paper-100 px-2 py-0.5 text-xs font-medium text-paper-800">
                    {statusLabel(d.status)}
                  </span>
                </div>
                <p className="mt-2 text-paper-800/75">{d.description}</p>
                <p className="mt-2 font-mono text-[11px] text-paper-800/45">
                  {new Date(d.created_at).toLocaleString("tr-TR")} · {d.subject_type}
                  {d.subject_id ? ` · ${d.subject_id}` : ""}
                </p>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
