"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { clearToken, getToken } from "../lib/auth";
import { loginHrefWithReturn } from "../lib/authRedirect";

type MeResponse = {
  user: { email: string; role: string };
  account: {
    status: string;
    suspensionReason: string | null;
    suspendedAt: string | null;
  };
};

export default function HesapAskidaPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [router, pathname]);

  useEffect(() => {
    if (!token) return;
    apiFetch<MeResponse>("/v1/auth/me", { token })
      .then((r) => {
        setMe(r);
        if (r.account.status === "active") {
          router.replace("/panel");
        }
      })
      .catch((e) => {
        const m = e instanceof Error ? e.message : "yüklenemedi";
        if (m.includes("[401]")) {
          clearToken();
          router.replace(loginHrefWithReturn(pathname));
          return;
        }
        setError(m);
      });
  }, [token, router, pathname]);

  if (!token) return null;

  const reason = me?.account.suspensionReason ?? "Hesabınız geçici olarak kısıtlandı.";
  const suspendedAt = me?.account.suspendedAt
    ? new Date(me.account.suspendedAt).toLocaleString("tr-TR")
    : null;

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-amber-950">Hesabınız askıya alındı</h1>
          <p className="mt-3 text-sm leading-relaxed text-amber-900/85">{reason}</p>
          {suspendedAt ? (
            <p className="mt-2 text-xs text-amber-900/60">Tarih: {suspendedAt}</p>
          ) : null}
        </div>

        <div className="mt-8 rounded-2xl border border-paper-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-paper-900">Ne yapabilirsiniz?</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-paper-800/80">
            <li>
              Bu kararın hatalı olduğunu düşünüyorsanız{" "}
              <Link href="/itiraz" className="font-medium text-brand-800 underline">
                itiraz kaydı
              </Link>{" "}
              açın.
            </li>
            <li>
              Destek için{" "}
              <Link href="/iletisim" className="font-medium text-brand-800 underline">
                iletişim
              </Link>{" "}
              formunu kullanın.
            </li>
            <li>Hesap silme talebi için giriş yaptıktan sonra ayarlar sayfasına gidebilirsiniz.</li>
          </ul>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/itiraz"
            className="rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900"
          >
            İtiraz aç
          </Link>
          <Link
            href="/yardim"
            className="rounded-xl border border-paper-200 bg-white px-4 py-2 text-sm font-semibold text-paper-900"
          >
            Yardım
          </Link>
        </div>
      </div>
    </div>
  );
}
