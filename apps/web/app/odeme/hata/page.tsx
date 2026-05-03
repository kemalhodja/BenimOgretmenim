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
        <div className="text-lg font-semibold text-red-800">Ödeme tamamlanamadı</div>
        <p className="mt-3 text-sm text-zinc-600">
          İşlem iptal edildi veya banka / kart doğrulaması başarısız oldu.
          PayTR ile farklı bir kart deneyebilir veya öğretmen aboneliğinde doğrudan
          havale / EFT seçeneğini kullanabilirsiniz.
        </p>
        {reason && (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {reason}
          </p>
        )}
        <Link
          href="/teacher"
          className="mt-8 inline-flex rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white"
        >
          Öğretmen paneline dön
        </Link>
        <div className="mt-4">
          <Link href="/" className="text-sm text-zinc-500 underline">
            Ana sayfa
          </Link>
        </div>
      </div>
    </div>
  );
}
