"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "bmo-home-launch-announcement-dismissed-v1";

export function HomeLaunchAnnouncement() {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  if (!mounted || dismissed) return null;

  return (
    <section className="border-b border-warm-200 bg-[linear-gradient(90deg,#fff7ed_0%,#ecfeff_100%)]" aria-label="Erken erişim kampanyası">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between sm:px-6">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-warm-800">
            İlk 500 öğretmene erken erişim hediyesi
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-warm-950">
            Kampanya çok basit: 6 ay abonelik alan öğretmene{" "}
            <span className="font-bold">24 ay ücretsiz hediye süre</span>, 12 ay abonelik alan öğretmene{" "}
            <span className="font-bold">48 ay ücretsiz hediye süre</span> veriyoruz. 9 Eylül’e kadar veya ilk 500 öğretmen dolana kadar geçerlidir.
          </p>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
            <div className="rounded-xl border border-warm-200 bg-white/85 px-3 py-2 text-warm-950 shadow-sm">
              <span className="font-bold">6 ay</span> abonelik + 24 ay hediye = <span className="font-bold">30 ay</span>
            </div>
            <div className="rounded-xl border border-brand-200 bg-white/85 px-3 py-2 text-brand-950 shadow-sm">
              <span className="font-bold">12 ay</span> abonelik + 48 ay hediye = <span className="font-bold">60 ay</span>
            </div>
            <div className="rounded-xl border border-paper-200 bg-white/85 px-3 py-2 text-paper-900 shadow-sm">
              Bitiş: <span className="font-bold">9 Eylül veya 500 öğretmen</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/kampanya"
            className="rounded-xl bg-warm-600 px-3 py-2 text-xs font-bold text-white hover:bg-warm-700"
          >
            Detayları gör
          </Link>
          <button
            type="button"
            onClick={() => {
              setDismissed(true);
              try {
                localStorage.setItem(STORAGE_KEY, "1");
              } catch {
                /* ignore */
              }
            }}
            className="rounded-xl border border-warm-200 bg-white px-3 py-2 text-xs font-semibold text-warm-900 hover:bg-warm-100"
          >
            Kapat
          </button>
        </div>
      </div>
    </section>
  );
}
