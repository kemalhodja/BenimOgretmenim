"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { clearToken, getToken } from "../../lib/auth";

type Wallet = {
  balanceMinor: number;
  activeHoldMinor?: number;
  availableMinor?: number;
  currency: string;
  updatedAt: string | null;
};

type LedgerEntry = {
  id: string;
  delta_minor: string;
  balance_after: string;
  kind: string;
  ref_type: string | null;
  ref_id: string | null;
  created_at: string;
};

type CoursePayout = {
  id: string;
  course_title: string;
  cohort_title: string;
  session_title: string | null;
  scheduled_start: string | null;
  hourly_rate_minor: number;
  duration_minutes: number;
  amount_minor: number;
  currency: string;
  status: string;
  paid_at: string | null;
};

type CoursePayoutSummary = {
  paidCount: number;
  paidAmountMinor: number;
};

type Withdrawal = {
  id: string;
  amount_minor: number | string;
  currency: string;
  iban: string;
  account_holder_name: string;
  bank_name: string | null;
  status: "pending" | "paid" | "rejected";
  requested_at: string;
  decided_at: string | null;
  paid_at: string | null;
  admin_note: string | null;
  bank_receipt_ref: string | null;
};

function tl(minor: number | string): string {
  const n = typeof minor === "string" ? Number(minor) : minor;
  return (n / 100).toFixed(2);
}

function tlToMinor(value: string): number {
  return Math.max(0, Math.round(Number(value.replace(",", ".") || "0") * 100));
}

function withdrawalStatusLabel(status: Withdrawal["status"]): string {
  if (status === "pending") return "Admin onayında";
  if (status === "paid") return "Ödendi";
  if (status === "rejected") return "Reddedildi";
  return status;
}

export default function TeacherCuzdanPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [coursePayouts, setCoursePayouts] = useState<CoursePayout[]>([]);
  const [coursePayoutSummary, setCoursePayoutSummary] = useState<CoursePayoutSummary | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [topupKurus, setTopupKurus] = useState(200_000);
  const [withdrawAmountTl, setWithdrawAmountTl] = useState("");
  const [withdrawIban, setWithdrawIban] = useState("");
  const [withdrawHolder, setWithdrawHolder] = useState("");
  const [withdrawBank, setWithdrawBank] = useState("");
  const [busy, setBusy] = useState(false);
  const [withdrawBusy, setWithdrawBusy] = useState(false);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [router, pathname]);

  const load = useCallback(async (t: string) => {
    const [w, l, p, wd] = await Promise.all([
      apiFetch<Wallet>("/v1/wallet/me", { token: t }),
      apiFetch<{ entries: LedgerEntry[] }>("/v1/wallet/ledger?limit=50", { token: t }),
      apiFetch<{ payouts: CoursePayout[]; summary: CoursePayoutSummary }>("/v1/wallet/course-payouts?limit=20", { token: t }),
      apiFetch<{ withdrawals: Withdrawal[] }>("/v1/wallet/withdrawals?limit=20", { token: t }),
    ]);
    setWallet(w);
    setEntries(l.entries);
    setCoursePayouts(p.payouts);
    setCoursePayoutSummary(p.summary);
    setWithdrawals(wd.withdrawals);
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

  async function requestWithdrawal() {
    if (!token) return;
    setWithdrawBusy(true);
    setError(null);
    setOk(null);
    try {
      const amountMinor = tlToMinor(withdrawAmountTl);
      if (amountMinor < 10_000) throw new Error("En az 100,00 TL çekim talebi oluşturabilirsiniz.");
      if (wallet && amountMinor > (wallet.availableMinor ?? wallet.balanceMinor)) {
        throw new Error("Kullanılabilir bakiyeniz bu çekim talebi için yetersiz.");
      }
      await apiFetch<{ withdrawal: Withdrawal }>("/v1/wallet/withdrawals", {
        method: "POST",
        token,
        body: JSON.stringify({
          amountMinor,
          iban: withdrawIban,
          accountHolderName: withdrawHolder,
          bankName: withdrawBank.trim() || undefined,
        }),
      });
      setOk("Para çekme talebiniz alındı. Tutar cüzdanınızda ayrıldı; admin ödemeyi tamamlayınca durum güncellenecek.");
      setWithdrawAmountTl("");
      setWithdrawIban("");
      setWithdrawHolder("");
      setWithdrawBank("");
      await load(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "çekim talebi oluşturulamadı";
      setError(
        msg.includes("insufficient_available_balance")
          ? "Kullanılabilir bakiyeniz bu çekim talebi için yetersiz."
          : msg.includes("Invalid")
            ? "IBAN, ad soyad veya tutar bilgilerini kontrol edin."
            : msg,
      );
    } finally {
      setWithdrawBusy(false);
    }
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-3xl px-6 py-8">
                <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Cüzdan ve hareketler</h1>
        <p className="mt-1 text-sm text-paper-800/75">
          Doğrudan ders anlaşmaları ve kurs ders saat hakedişleri burada görünür.
          Öğrenci platforma ödeme yapar; kurs başladığında belirlenen saatlik ücret cüzdanınıza yatırılır.
        </p>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm">
          <Link className="text-paper-800/75 underline" href="/teacher">
            ← Panel
          </Link>
          <Link className="text-paper-800/75 underline" href="/teacher/dogrudan-dersler">
            Doğrudan ders anlaşmaları
          </Link>
          <Link className="text-paper-800/75 underline" href="/teacher/dersler">
            Ders oturumları
          </Link>
          <Link className="text-paper-800/75 underline" href="/teacher/kurslar">
            Online kurslar
          </Link>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {ok && (
          <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">
            {ok}
          </div>
        )}

        <div className="mt-6 rounded-xl border border-paper-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-paper-900">Bakiye</h2>
          {wallet && (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-paper-200 bg-paper-50 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-paper-800/50">Toplam bakiye</div>
                <div className="mt-1 font-mono text-xl font-semibold text-paper-900">
                  {tl(wallet.balanceMinor)} {wallet.currency}
                </div>
              </div>
              <div className="rounded-xl border border-paper-200 bg-paper-50 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-paper-800/50">Blokede</div>
                <div className="mt-1 font-mono text-xl font-semibold text-paper-900">
                  {tl(wallet.activeHoldMinor ?? 0)} {wallet.currency}
                </div>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-900/60">Çekilebilir</div>
                <div className="mt-1 font-mono text-xl font-semibold text-emerald-950">
                  {tl(wallet.availableMinor ?? wallet.balanceMinor)} {wallet.currency}
                </div>
              </div>
            </div>
          )}
          <p className="mt-3 text-xs leading-relaxed text-paper-800/60">
            Para çekme talebi oluşturulduğunda tutar toplam bakiyeden düşer ve admin ödeme sürecine alınır.
            Aktif blokeler çekilebilir tutardan ayrıca düşülür.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <label className="text-sm">
              <span className="text-paper-800/75">PayTR ile yükle (kuruş, min 10.000)</span>
              <input
                type="number"
                min={10000}
                step={1000}
                value={topupKurus}
                onChange={(e) => setTopupKurus(Number(e.target.value) || 10_000)}
                className="ml-0 mt-1 block w-40 rounded-lg border border-paper-200 px-2 py-1 font-mono text-sm"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void topup()}
              className="rounded-xl bg-brand-800 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Yükle
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-paper-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-paper-900">Para çekme</h2>
              <p className="mt-1 text-xs text-paper-800/60">
                Talep oluşturunca tutar cüzdanınızdan ayrılır. Admin banka transferini tamamlayınca durum “Ödendi” olur.
              </p>
            </div>
            <div className="text-xs text-paper-800/55">Minimum 100,00 TL</div>
          </div>
          <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
            Çekilebilir bakiye:{" "}
            <span className="font-mono font-semibold">
              {wallet ? tl(wallet.availableMinor ?? wallet.balanceMinor) : "0.00"} {wallet?.currency ?? "TRY"}
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="font-medium text-paper-800">Tutar (TL)</span>
              <input
                type="text"
                inputMode="decimal"
                value={withdrawAmountTl}
                onChange={(e) => setWithdrawAmountTl(e.target.value)}
                placeholder="1000,00"
                className="mt-1 block w-full rounded-lg border border-paper-200 px-3 py-2 font-mono text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium text-paper-800">Banka adı (opsiyonel)</span>
              <input
                type="text"
                value={withdrawBank}
                onChange={(e) => setWithdrawBank(e.target.value)}
                placeholder="Banka"
                className="mt-1 block w-full rounded-lg border border-paper-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="font-medium text-paper-800">IBAN</span>
              <input
                type="text"
                value={withdrawIban}
                onChange={(e) => setWithdrawIban(e.target.value)}
                placeholder="TR..."
                className="mt-1 block w-full rounded-lg border border-paper-200 px-3 py-2 font-mono text-sm uppercase"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="font-medium text-paper-800">Hesap sahibi ad soyad</span>
              <input
                type="text"
                value={withdrawHolder}
                onChange={(e) => setWithdrawHolder(e.target.value)}
                placeholder="Ad Soyad"
                className="mt-1 block w-full rounded-lg border border-paper-200 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={withdrawBusy}
            onClick={() => void requestWithdrawal()}
            className="mt-4 rounded-xl bg-paper-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {withdrawBusy ? "Gönderiliyor…" : "Para çekme talebi oluştur"}
          </button>

          <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-paper-800/55">Çekim talepleri</h3>
          <div className="mt-2 overflow-x-auto rounded-xl border border-paper-200 bg-paper-50">
            {withdrawals.length === 0 ? (
              <p className="p-4 text-sm text-paper-800/55">Henüz para çekme talebi yok.</p>
            ) : (
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-paper-200 bg-white text-xs text-paper-800/55">
                  <tr>
                    <th className="px-3 py-2">Tarih</th>
                    <th className="px-3 py-2">IBAN</th>
                    <th className="px-3 py-2 text-right">Tutar</th>
                    <th className="px-3 py-2">Durum</th>
                    <th className="px-3 py-2">Admin notu</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((w) => (
                    <tr key={w.id} className="border-b border-paper-100 last:border-0">
                      <td className="px-3 py-2 font-mono text-xs text-paper-800/70">
                        {new Date(w.requested_at).toLocaleString("tr-TR")}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-paper-800">
                        {w.iban.slice(0, 6)}…{w.iban.slice(-4)}
                        <div className="font-sans text-[11px] text-paper-800/55">{w.account_holder_name}</div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-paper-900">
                        {tl(w.amount_minor)} {w.currency}
                      </td>
                      <td className="px-3 py-2 text-paper-800">{withdrawalStatusLabel(w.status)}</td>
                      <td className="max-w-[16rem] truncate px-3 py-2 text-paper-800/70">
                        {w.admin_note || w.bank_receipt_ref || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-brand-100 bg-brand-50 p-5 shadow-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-brand-950">Kurs hakedişleri</h2>
              <p className="mt-1 text-xs text-brand-950/70">
                Komisyon yok: kurs oturumu başladıktan sonra ders saat ücretiniz hakediş olarak yatırılır.
              </p>
            </div>
            <div className="rounded-xl bg-white px-3 py-2 text-right text-sm ring-1 ring-brand-100">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-950/55">Toplam hakediş</div>
              <div className="font-mono text-lg font-semibold text-brand-950">
                {tl(coursePayoutSummary?.paidAmountMinor ?? 0)} TRY
              </div>
              <div className="text-xs text-brand-950/60">{coursePayoutSummary?.paidCount ?? 0} ders</div>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto rounded-xl border border-brand-100 bg-white">
            {coursePayouts.length === 0 ? (
              <p className="p-4 text-sm text-paper-800/55">Henüz kurs hakedişi yok.</p>
            ) : (
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-brand-100 bg-brand-50 text-xs text-brand-950/65">
                  <tr>
                    <th className="px-3 py-2">Ders</th>
                    <th className="px-3 py-2">Tarih</th>
                    <th className="px-3 py-2 text-right">Saat ücreti</th>
                    <th className="px-3 py-2 text-right">Süre</th>
                    <th className="px-3 py-2 text-right">Hakediş</th>
                    <th className="px-3 py-2">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {coursePayouts.map((p) => (
                    <tr key={p.id} className="border-b border-brand-50 last:border-0">
                      <td className="px-3 py-2 text-paper-900">
                        <div className="font-medium">{p.course_title}</div>
                        <div className="text-xs text-paper-800/55">
                          {p.cohort_title} · {p.session_title ?? "Ders"}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-paper-800/70">
                        {p.scheduled_start ? new Date(p.scheduled_start).toLocaleString("tr-TR") : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-paper-800">{tl(p.hourly_rate_minor)} {p.currency}</td>
                      <td className="px-3 py-2 text-right font-mono text-paper-800">{p.duration_minutes} dk</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-brand-950">
                        {tl(p.amount_minor)} {p.currency}
                      </td>
                      <td className="px-3 py-2 text-paper-800">{p.status === "wallet_paid" ? "Cüzdana yatırıldı" : p.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <h2 className="mt-8 text-sm font-semibold text-paper-900">Son hareketler</h2>
        <p className="text-xs text-paper-800/55">
          Doğrudan ders ödemeleri: <code className="text-[11px]">direct_booking_payout</code> gibi
          türler burada listelenir.
        </p>
        <div className="mt-2 overflow-x-auto rounded-xl border border-paper-200 bg-white shadow-sm">
          {entries.length === 0 ? (
            <p className="p-4 text-sm text-paper-800/55">Henüz hareket yok.</p>
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-paper-200 bg-paper-50 text-xs text-paper-800/55">
                <tr>
                  <th className="px-3 py-2">Tarih</th>
                  <th className="px-3 py-2">Tür</th>
                  <th className="px-3 py-2 text-right">Değişim (TL)</th>
                  <th className="px-3 py-2 text-right">Bakiye (TL)</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-paper-100">
                    <td className="px-3 py-2 font-mono text-xs text-paper-800/75">
                      {new Date(e.created_at).toLocaleString("tr-TR")}
                    </td>
                    <td className="px-3 py-2 text-paper-800">
                      {e.kind}
                      {e.ref_id ? (
                        <span className="ml-1 text-[10px] text-paper-800/45">
                          ({e.ref_id.slice(0, 8)}…)
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-paper-800">
                      {Number(e.delta_minor) >= 0 ? "+" : ""}
                      {tl(e.delta_minor)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-paper-800/75">
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
