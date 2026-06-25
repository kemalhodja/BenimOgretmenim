"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

type PaymentsMeta = {
  paytrAvailable: boolean;
  message: string | null;
};

export function PaymentMethodsBanner() {
  const [meta, setMeta] = useState<PaymentsMeta | null>(null);

  useEffect(() => {
    apiFetch<PaymentsMeta>("/v1/meta/payments")
      .then(setMeta)
      .catch(() => setMeta(null));
  }, []);

  if (!meta || meta.paytrAvailable) return null;

  return (
    <div
      className="rounded-xl border border-warm-200 bg-warm-50/80 px-4 py-3 text-sm text-paper-900"
      data-testid="payment-methods-banner"
    >
      <p className="font-medium text-paper-950">Kartla ödeme şu an kapalı</p>
      <p className="mt-1 text-paper-800/75">
        {meta.message ?? "Havale/EFT veya destek ile devam edebilirsiniz."}{" "}
        <Link href="/iade" className="font-medium text-brand-800 underline">
          İade politikası
        </Link>
        {" · "}
        <Link href="/itiraz" className="font-medium text-brand-800 underline">
          Destek / itiraz
        </Link>
      </p>
    </div>
  );
}
