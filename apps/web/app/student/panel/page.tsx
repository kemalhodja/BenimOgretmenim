"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { clearToken, getToken } from "../../lib/auth";

type SubMe = {
  active: boolean;
  subscription: { id: string; expires_at: string; months_count: number } | null;
  pricePerMonthMinor: number;
};

type Wallet = { balanceMinor: number; currency: string };

type LedgerEntry = {
  id: string;
  delta_minor: string;
  balance_after: string;
  kind: string;
  ref_type: string | null;
  ref_id: string | null;
  created_at: string;
};

type HoldsResponse = {
  holds?: Array<{
    id: string;
    amount_minor: string | number;
    currency: string;
    status: string;
    reason: string;
    ref_type: string | null;
    ref_id: string | null;
    created_at: string;
    updated_at: string;
  }>;
  activeHoldMinor: number;
};

function tl(minor: number): string {
  return (minor / 100).toFixed(2);
}

function tlMinor(v: string | number): string {
  const n = typeof v === "string" ? Number(v) : v;
  return (n / 100).toFixed(2);
}

export default function StudentPanelPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [sub, setSub] = useState<SubMe | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [activeHoldMinor, setActiveHoldMinor] = useState<number>(0);
  const [holds, setHolds] = useState<NonNullable<HoldsResponse["holds"]>>([]);
  const [months, setMonths] = useState(1);
  const [topupKurus, setTopupKurus] = useState(200000);
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
    const [s, w, l, h] = await Promise.all([
      apiFetch<SubMe>("/v1/student-platform/subscription/me", { token: t }),
      apiFetch<Wallet>("/v1/wallet/me", { token: t }),
      apiFetch<{ entries: LedgerEntry[] }>("/v1/wallet/ledger?limit=25", { token: t }),
      apiFetch<HoldsResponse>("/v1/wallet/holds?limit=50", { token: t }),
    ]);
    setSub(s);
    setWallet(w);
    setLedger(l.entries);
    setActiveHoldMinor(h.activeHoldMinor ?? 0);
    setHolds(h.holds ?? []);
  }, []);

  useEffect(() => {
    if (!token) return;
    load(token).catch((e) => {
      const msg = e instanceof Error ? e.message : "load_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
        return;
      }
      if (msg.includes("[403]")) {
        setError("Bu sayfa yalnızca öğrenci hesabı içindir.");
      }
    });
  }, [token, load, router, pathname]);

  async function topupWallet() {
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
      setOk("Cüzdan yükleme açıldı. Sonra sayfayı yenileyin.");
      await load(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "topup_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Cüzdan yüklemek için öğrenci hesabı gerekir.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function buySub() {
    if (!token) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const r = await apiFetch<{ next: { checkout: string } }>("/v1/student-platform/subscription/purchase", {
        method: "POST",
        token,
        body: JSON.stringify({ months }),
      });
      const ck = await apiFetch<{ iframeUrl: string }>(r.next.checkout, { token });
      window.open(ck.iframeUrl, "_blank", "noopener,noreferrer");
      setOk("Ödeme penceresi açıldı. Tamamlanınca bu sayfayı yenileyin.");
      await load(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "purchase_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Abonelik satın almak için öğrenci hesabı gerekir.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <div className="text-sm font-medium text-zinc-500">Öğrenci</div>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900">Abonelik & cüzdan</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Ders ilanı, ödev sorusu ve belirli özellikler için aylık platform aboneliği. Tutar: varsayılan{" "}
          {sub ? `${tl(sub.pricePerMonthMinor)} TL/ay` : "1000,00 TL/ay"} (kuruş: `STUDENT_SUB_PRICE_MINOR`).
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/student/odev-sor"
            className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
          >
            Foto + ödev sorusu gönder
          </Link>
          <Link
            href="/student/requests"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm"
          >
            Ders ilanı
          </Link>
          <Link
            href="/student/kurslar"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm"
          >
            Kurslarım
          </Link>
          <Link
            href="/student/dogrudan-dersler"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm"
          >
            Doğrudan ders
          </Link>
          <Link
            href="/student/grup-dersler"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm"
          >
            Grup ders
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

        <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Bakiye</h2>
          {wallet && (
            <p className="mt-1 text-2xl font-mono text-zinc-800">
              {tl(wallet.balanceMinor)} {wallet.currency}
            </p>
          )}
          <p className="mt-1 text-xs text-zinc-500">
            Bloke:{" "}
            <span className="font-mono font-medium text-zinc-800">
              {tl(activeHoldMinor)} TL
            </span>
            {wallet ? (
              <>
                {" · "}
                Kullanılabilir:{" "}
                <span className="font-mono font-medium text-zinc-800">
                  {tl(Math.max(0, wallet.balanceMinor - activeHoldMinor))} TL
                </span>
              </>
            ) : null}
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-sm">
              <span className="text-zinc-600">Yükle (kuruş, min 10000)</span>
              <input
                type="number"
                min={10000}
                step={1000}
                value={topupKurus}
                onChange={(e) => setTopupKurus(Number(e.target.value) || 10000)}
                className="ml-0 mt-1 block w-full max-w-xs rounded-lg border border-zinc-200 px-2 py-1 font-mono text-sm"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void topupWallet()}
              className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 disabled:opacity-50"
            >
              Cüzdanı PayTR ile yükle
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Blokajlar</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Grup ders katılımı gibi işlemlerde tutar bloke edilir; bazı blokajlar ders bitimine kadar
            kalkmayabilir.
          </p>
          <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-100">
            {holds.length === 0 ? (
              <p className="p-3 text-sm text-zinc-500">Blokaj yok.</p>
            ) : (
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="border-b border-zinc-100 bg-zinc-50 text-zinc-500">
                  <tr>
                    <th className="px-2 py-2">Tarih</th>
                    <th className="px-2 py-2">Durum</th>
                    <th className="px-2 py-2">Sebep</th>
                    <th className="px-2 py-2">Ref</th>
                    <th className="px-2 py-2 text-right">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {holds.slice(0, 50).map((h) => (
                    <tr key={h.id} className="border-b border-zinc-50">
                      <td className="px-2 py-2 font-mono text-zinc-600">
                        {new Date(h.created_at).toLocaleString("tr-TR")}
                      </td>
                      <td className="px-2 py-2 text-zinc-700">{h.status}</td>
                      <td className="px-2 py-2 text-zinc-800">{h.reason}</td>
                      <td className="px-2 py-2 font-mono text-zinc-600">
                        {(h.ref_type ?? "—") + (h.ref_id ? `:${h.ref_id.slice(0, 8)}` : "")}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-zinc-800">
                        {tlMinor(h.amount_minor)} {h.currency}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Son cüzdan hareketleri</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Yükleme, doğrudan ders bloke ödemesi vb. Son 25 kayıt.
          </p>
          <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-100">
            {ledger.length === 0 ? (
              <p className="p-3 text-sm text-zinc-500">Henüz hareket yok.</p>
            ) : (
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead className="border-b border-zinc-100 bg-zinc-50 text-zinc-500">
                  <tr>
                    <th className="px-2 py-2">Tarih</th>
                    <th className="px-2 py-2">Tür</th>
                    <th className="px-2 py-2 text-right">Değişim</th>
                    <th className="px-2 py-2 text-right">Bakiye</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((e) => (
                    <tr key={e.id} className="border-b border-zinc-50">
                      <td className="px-2 py-2 font-mono text-zinc-600">
                        {new Date(e.created_at).toLocaleString("tr-TR")}
                      </td>
                      <td className="px-2 py-2 text-zinc-800">{e.kind}</td>
                      <td className="px-2 py-2 text-right font-mono text-zinc-800">
                        {Number(e.delta_minor) >= 0 ? "+" : ""}
                        {tlMinor(e.delta_minor)} TL
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-zinc-600">
                        {tlMinor(e.balance_after)} TL
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Platform aboneliği</h2>
          {sub?.active && sub.subscription ? (
            <p className="mt-2 text-sm text-zinc-700">
              Aktif. Bitiş:{" "}
              <span className="font-mono text-zinc-800">
                {new Date(sub.subscription.expires_at).toLocaleString("tr-TR")}
              </span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-amber-800">Aboneliğiniz yok veya süresi dolmuş.</p>
          )}
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="text-zinc-600">Ay sayısı</span>
              <input
                type="number"
                min={1}
                max={60}
                value={months}
                onChange={(e) => setMonths(Number(e.target.value) || 1)}
                className="ml-2 w-20 rounded-lg border border-zinc-200 px-2 py-1 text-sm"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void buySub()}
              className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              PayTR ile satın al
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
