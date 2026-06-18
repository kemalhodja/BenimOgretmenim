"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { clearToken, getToken } from "../../lib/auth";
import { loginHrefWithReturn } from "../../lib/authRedirect";

type MeResponse = {
  user: { id: string; email: string; display_name: string; role: string };
  account: {
    status: string;
    suspensionReason: string | null;
    suspendedAt: string | null;
    deletionRequestedAt: string | null;
    deletionReason: string | null;
  };
};

function statusLabel(status: string): string {
  if (status === "active") return "Aktif";
  if (status === "suspended") return "Askıda";
  if (status === "deletion_requested") return "Silme talebi alındı";
  return status;
}

export default function HesapAyarlarPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [reason, setReason] = useState("");
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
    const r = await apiFetch<MeResponse>("/v1/auth/me", { token: t });
    setMe(r);
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

  async function requestDeletion(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await apiFetch("/v1/auth/account/deletion-request", {
        method: "POST",
        token,
        body: JSON.stringify({ confirmEmail: confirmEmail.trim(), reason: reason.trim() }),
      });
      setOk("Hesap silme talebiniz alındı. Destek ekibi en geç 30 gün içinde işlemi tamamlar.");
      await load(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gönderilemedi");
    } finally {
      setBusy(false);
    }
  }

  async function cancelDeletion() {
    if (!token) return;
    if (!window.confirm("Silme talebini iptal etmek istediğinize emin misiniz?")) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await apiFetch("/v1/auth/account/deletion-request/cancel", { method: "POST", token });
      setOk("Silme talebi iptal edildi. Hesabınız aktif modda kullanılabilir.");
      await load(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "İptal edilemedi");
    } finally {
      setBusy(false);
    }
  }

  if (!token || !me) return null;

  const pendingDeletion = me.account.status === "deletion_requested";

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Hesap ayarları</h1>
        <p className="mt-2 text-sm leading-relaxed text-paper-800/75">
          KVKK kapsamında hesabınızı silme talebi oluşturabilirsiniz. Talep alındıktan sonra hesap kısıtlı modda kalır;
          verileriniz yasal saklama süreleri sonrası kalıcı olarak silinir.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link href="/gizlilik" className="text-brand-800 underline">
            Gizlilik politikası
          </Link>
          <Link href="/itiraz" className="text-brand-800 underline">
            İtiraz
          </Link>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        ) : null}
        {ok ? (
          <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">{ok}</div>
        ) : null}

        <div className="mt-8 rounded-2xl border border-paper-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-paper-900">Hesap özeti</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-paper-800/60">E-posta</dt>
              <dd className="font-medium text-paper-900">{me.user.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-paper-800/60">Durum</dt>
              <dd className="font-medium text-paper-900">{statusLabel(me.account.status)}</dd>
            </div>
            {me.account.deletionRequestedAt ? (
              <div className="flex justify-between gap-4">
                <dt className="text-paper-800/60">Silme talebi</dt>
                <dd className="text-paper-900">{new Date(me.account.deletionRequestedAt).toLocaleString("tr-TR")}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        {pendingDeletion ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-sm font-semibold text-amber-950">Silme talebi bekliyor</h2>
            <p className="mt-2 text-sm text-amber-900/80">
              {me.account.deletionReason ?? "Talebiniz destek ekibine iletildi."}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void cancelDeletion()}
              className="mt-4 rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-950 disabled:opacity-50"
            >
              Talebi iptal et
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => void requestDeletion(e)} className="mt-6 space-y-4 rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-red-900">Hesabı silme talebi</h2>
            <p className="text-sm text-paper-800/75">
              Bu işlem geri alınamaz. Aktif ders, ödeme veya çekim süreçleriniz varsa destek ekibi önce sizinle
              iletişime geçebilir.
            </p>
            <label className="block text-sm">
              <span className="font-medium text-paper-800">E-postanızı onaylayın</span>
              <input
                required
                type="email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={me.user.email}
                className="mt-1 block w-full rounded-lg border border-paper-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-paper-800">Neden (KVKK)</span>
              <textarea
                required
                minLength={10}
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Kısa açıklama"
                className="mt-1 block w-full rounded-lg border border-paper-200 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Gönderiliyor…" : "Silme talebi gönder"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
