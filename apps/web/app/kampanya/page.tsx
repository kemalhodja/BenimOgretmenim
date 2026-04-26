import type { Metadata } from "next";
import Link from "next/link";
import { registerHrefWithReturn } from "../lib/authRedirect";

export const metadata: Metadata = {
  title: "Erken erişim kampanyası",
  description:
    "Erken erişime özel, sınırlı sayıda kullanıcıya özel teklif kampanyası.",
};

export default function KampanyaPage() {
  const subscribeAfterRegisterHref = registerHrefWithReturn("/teacher");
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5 text-sm text-brand-950">
          <div className="text-xs font-semibold uppercase tracking-wide text-brand-800">
            Erken erişim
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Size özel teklif hazır
          </h1>
          <p className="mt-3 leading-relaxed text-brand-900/90">
            Erken erişime özel sizin için oluşturulan teklifi görmek için kayıt
            olduktan sonra abonelik sayfası açılacaktır. Bu kampanya sınırlı
            sayıda kullanıcıya özel olarak yapılmıştır.
          </p>
          <div className="mt-4 rounded-xl border border-brand-200 bg-white/70 p-4 text-brand-950">
            <div className="text-xs font-semibold uppercase tracking-wide text-brand-800">
              Kampanya fiyatları
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              <li>
                <span className="font-semibold">12 ay</span> ·{" "}
                <span className="font-mono text-zinc-500 line-through">12.000 TL</span>{" "}
                <span className="font-mono font-semibold">2500 TL</span> ·{" "}
                <span className="text-brand-900/80">
                  +24 ay hediye (toplam 36 ay)
                </span>
              </li>
              <li>
                <span className="font-semibold">6 ay</span> ·{" "}
                <span className="font-mono text-zinc-500 line-through">7.500 TL</span>{" "}
                <span className="font-mono font-semibold">1750 TL</span> ·{" "}
                <span className="text-brand-900/80">
                  +12 ay hediye (toplam 18 ay)
                </span>
              </li>
            </ul>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={subscribeAfterRegisterHref}
              className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-800"
            >
              Kayıt ol ve teklifi gör
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-sm font-medium text-brand-950"
            >
              Zaten hesabım var
            </Link>
          </div>
        </div>

        <div className="mt-8 text-sm text-zinc-600">
          <Link href="/" className="text-brand-800 underline">
            Ana sayfa
          </Link>
          {" · "}
          <Link href="/fiyatlar" className="text-brand-800 underline">
            Abonelik fiyatları
          </Link>
        </div>
      </div>
    </div>
  );
}

