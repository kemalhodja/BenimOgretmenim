"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useRequireAdmin } from "../useRequireAdmin";

type Settings = {
  enabled: boolean;
  autoApproveEnabled: boolean;
  maxAmountMinor: number;
  requireVerified: boolean;
  requireSameIbanAsLastPaid: boolean;
  minPriorPaidCount: number;
  maxDailyAutoApprovals: number;
};

export default function AdminOtomatikCekimPage() {
  const token = useRequireAdmin();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const r = await apiFetch<{ settings: Settings }>("/api/admin/ops-settings/teacher-auto-withdrawal", { token });
    setSettings(r.settings);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    load().catch((e) => setError(e instanceof Error ? e.message : "yüklenemedi"));
  }, [token, load]);

  async function save() {
    if (!token || !settings) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const r = await apiFetch<{ settings: Settings }>("/api/admin/ops-settings/teacher-auto-withdrawal", {
        method: "PATCH",
        token,
        body: JSON.stringify(settings),
      });
      setSettings(r.settings);
      setOk("Kurallar kaydedildi.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "kaydedilemedi");
    } finally {
      setBusy(false);
    }
  }

  async function applyEligible() {
    if (!token) return;
    if (!window.confirm("Otomatik uygun bekleyen çekimleri onaylamak istediğinize emin misiniz?")) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const r = await apiFetch<{ approved: number; scanned: number }>(
        "/api/admin/teacher-withdrawals/apply-auto-eligible",
        { method: "POST", token },
      );
      setOk(`${r.approved}/${r.scanned} talep otomatik onaylandı.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "uygulanamadı");
    } finally {
      setBusy(false);
    }
  }

  if (!token || !settings) return null;

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <Link href="/admin/merkez" className="text-sm text-brand-800 underline">
          ← Merkez
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-paper-900">Otomatik para çekme kuralları</h1>
        <p className="mt-2 text-sm text-paper-800/75">
          Doğrulanmış öğretmenler için limit içi çekimler otomatik uygun olarak işaretlenir. Tam otomatik onay varsayılan
          kapalıdır; açmadan önce banka sürecinizi test edin.
        </p>

        {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
        {ok ? <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">{ok}</div> : null}

        <div className="mt-6 space-y-4 rounded-2xl border border-paper-200 bg-white p-5 shadow-sm">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
            />
            Kuralları etkinleştir (uygunluk etiketi)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.autoApproveEnabled}
              onChange={(e) => setSettings({ ...settings, autoApproveEnabled: e.target.checked })}
            />
            Otomatik onay (üretimde dikkatli açın)
          </label>
          <label className="block text-sm">
            <span className="font-medium">Üst limit (kuruş)</span>
            <input
              type="number"
              min={10000}
              value={settings.maxAmountMinor}
              onChange={(e) => setSettings({ ...settings, maxAmountMinor: Number(e.target.value) || 10000 })}
              className="mt-1 block w-full rounded-lg border border-paper-200 px-3 py-2 font-mono text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.requireVerified}
              onChange={(e) => setSettings({ ...settings, requireVerified: e.target.checked })}
            />
            Yalnızca doğrulanmış öğretmen
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.requireSameIbanAsLastPaid}
              onChange={(e) => setSettings({ ...settings, requireSameIbanAsLastPaid: e.target.checked })}
            />
            Aynı IBAN ile önceki başarılı ödeme şartı
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Kaydet
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void applyEligible()}
              className="rounded-xl border border-paper-300 bg-white px-4 py-2 text-sm font-semibold text-paper-900 disabled:opacity-50"
            >
              Uygun bekleyenleri onayla
            </button>
            <Link href="/admin/veri?k=teacher-withdrawals&autoEligible=1" className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-900">
              Uygun kuyruk
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
