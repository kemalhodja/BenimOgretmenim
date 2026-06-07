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
    <section className="border-b border-warm-200 bg-warm-50" aria-label="Erken erişim kampanyası">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-warm-800">
            Erken erişim kampanyası · 9 Eylül
          </div>
          <p className="mt-1 text-sm leading-relaxed text-warm-950">
            Erken erişimde fiyatlar değişmedi. Öğretmen aboneliğinde aldığınız sürenin{" "}
            <span className="font-bold">4 katı hediye</span>; 1750 TL için{" "}
            <span className="line-through text-warm-900/55">14.000 TL</span>, 2500 TL için{" "}
            <span className="line-through text-warm-900/55">20.000 TL</span> liste referansı.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/kampanya"
            className="rounded-xl bg-warm-600 px-3 py-2 text-xs font-bold text-white hover:bg-warm-700"
          >
            Kampanyayı gör
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
