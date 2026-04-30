"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../lib/api";
import { clearToken, getRoleFromToken, getToken } from "../lib/auth";
import { loginHrefWithReturn } from "../lib/authRedirect";

type PendingPayment = {
  id: string;
  teacher_id: string;
  plan_code: string;
  amount_minor: number;
  currency: string;
  bank_ref: string | null;
  created_at: string;
  teacher_display_name: string;
  teacher_email: string;
};

export default function AdminPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";

  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<"bank" | "wallet">("bank");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [approveBusyId, setApproveBusyId] = useState<string | null>(null);

  const [grantUserId, setGrantUserId] = useState("");
  const [grantAmountMinor, setGrantAmountMinor] = useState("100000");
  const [grantReason, setGrantReason] = useState("ops grant");
  const [grantBusy, setGrantBusy] = useState(false);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    const role = getRoleFromToken(t);
    if (role !== "admin") {
      router.replace("/panel");
      return;
    }
    setToken(t);
  }, [router, pathname]);

  const loadPending = useCallback(async () => {
    if (!token) return;
    setLoadingPayments(true);
    setError(null);
    try {
      const r = await apiFetch<{ payments: PendingPayment[] }>("/admin/api/pending-bank-transfers", {
        token,
      });
      setPayments(Array.isArray(r.payments) ? r.payments : []);
    } catch (e) {
      const m = e instanceof Error ? e.message : "yükle";
      setError(m);
      if (m.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
    } finally {
      setLoadingPayments(false);
    }
  }, [token, router, pathname]);

  useEffect(() => {
    if (!token) return;
    void loadPending();
  }, [token, loadPending]);

  const approve = useCallback(
    async (paymentId: string) => {
      if (!token) return;
      if (!window.confirm("Bu havaleyi onaylayıp öğretmen aboneliğini aktifleştireyim mi?")) return;
      setApproveBusyId(paymentId);
      setError(null);
      setOk(null);
      try {
        await apiFetch("/admin/api/approve-bank-transfer", {
          method: "POST",
          token,
          body: JSON.stringify({ paymentId }),
        });
        setOk("Onaylandı.");
        await loadPending();
      } catch (e) {
        setError(e instanceof Error ? e.message : "hata");
      } finally {
        setApproveBusyId(null);
      }
    },
    [token, loadPending],
  );

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
      await apiFetch("/admin/api/wallet-grant", {
        method: "POST",
        token,
        body: JSON.stringify({ userId: grantUserId.trim(), amountMinor: Math.floor(amt), reason: grantReason.trim() }),
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
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="text-sm text-zinc-500">Admin</div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-zinc-900">Yönetim Paneli</h1>
          <Link href="/panel" className="text-sm font-medium text-brand-800 underline">
            Panel’e dön
          </Link>
        </div>

        <p className="mt-2 text-sm text-zinc-600">
          Bu sayfa yalnızca <strong>admin</strong> token’ı ile açılır. Havale onayı ve ops cüzdan grant
          işlemleri içindir.
        </p>

        <div className="mt-5 flex gap-2 border-b border-zinc-200 pb-2">
          <button
            type="button"
            onClick={() => setTab("bank")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === "bank" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            Havale onayı
          </button>
          <button
            type="button"
            onClick={() => setTab("wallet")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === "wallet" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            Cüzdan grant
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        ) : null}
        {ok ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            {ok}
          </div>
        ) : null}

        {tab === "bank" ? (
          <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-900">
                Bekleyen havale/EFT ödemeleri
              </h2>
              <button
                type="button"
                onClick={() => void loadPending()}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-900"
              >
                Yenile
              </button>
            </div>
            {loadingPayments ? (
              <p className="mt-3 text-sm text-zinc-500">Yükleniyor…</p>
            ) : payments.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">Bekleyen ödeme yok.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {payments.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-zinc-200 bg-zinc-50/40 p-4 text-sm">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="font-medium text-zinc-900">
                          {p.teacher_display_name}{" "}
                          <span className="text-xs text-zinc-600">· {p.teacher_email}</span>
                        </div>
                        <div className="mt-1 text-xs text-zinc-600">
                          Plan: <span className="font-mono">{p.plan_code}</span> · Tutar:{" "}
                          <strong>{(p.amount_minor / 100).toFixed(2)} {p.currency}</strong>
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          Tarih: {new Date(p.created_at).toLocaleString("tr-TR")} · Bank ref:{" "}
                          <span className="font-mono">{p.bank_ref ?? "—"}</span>
                        </div>
                        <div className="mt-1 text-[11px] text-zinc-500">
                          paymentId: <span className="font-mono">{p.id}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={approveBusyId === p.id}
                        onClick={() => void approve(p.id)}
                        className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {approveBusyId === p.id ? "…" : "Onayla"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-900">Cüzdan grant</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Bir kullanıcı cüzdanına manuel bakiye ekler. Bu işlem ledger’a <span className="font-mono">wallet_admin_grant</span>{" "}
              olarak yazılır.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium text-zinc-700">User ID (UUID)</span>
                <input
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 font-mono text-xs"
                  value={grantUserId}
                  onChange={(e) => setGrantUserId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-zinc-700">Amount minor (kuruş)</span>
                <input
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 font-mono text-xs"
                  value={grantAmountMinor}
                  onChange={(e) => setGrantAmountMinor(e.target.value)}
                  inputMode="numeric"
                />
                <div className="mt-1 text-xs text-zinc-500">Önizleme: {grantTlPreview} TL</div>
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="font-medium text-zinc-700">Reason</span>
                <input
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                  value={grantReason}
                  onChange={(e) => setGrantReason(e.target.value)}
                />
              </label>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  disabled={grantBusy}
                  onClick={() => void submitGrant()}
                  className="w-full rounded-xl bg-brand-700 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {grantBusy ? "…" : "Bakiye ekle"}
                </button>
              </div>
            </div>
          </section>
        )}

        <div className="mt-6 text-xs text-zinc-500">
          İpucu: Render’da <span className="font-mono">ADMIN_API_SECRET</span> tanımlıysa, havale onayı uçları bu
          sayfadaki Next proxy üzerinden otomatik başlıkla çağrılır.
        </div>
      </div>
    </div>
  );
}

