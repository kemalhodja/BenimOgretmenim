import type { Metadata } from "next";
import Link from "next/link";
import { registerHrefWithReturn } from "../lib/authRedirect";

export const metadata: Metadata = {
  title: "Kampanya",
  description: "Öğretmen aboneliği kampanya fiyatları.",
};

export default function KampanyaPage() {
  const subscribeAfterRegisterHref = registerHrefWithReturn("/teacher");
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-6 text-sm text-brand-950 shadow-sm">
          <p className="text-sm font-medium text-brand-900/70">Site</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Abonelik fiyatları</h1>
          <p className="mt-3 text-brand-900/90">
            Kayıt sonrası öğretmen panelinde abonelik adımından kampanyayı görebilirsiniz.
          </p>
          <div className="mt-4 rounded-xl border border-brand-200 bg-white/70 p-4 text-brand-950">
            <div className="text-xs font-semibold uppercase tracking-wide text-brand-800">
              Paketler
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
              Kayıt ol
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

