"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useRequireAdmin } from "../useRequireAdmin";

export default function AdminWalletPage() {
  const token = useRequireAdmin();
  const [grantUserId, setGrantUserId] = useState("");
  const [grantAmountMinor, setGrantAmountMinor] = useState("100000");
  const [grantReason, setGrantReason] = useState("ops grant");
  const [grantBusy, setGrantBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const grantTlPreview = useMemo(() => {
    const n = Number(grantAmountMinor);
    if (!Number.isFinite(n) || n <= 0) return "—";
    return (n / 100).toFixed(2);
  }, [grantAmountMinor]);

  const submitGrant = useCallback(async () => {
    if (!token) return;
    const amt = Number(grantAmountMinor);
    if (!grantUserId.trim()) {
      setError("userId gerekli (UUID).");
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("amountMinor geçersiz.");
      return;
    }
    if (!window.confirm(`${grantUserId} için ${grantTlPreview} TL (minor=${amt}) bakiye eklensin mi?`)) return;

    setGrantBusy(true);
    setError(null);
    setOk(null);
    try {
      await apiFetch("/api/admin/wallet-grant", {
        method: "POST",
        token,
        body: JSON.stringify({
          userId: grantUserId.trim(),
          amountMinor: Math.floor(amt),
          reason: grantReason.trim(),
        }),
      });
      setOk("Cüzdan grant başarılı.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "hata");
    } finally {
      setGrantBusy(false);
    }
  }, [token, grantAmountMinor, grantUserId, grantReason, grantTlPreview]);

  if (!token) return null;

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link
          href="/admin"
          className="text-sm font-medium text-brand-800 underline decoration-brand-400 underline-offset-4"
        >
          ← Özet
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-paper-900">Cüzdan grant</h1>
        <p className="mt-2 text-sm text-paper-800/75">
          Bir kullanıcı cüzdanına manuel bakiye ekler. Ledger&apos;a{" "}
          <span className="font-mono">wallet_admin_grant</span> olarak yazılır.
        </p>
        <p className="mt-2 text-sm text-paper-800/75">
          <strong>Ödev ödül havuzu:</strong> API&apos;de tanımlı{" "}
          <span className="font-mono">PLATFORM_HOMEWORK_WALLET_USER_ID</span> kullanıcısına düzenli grant verin;
          öğrenci onayıyla öğretmene giden tutar bu bakiyeden düşer (öğrenci cüzdanından değil).
        </p>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        ) : null}
        {ok ? (
          <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">{ok}</div>
        ) : null}

        <section className="mt-6 rounded-xl border border-paper-200 bg-white p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-paper-800">User ID (UUID)</span>
              <input
                className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2 font-mono text-xs"
                value={grantUserId}
                onChange={(e) => setGrantUserId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-paper-800">Amount minor (kuruş)</span>
              <input
                className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2 font-mono text-xs"
                value={grantAmountMinor}
                onChange={(e) => setGrantAmountMinor(e.target.value)}
                inputMode="numeric"
              />
              <div className="mt-1 text-xs text-paper-800/55">Önizleme: {grantTlPreview} TL</div>
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-paper-800">Reason</span>
              <input
                className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2 text-sm"
                value={grantReason}
                onChange={(e) => setGrantReason(e.target.value)}
              />
            </label>
            <div className="sm:col-span-2">
              <button
                type="button"
                disabled={grantBusy}
                onClick={() => void submitGrant()}
                className="w-full rounded-xl bg-brand-800 py-2.5 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-50"
              >
                {grantBusy ? "…" : "Bakiye ekle"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
