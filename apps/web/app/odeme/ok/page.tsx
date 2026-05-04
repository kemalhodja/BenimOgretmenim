"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function OdemeOkInner() {
  const sp = useSearchParams();
  const oid = sp.get("merchant_oid");

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-16">
      <div className="mx-auto max-w-md rounded-2xl border border-brand-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-zinc-500">Ödeme</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-brand-900">Ödeme tamamlandı</h1>
        <p className="mt-3 text-sm text-zinc-600">
          PayTR işleminiz başarıyla sonuçlandıysa ödeme birkaç saniye içinde onaylanır. İlgili panelden
          durumu kontrol edebilirsiniz.
        </p>
        {oid && (
          <p className="mt-4 font-mono text-xs text-zinc-500">
            Sipariş ref: {oid}
          </p>
        )}
        <div className="mt-8 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/panel"
            className="inline-flex rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white"
          >
            Panele git
          </Link>
          <Link
            href="/"
            className="inline-flex rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 shadow-sm"
          >
            Ana sayfa
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function OdemeOkPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-50 px-6 py-16">
          <div className="mx-auto max-w-md rounded-2xl border border-brand-200/80 bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-zinc-500">Yükleniyor…</p>
          </div>
        </div>
      }
    >
      <OdemeOkInner />
    </Suspense>
  );
}
