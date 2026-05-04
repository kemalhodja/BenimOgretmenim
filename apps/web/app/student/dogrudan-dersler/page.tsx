"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { clearToken, getToken } from "../../lib/auth";

type DirectBooking = {
  id: string;
  teacher_id: string;
  agreed_amount_minor: string | number;
  status: string;
  funded_at: string | null;
  completed_at: string | null;
  created_at: string;
  teacher_display_name: string | null;
};

function minorToTl(v: string | number | null | undefined): string {
  if (v == null) return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "—";
  return (n / 100).toFixed(2);
}

function statusTr(s: string): string {
  const m: Record<string, string> = {
    pending_funding: "Ödeme bekleniyor",
    funded: "Ödeme alındı",
    completed: "Öğretmen tamamladı",
  };
  return m[s] ?? s;
}

export default function StudentDogrudanDerslerPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [rows, setRows] = useState<DirectBooking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [router, pathname]);

  const load = useCallback(async (t: string) => {
    const r = await apiFetch<{ bookings: DirectBooking[] }>(
      "/v1/student-platform/direct-bookings/mine",
      { token: t },
    );
    setRows(r.bookings);
  }, []);

  useEffect(() => {
    if (!token) return;
    setError(null);
    load(token).catch((e) => {
      const msg = e instanceof Error ? e.message : "load_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Bu sayfa yalnızca öğrenci hesabı ve aktif platform aboneliği içindir.");
      }
    });
  }, [token, load, router, pathname]);

  async function fund(bookingId: string) {
    if (!token) return;
    setBusyId(bookingId);
    setError(null);
    setOk(null);
    try {
      await apiFetch(`/v1/student-platform/direct-bookings/${bookingId}/fund-from-wallet`, {
        method: "POST",
        token,
      });
      await load(token);
      setOk("Ödeme cüzdanınızdan alındı. Öğretmen dersi tamamladığında işlem kapanır.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "fund_failed";
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
        return;
      }
      if (msg.includes("[403]")) {
        setError("Bu anlaşmaya ödeme yapma izniniz yok.");
        return;
      }
      if (msg.includes("insufficient_balance") || msg.includes("409")) {
        setError("Bakiye yetersiz. Cüzdan yükleyin (panel) ve tekrar deneyin.");
        return;
      }
      setError(msg);
    } finally {
      setBusyId(null);
    }
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <p className="text-sm font-medium text-zinc-500">Öğrenci</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
          Doğrudan ders anlaşmaları
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Öğretmen profilinden anlaşma açar, burada cüzdanınızdan ödersiniz. Dersi öğretmen
          portalında tamamladıktan sonra tutar ona ödenir.
        </p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link className="text-zinc-600 underline" href="/ogretmenler">
            Öğretmen ara
          </Link>
          <Link className="text-zinc-600 underline" href="/student/panel">
            Abonelik & cüzdan
          </Link>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}
        {ok && (
          <div className="mt-6 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
            {ok}
          </div>
        )}

        <div className="mt-8 space-y-3">
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
              Henüz anlaşma yok.{" "}
              <Link href="/ogretmenler" className="font-medium text-brand-800 underline">
                Öğretmen seçin
              </Link>{" "}
              ve anlaşma tutarını girin.
            </div>
          ) : (
            rows.map((b) => (
              <div
                key={b.id}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">
                      {b.teacher_display_name?.trim() ?? "Öğretmen"}
                    </div>
                    <div className="mt-1 font-mono text-xs text-zinc-500">{b.id}</div>
                    <div className="mt-2 text-xs text-zinc-600">
                      Tutar:{" "}
                      <span className="font-mono font-medium text-zinc-900">
                        {minorToTl(b.agreed_amount_minor)} TL
                      </span>
                      {" · "}
                      <span className="font-medium">{statusTr(b.status)}</span>
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {new Date(b.created_at).toLocaleString("tr-TR")}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                    {b.status === "pending_funding" && (
                      <button
                        type="button"
                        disabled={busyId === b.id}
                        onClick={() => void fund(b.id)}
                        className="rounded-xl bg-zinc-900 px-3 py-2 text-center text-sm font-medium text-white disabled:opacity-50"
                      >
                        {busyId === b.id ? "…" : "Cüzdanımdan öde"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
