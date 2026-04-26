"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { clearToken, getToken } from "../../lib/auth";

type Wallet = { balanceMinor: number; currency: string; updatedAt: string | null };

type LedgerEntry = {
  id: string;
  delta_minor: string;
  balance_after: string;
  kind: string;
  ref_type: string | null;
  ref_id: string | null;
  created_at: string;
};

function tl(minor: number | string): string {
  const n = typeof minor === "string" ? Number(minor) : minor;
  return (n / 100).toFixed(2);
}

export default function TeacherCuzdanPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [topupKurus, setTopupKurus] = useState(200_000);
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
    const [w, l] = await Promise.all([
      apiFetch<Wallet>("/v1/wallet/me", { token: t }),
      apiFetch<{ entries: LedgerEntry[] }>("/v1/wallet/ledger?limit=50", { token: t }),
    ]);
    setWallet(w);
    setEntries(l.entries);
  }, []);

  useEffect(() => {
    if (!token) return;
    setError(null);
    load(token).catch((e) => {
      const m = e instanceof Error ? e.message : "yükleme";
      setError(m);
      if (m.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
        return;
      }
      if (m.includes("[403]")) {
        setError("Bu sayfa yalnızca öğretmen hesabı içindir.");
      }
    });
  }, [token, load, router, pathname]);

  async function topup() {
    if (!token) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      if (topupKurus < 10_000) throw new Error("En az 100,00 TL");
      const r = await apiFetch<{ next: { checkout: string } }>("/v1/wallet/topup", {
        method: "POST",
        token,
        body: JSON.stringify({ amountMinor: topupKurus }),
      });
      const ck = await apiFetch<{ iframeUrl: string }>(r.next.checkout, { token });
      window.open(ck.iframeUrl, "_blank", "noopener,noreferrer");
      setOk("Cüzdan yükleme açıldı. Sonra bu sayfayı yenileyin.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "hata";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Cüzdan yüklemek için öğretmen hesabı gerekir.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="text-sm text-zinc-500">Öğretmen</div>
        <h1 className="text-2xl font-semibold text-zinc-900">Cüzdan & hareketler</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Doğrudan ders anlaşmalarında (öğrenci ödeme tamamladığında) ödemeniz burada görünür.
          İsterseniz PayTR ile cüzdan yükleyerek de bakiye alabilirsiniz.
        </p>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm">
          <Link className="text-zinc-600 underline" href="/teacher">
            ← Panel
          </Link>
          <Link className="text-zinc-600 underline" href="/teacher/dogrudan-dersler">
            Doğrudan ders anlaşmaları
          </Link>
          <Link className="text-zinc-600 underline" href="/teacher/dersler">
            Ders oturumları
          </Link>
          <Link className="text-zinc-600 underline" href="/teacher/kurslar">
            Online kurslar
          </Link>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {ok && (
          <div className="mt-4 rounded-2xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">
            {ok}
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Bakiye</h2>
          {wallet && (
            <p className="mt-2 text-2xl font-mono text-zinc-800">
              {tl(wallet.balanceMinor)} {wallet.currency}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <label className="text-sm">
              <span className="text-zinc-600">PayTR ile yükle (kuruş, min 10.000)</span>
              <input
                type="number"
                min={10000}
                step={1000}
                value={topupKurus}
                onChange={(e) => setTopupKurus(Number(e.target.value) || 10_000)}
                className="ml-0 mt-1 block w-40 rounded-lg border border-zinc-200 px-2 py-1 font-mono text-sm"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void topup()}
              className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Yükle
            </button>
          </div>
        </div>

        <h2 className="mt-8 text-sm font-semibold text-zinc-900">Son hareketler</h2>
        <p className="text-xs text-zinc-500">
          Doğrudan ders ödemeleri: <code className="text-[11px]">direct_booking_payout</code> gibi
          türler burada listelenir.
        </p>
        <div className="mt-2 overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
          {entries.length === 0 ? (
            <p className="p-4 text-sm text-zinc-500">Henüz hareket yok.</p>
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Tarih</th>
                  <th className="px-3 py-2">Tür</th>
                  <th className="px-3 py-2 text-right">Değişim (TL)</th>
                  <th className="px-3 py-2 text-right">Bakiye (TL)</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-zinc-100">
                    <td className="px-3 py-2 font-mono text-xs text-zinc-600">
                      {new Date(e.created_at).toLocaleString("tr-TR")}
                    </td>
                    <td className="px-3 py-2 text-zinc-800">
                      {e.kind}
                      {e.ref_id ? (
                        <span className="ml-1 text-[10px] text-zinc-400">
                          ({e.ref_id.slice(0, 8)}…)
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-800">
                      {Number(e.delta_minor) >= 0 ? "+" : ""}
                      {tl(e.delta_minor)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-600">
                      {tl(e.balance_after)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
