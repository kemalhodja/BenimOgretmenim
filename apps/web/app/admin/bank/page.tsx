"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { clearToken } from "../../lib/auth";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { useRequireAdmin } from "../useRequireAdmin";

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

export default function AdminBankPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const token = useRequireAdmin();
  const [items, setItems] = useState<PendingPayment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 3200);
  }

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const load = useCallback(async (opts?: { showRefreshSpinner?: boolean }) => {
    if (!token) return;
    if (opts?.showRefreshSpinner) setRefreshing(true);
    setError(null);
    try {
      const r = await apiFetch<{ payments: PendingPayment[] }>("/api/admin/pending-bank-transfers", {
        token,
      });
      setItems(r.payments);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "load_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
        return;
      }
      if (msg.includes("[403]")) {
        setError("Bu sayfa yalnızca yönetici yetkisiyle kullanılabilir.");
      }
    } finally {
      if (opts?.showRefreshSpinner) setRefreshing(false);
    }
  }, [router, pathname, token]);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  async function approve(paymentId: string) {
    if (!token) return;
    setBusy(paymentId);
    setError(null);
    try {
      await apiFetch("/api/admin/approve-bank-transfer", {
        method: "POST",
        token,
        body: JSON.stringify({ paymentId }),
      });
      await load();
      showToast("Ödeme onaylandı, abonelik aktifleştirildi.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "approve_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Onay için yönetici yetkisi gerekir.");
      }
    } finally {
      setBusy(null);
    }
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Havale ve EFT onayı</h1>
          <p className="mt-1 text-sm text-paper-800/75">
            Bekleyen banka ödemelerini kontrol edin; onay işlemleri kayıt altına alınır.
          </p>
          <p className="mt-2 max-w-xl text-xs text-paper-800/55">
            Oturum cookie + CSRF ile güvenli proxy; gizli anahtar tarayıcıya verilmez.
          </p>
          <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <button
              type="button"
              onClick={() => void load({ showRefreshSpinner: true })}
              disabled={refreshing}
              className="font-medium text-brand-800 underline decoration-brand-400 underline-offset-4 disabled:opacity-50"
            >
              {refreshing ? "Yükleniyor…" : "Yenile"}
            </button>
            <Link
              href="/admin"
              className="text-paper-800/75 underline decoration-paper-300 underline-offset-4 hover:text-paper-900"
            >
              Operasyon özeti
            </Link>
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-8 space-y-3">
          {items.length === 0 ? (
            <div className="rounded-xl border border-paper-200 bg-white p-5 text-sm text-paper-800/75 shadow-sm">
              Bekleyen havale yok.
            </div>
          ) : (
            items.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-paper-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-paper-900">
                      {p.teacher_display_name}
                    </div>
                    <div className="text-xs text-paper-800/55">{p.teacher_email}</div>
                    <div className="mt-2 text-sm text-paper-800">
                      Plan: <span className="font-mono">{p.plan_code}</span>
                      {" · "}
                      Tutar: {(p.amount_minor / 100).toFixed(2)} {p.currency}
                    </div>
                    {p.bank_ref && (
                      <div className="mt-1 text-xs text-paper-800/55">
                        Dekont/ref: {p.bank_ref}
                      </div>
                    )}
                    <div className="mt-1 font-mono text-xs text-paper-800/45">
                      {p.id}
                    </div>
                  </div>
                  <button
                    onClick={() => approve(p.id)}
                    disabled={busy === p.id}
                    className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {busy === p.id ? "Onaylanıyor..." : "Onayla"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {toast && (
          <div
            role="status"
            className="fixed bottom-6 left-1/2 z-50 w-[min(100%-2rem,28rem)] -translate-x-1/2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-center text-sm font-medium text-brand-900 shadow-lg"
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
