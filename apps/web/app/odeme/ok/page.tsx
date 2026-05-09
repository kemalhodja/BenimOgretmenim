"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AuthEntryLink } from "../../components/AuthEntryLink";

function OdemeOkInner() {
  const sp = useSearchParams();
  const oid = sp.get("merchant_oid");

  return (
    <div className="min-h-screen bg-paper-50 px-6 py-16">
      <div className="mx-auto max-w-md rounded-xl border border-paper-200 bg-white p-8 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-paper-900">Ödeme tamamlandı</h1>
        <p className="mt-3 text-sm text-paper-800/75">
          İşlem onaylandıysa birkaç saniye içinde panele yansır.
        </p>
        {oid && (
          <p className="mt-4 font-mono text-xs text-paper-800/55">
            Sipariş ref: {oid}
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

export default function OdemeOkPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-paper-50 px-6 py-16">
          <div className="mx-auto max-w-md rounded-xl border border-paper-200 bg-white p-8 text-center">
            <p className="text-sm text-paper-800/55">Yükleniyor…</p>
          </div>
        </div>
      }
    >
      <OdemeOkInner />
    </Suspense>
  );
}
