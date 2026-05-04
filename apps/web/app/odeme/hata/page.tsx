"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function OdemeHataPage() {
  const sp = useSearchParams();
  const reason =
    sp.get("failed_reason_msg") ?? sp.get("reason") ?? undefined;

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-16">
      <div className="mx-auto max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-zinc-500">Ödeme</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-red-900">Ödeme tamamlanamadı</h1>
        <p className="mt-3 text-sm text-zinc-600">
          İşlem iptal edildi veya banka / kart doğrulaması başarısız oldu. PayTR ile tekrar deneyebilir veya
          öğretmen aboneliğinde havale / EFT seçeneğini kullanabilirsiniz.
        </p>
        {reason && (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {reason}
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
