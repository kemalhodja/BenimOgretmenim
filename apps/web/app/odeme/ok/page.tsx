"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  getCachedRole,
  getRoleFromToken,
  getToken,
  refreshSessionFromServer,
  type UserRole,
} from "../../lib/auth";
import { postPaymentOkActions } from "../../lib/pageQuickStart";

function OdemeOkInner() {
  const sp = useSearchParams();
  const oid = sp.get("merchant_oid");
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    let alive = true;
    const sync = async () => {
      const token = getToken();
      const resolved = getRoleFromToken(token) ?? getCachedRole() ?? (await refreshSessionFromServer());
      if (alive) setRole(resolved);
    };
    void sync();
    return () => {
      alive = false;
    };
  }, []);

  const actions = postPaymentOkActions(role);

  return (
    <div className="min-h-screen bg-paper-50 px-6 py-16">
      <div className="mx-auto max-w-md rounded-xl border border-paper-200 bg-white p-8 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-paper-900">Ödeme tamamlandı</h1>
        <p className="mt-3 text-sm text-paper-800/75">{actions.hint}</p>
        {oid && (
          <p className="mt-4 font-mono text-xs text-paper-800/55">
            Sipariş ref: {oid}
          </p>
        )}
        <div className="mt-8 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <Link
            href={actions.primary.href}
            className="inline-flex rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-900"
          >
            {actions.primary.label}
          </Link>
          <Link
            href={actions.secondary.href}
            className="inline-flex rounded-xl border border-paper-300 bg-white px-4 py-2.5 text-sm font-medium text-paper-900 hover:bg-paper-50"
          >
            {actions.secondary.label}
          </Link>
        </div>
        <Link href="/" className="mt-4 inline-flex text-sm text-paper-800/65 underline">
          Ana sayfa
        </Link>
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
