"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AuthEntryLink } from "../../components/AuthEntryLink";

function OdemeHataInner() {
  const sp = useSearchParams();
  const reason =
    sp.get("failed_reason_msg") ?? sp.get("reason") ?? undefined;

  return (
    <div className="min-h-screen bg-paper-50 px-6 py-16">
      <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-white p-8 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-red-900">Ödeme tamamlanamadı</h1>
        <p className="mt-3 text-sm text-paper-800/75">
          İşlem iptal veya doğrulama hatası olabilir. Tekrar deneyin veya havale / EFT seçeneğini kullanın.
        </p>
        {reason && (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {reason}
          </p>
        )}
        <div className="mt-8 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <AuthEntryLink
            path="/panel"
            className="inline-flex rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-900"
          >
            Panele git
          </AuthEntryLink>
          <Link
            href="/"
            className="inline-flex rounded-xl border border-paper-300 bg-white px-4 py-2.5 text-sm font-medium text-paper-900 hover:bg-paper-50"
          >
            Ana sayfa
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function OdemeHataPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-paper-50 px-6 py-16">
          <div className="mx-auto max-w-md rounded-xl border border-red-200/80 bg-white p-8 text-center">
            <p className="text-sm text-paper-800/55">Yükleniyor…</p>
          </div>
        </div>
      }
    >
      <OdemeHataInner />
    </Suspense>
  );
}
