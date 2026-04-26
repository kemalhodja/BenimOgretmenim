"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function OdemeOkPage() {
  const sp = useSearchParams();
  const oid = sp.get("merchant_oid");

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-16">
      <div className="mx-auto max-w-md rounded-2xl border border-brand-200 bg-white p-8 text-center shadow-sm">
        <div className="text-lg font-semibold text-brand-800">Ödeme tamamlandı</div>
        <p className="mt-3 text-sm text-zinc-600">
          PayTR işleminiz başarıyla sonuçlandıysa ödeme birkaç saniye içinde
          onaylanır. Abonelik: öğretmen paneli; kurs: Kurslarım; cüzdan yükleme: öğrenci
          panelinden bakiyeyi yenileyin.
        </p>
        {oid && (
          <p className="mt-4 font-mono text-xs text-zinc-500">
            Sipariş ref: {oid}
          </p>
        )}
        <div className="mt-8 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/student/kurslar"
            className="inline-flex rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 shadow-sm"
          >
            Kurslarım
          </Link>
          <Link
            href="/teacher"
            className="inline-flex rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white"
          >
            Öğretmen paneli
          </Link>
        </div>
        <div className="mt-4">
          <Link href="/" className="text-sm text-zinc-500 underline">
            Ana sayfa
          </Link>
        </div>
      </div>
    </div>
  );
}
