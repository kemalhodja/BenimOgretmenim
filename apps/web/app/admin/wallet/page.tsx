"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useRequireAdmin } from "../useRequireAdmin";

type Overview = {
  wallets: {
    wallet_count: number;
    wallets_with_balance: number;
    total_balance_minor: string;
    max_balance_minor: string;
  };
  ledger24h: {
    ledger_count_24h: number;
    large_movements_24h: number;
    inflow_minor_24h: string;
    outflow_minor_24h: string;
  };
  topupsByState: Array<{ state: string; count: number; amount_minor: string }>;
  directBookingsByStatus: Array<{ status: string; count: number; amount_minor: string }>;
  studentPaymentsByState: Array<{ state: string; count: number; amount_minor: string }>;
};

type LedgerEntry = {
  id: string;
  user_id: string;
  delta_minor: string;
  balance_after: string;
  kind: string;
  ref_type: string | null;
  ref_id: string | null;
  created_at: string;
  user_email: string;
  user_display_name: string;
};

type TopupRow = {
  id: string;
  user_id: string;
  amount_minor: number;
  currency: string;
  method: string;
  state: string;
  merchant_oid: string | null;
  created_at: string;
  email: string;
  display_name: string;
};

function tl(minor: string | number | null | undefined): string {
  const n = Number(minor ?? 0);
  if (!Number.isFinite(n)) return "—";
  return `${(n / 100).toFixed(2)} TL`;
}

function topupStateLabel(state: string): string {
  const labels: Record<string, string> = {
    pending: "Onay bekliyor",
    paid: "Ödendi",
    failed: "Başarısız",
    cancelled: "İptal edildi",
  };
  return labels[state] ?? state;
}

function paymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    bank_transfer: "Havale/EFT",
    paytr_iframe: "Kart ile ödeme",
  };
  return labels[method] ?? method;
}

function ledgerKindLabel(kind: string): string {
  const labels: Record<string, string> = {
    wallet_admin_grant: "Admin bakiye ekledi",
    wallet_topup_paid: "Cüzdan yükleme",
    wallet_hold_created: "Ödeme güvenceye alındı",
    wallet_hold_captured: "Ödeme tahsil edildi",
    wallet_hold_released: "Tutar serbest bırakıldı",
    wallet_refund: "İade",
    teacher_payout: "Öğretmen kazancı",
  };
  return labels[kind] ?? kind;
}

export default function AdminWalletPage() {
  const token = useRequireAdmin();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [topups, setTopups] = useState<TopupRow[]>([]);
  const [ledgerUserId, setLedgerUserId] = useState("");
  const [ledgerKind, setLedgerKind] = useState("");
  const [onlyLarge, setOnlyLarge] = useState(true);
  const [topupState, setTopupState] = useState("");
  const [loadingOps, setLoadingOps] = useState(false);
  const [grantUserId, setGrantUserId] = useState("");
  const [grantAmountMinor, setGrantAmountMinor] = useState("100000");
  const [grantReason, setGrantReason] = useState("Admin bakiye ekleme");
  const [grantBusy, setGrantBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const grantTlPreview = useMemo(() => {
    const n = Number(grantAmountMinor);
    if (!Number.isFinite(n) || n <= 0) return "—";
    return (n / 100).toFixed(2);
  }, [grantAmountMinor]);

  const loadOps = useCallback(async () => {
    if (!token) return;
    setLoadingOps(true);
    setError(null);
    try {
      const ledgerSp = new URLSearchParams();
      ledgerSp.set("limit", "30");
      ledgerSp.set("offset", "0");
      if (ledgerUserId.trim()) ledgerSp.set("userId", ledgerUserId.trim());
      if (ledgerKind.trim()) ledgerSp.set("kind", ledgerKind.trim());
      if (onlyLarge) ledgerSp.set("minAbsMinor", "100000");

      const topupSp = new URLSearchParams();
      topupSp.set("limit", "20");
      topupSp.set("offset", "0");
      if (topupState) topupSp.set("state", topupState);

      const [overviewRes, ledgerRes, topupRes] = await Promise.all([
        apiFetch<Overview>("/api/admin/wallet-ops-overview", { token }),
        apiFetch<{ entries: LedgerEntry[] }>(`/api/admin/wallet-ledger?${ledgerSp.toString()}`, { token }),
        apiFetch<{ topups: TopupRow[] }>(`/api/admin/wallet-topups?${topupSp.toString()}`, { token }),
      ]);
      setOverview(overviewRes);
      setLedger(ledgerRes.entries);
      setTopups(topupRes.topups);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ops_load_failed");
    } finally {
      setLoadingOps(false);
    }
  }, [token, ledgerUserId, ledgerKind, onlyLarge, topupState]);

  useEffect(() => {
    void loadOps();
  }, [loadOps]);

  const submitGrant = useCallback(async () => {
    if (!token) return;
    const amt = Number(grantAmountMinor);
    if (!grantUserId.trim()) {
      setError("Kullanıcı kayıt kodu gerekli.");
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Tutar kuruş değeri geçersiz.");
      return;
    }
    if (!window.confirm(`${grantUserId} kullanıcısı için ${grantTlPreview} TL bakiye eklensin mi?`)) return;

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
      await loadOps();
    } catch (e) {
      setError(e instanceof Error ? e.message : "hata");
    } finally {
      setGrantBusy(false);
    }
  }, [token, grantAmountMinor, grantUserId, grantReason, grantTlPreview, loadOps]);

  if (!token) return null;

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Link
          href="/admin"
          className="text-sm font-medium text-brand-800 underline decoration-brand-400 underline-offset-4"
        >
          ← Özet
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-paper-900">Cüzdan operasyonları</h1>
        <p className="mt-2 text-sm text-paper-800/75">
          Bir kullanıcı cüzdanına manuel bakiye ekler ve tüm hareketler kayıt altına alınır.
        </p>
        <p className="mt-2 text-sm text-paper-800/75">
          <strong>Ödev ödül havuzu:</strong> API&apos;de tanımlı{" "}
              sistemde tanımlı ödev havuzu kullanıcısına düzenli bakiye ekleyin;
          öğrenci onayıyla öğretmene giden tutar bu bakiyeden düşer (öğrenci cüzdanından değil).
        </p>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        ) : null}
        {ok ? (
          <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">{ok}</div>
        ) : null}

        <section className="mt-6 grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-paper-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-paper-800/55">Toplam bakiye</div>
            <div className="mt-2 text-xl font-semibold text-paper-900">
              {tl(overview?.wallets.total_balance_minor)}
            </div>
            <div className="mt-1 text-xs text-paper-800/60">
              {overview?.wallets.wallets_with_balance ?? 0}/{overview?.wallets.wallet_count ?? 0} cüzdan aktif
            </div>
          </div>
          <div className="rounded-2xl border border-paper-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-paper-800/55">24s giriş</div>
            <div className="mt-2 text-xl font-semibold text-brand-900">{tl(overview?.ledger24h.inflow_minor_24h)}</div>
            <div className="mt-1 text-xs text-paper-800/60">
              {overview?.ledger24h.ledger_count_24h ?? 0} cüzdan hareketi
            </div>
          </div>
          <div className="rounded-2xl border border-paper-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-paper-800/55">24s çıkış</div>
            <div className="mt-2 text-xl font-semibold text-red-800">{tl(overview?.ledger24h.outflow_minor_24h)}</div>
            <div className="mt-1 text-xs text-paper-800/60">
              {overview?.ledger24h.large_movements_24h ?? 0} büyük hareket
            </div>
          </div>
          <div className="rounded-2xl border border-paper-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-paper-800/55">En yüksek bakiye</div>
            <div className="mt-2 text-xl font-semibold text-paper-900">{tl(overview?.wallets.max_balance_minor)}</div>
            <div className="mt-1 text-xs text-paper-800/60">Risk kontrol bilgisi</div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div className="rounded-xl border border-paper-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-paper-900">Cüzdan hareketleri</h2>
                <p className="mt-1 text-xs text-paper-800/55">Varsayılan olarak 1.000 TL+ hareketleri gösterir.</p>
              </div>
              <button
                type="button"
                onClick={() => void loadOps()}
                disabled={loadingOps}
                className="rounded-xl border border-paper-200 bg-white px-3 py-2 text-xs font-medium text-paper-900 disabled:opacity-50"
              >
                {loadingOps ? "Yükleniyor…" : "Yenile"}
              </button>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_160px_130px]">
              <input
                value={ledgerUserId}
                onChange={(e) => setLedgerUserId(e.target.value)}
                className="rounded-xl border border-paper-200 px-3 py-2 font-mono text-xs"
                placeholder="Kullanıcı kayıt kodu ile filtrele"
              />
              <input
                value={ledgerKind}
                onChange={(e) => setLedgerKind(e.target.value)}
                className="rounded-xl border border-paper-200 px-3 py-2 text-xs"
                placeholder="Hareket türü"
              />
              <label className="inline-flex items-center gap-2 rounded-xl border border-paper-200 px-3 py-2 text-xs text-paper-800">
                <input type="checkbox" checked={onlyLarge} onChange={(e) => setOnlyLarge(e.target.checked)} />
                Büyük hareket
              </label>
            </div>
            <div className="mt-4 space-y-2">
              {ledger.length === 0 ? (
                <p className="text-sm text-paper-800/55">Cüzdan hareketi yok.</p>
              ) : (
                ledger.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-paper-100 bg-paper-50 p-3 text-sm">
                    <div className="flex flex-wrap justify-between gap-2">
                      <div className="font-medium text-paper-900">{entry.user_display_name}</div>
                      <div className={Number(entry.delta_minor) < 0 ? "font-semibold text-red-800" : "font-semibold text-brand-900"}>
                        {tl(entry.delta_minor)}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-paper-800/55">
                      {entry.user_email} · {ledgerKindLabel(entry.kind)} · bakiye {tl(entry.balance_after)}
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-paper-800/45">
                      {entry.ref_type ? "İlgili kayıt" : "Genel kayıt"} · {new Date(entry.created_at).toLocaleString("tr-TR")}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-paper-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-paper-900">Cüzdan yüklemeleri</h2>
                <p className="mt-1 text-xs text-paper-800/55">Kart ve havale/EFT yüklemeleri.</p>
              </div>
              <select
                className="rounded-xl border border-paper-200 px-3 py-2 text-xs"
                value={topupState}
                onChange={(e) => setTopupState(e.target.value)}
              >
                <option value="">Tümü</option>
                <option value="pending">Onay bekliyor</option>
                <option value="paid">Ödendi</option>
                <option value="failed">Başarısız</option>
                <option value="cancelled">İptal edildi</option>
              </select>
            </div>
            <div className="mt-4 space-y-2">
              {topups.length === 0 ? (
                <p className="text-sm text-paper-800/55">Cüzdan yükleme kaydı yok.</p>
              ) : (
                topups.map((topup) => (
                  <div key={topup.id} className="rounded-xl border border-paper-100 bg-paper-50 p-3 text-sm">
                    <div className="flex flex-wrap justify-between gap-2">
                      <div className="font-medium text-paper-900">{topup.display_name}</div>
                      <div className="font-semibold text-paper-900">{tl(topup.amount_minor)}</div>
                    </div>
                    <div className="mt-1 text-xs text-paper-800/55">
                      {topup.email} · {paymentMethodLabel(topup.method)} · {topupStateLabel(topup.state)}
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-paper-800/45">
                      {topup.merchant_oid ?? topup.id} · {new Date(topup.created_at).toLocaleString("tr-TR")}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-paper-200 bg-white p-5">
          <h2 className="text-base font-semibold text-paper-900">Manuel bakiye ekle</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-paper-800">Kullanıcı kayıt kodu</span>
              <input
                className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2 font-mono text-xs"
                value={grantUserId}
                onChange={(e) => setGrantUserId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-paper-800">Tutar (kuruş)</span>
              <input
                className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2 font-mono text-xs"
                value={grantAmountMinor}
                onChange={(e) => setGrantAmountMinor(e.target.value)}
                inputMode="numeric"
              />
              <div className="mt-1 text-xs text-paper-800/55">Önizleme: {grantTlPreview} TL</div>
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-paper-800">Açıklama</span>
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
