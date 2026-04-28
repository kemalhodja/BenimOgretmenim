"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearToken, getToken } from "../../lib/auth";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { makeRequestId } from "../../lib/requestId";

async function adminPanelFetch<T>(
  path: "/api/admin/pending-bank-transfers" | "/api/admin/approve-bank-transfer",
  token: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("accept", "application/json");
  headers.set("authorization", `Bearer ${token}`);
  if (!headers.has("x-request-id")) {
    headers.set("x-request-id", makeRequestId());
  }
  if (init?.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const res = await fetch(path, {
    ...init,
    headers,
    cache: "no-store",
  });
  const responseRequestId = res.headers.get("x-request-id") ?? undefined;
  const text = await res.text();
  const json = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const msg =
      typeof json === "object" && json && json !== null && "error" in json
        ? (json as { error?: unknown }).error
        : json;
    const bodyRid =
      typeof json === "object" && json && json !== null && "requestId" in json
        ? (json as { requestId?: unknown }).requestId
        : undefined;
    const rid =
      typeof bodyRid === "string" && bodyRid ? bodyRid : responseRequestId;
    const ridSuffix = rid ? ` (requestId=${rid})` : "";
    throw new Error(
      `[${res.status}] ${typeof msg === "string" ? msg : "request_failed"}${ridSuffix}`,
    );
  }
  return json as T;
}

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
  const [token, setToken] = useState<string | null>(null);
  const [items, setItems] = useState<PendingPayment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [router, pathname]);

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

  const load = useCallback(async (t: string, opts?: { showRefreshSpinner?: boolean }) => {
    if (opts?.showRefreshSpinner) setRefreshing(true);
    setError(null);
    try {
      const r = await adminPanelFetch<{ payments: PendingPayment[] }>(
        "/api/admin/pending-bank-transfers",
        t,
      );
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
  }, [router, pathname]);

  useEffect(() => {
    if (token) void load(token);
  }, [token, load]);

  async function approve(paymentId: string) {
    if (!token) return;
    setBusy(paymentId);
    setError(null);
    try {
      await adminPanelFetch("/api/admin/approve-bank-transfer", token, {
        method: "POST",
        body: JSON.stringify({ paymentId }),
      });
      await load(token);
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
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-medium text-zinc-500">Admin</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
              Havale / EFT onayı
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Giriş:{" "}
              <span className="font-mono">
                seed_dev@benimogretmenim.local
              </span>{" "}
              / <span className="font-mono">DevParola1</span>
            </p>
            <p className="mt-2 max-w-xl text-xs text-zinc-500">
              Üretimde API tarafında{" "}
              <span className="font-mono">ADMIN_API_SECRET</span> tanımlıysa,
              Next sunucusunda aynı değer ve{" "}
              <span className="font-mono">INTERNAL_API_BASE_URL</span> (Docker
              içi API adresi) ayarlanmalıdır; gizli anahtar tarayıcıya
              verilmez.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load(token, { showRefreshSpinner: true })}
              disabled={refreshing}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm disabled:opacity-50"
            >
              {refreshing ? "Yükleniyor..." : "Yenile"}
            </button>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Ana sayfa
            </Link>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-8 space-y-3">
          {items.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600 shadow-sm">
              Bekleyen havale yok.
            </div>
          ) : (
            items.map((p) => (
              <div
                key={p.id}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">
                      {p.teacher_display_name}
                    </div>
                    <div className="text-xs text-zinc-500">{p.teacher_email}</div>
                    <div className="mt-2 text-sm text-zinc-700">
                      Plan: <span className="font-mono">{p.plan_code}</span>
                      {" · "}
                      Tutar: {(p.amount_minor / 100).toFixed(2)} {p.currency}
                    </div>
                    {p.bank_ref && (
                      <div className="mt-1 text-xs text-zinc-500">
                        Dekont/ref: {p.bank_ref}
                      </div>
                    )}
                    <div className="mt-1 font-mono text-xs text-zinc-400">
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
            className="fixed bottom-6 left-1/2 z-50 w-[min(100%-2rem,28rem)] -translate-x-1/2 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-center text-sm font-medium text-brand-900 shadow-lg"
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
