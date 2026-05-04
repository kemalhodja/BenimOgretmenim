import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "İletişim",
  description: "BenimÖğretmenim ile iletişim bilgileri.",
};

export default function IletisimPage() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <p className="text-sm font-medium text-zinc-500">Site</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">İletişim</h1>
      <p className="mt-4 text-sm text-zinc-600">
        Destek ve iş birliği için aşağıdaki kanalları kullanın.
      </p>
      <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="font-medium text-zinc-900">E-posta</dt>
            <dd className="mt-1 text-zinc-600">
              <span className="font-mono text-zinc-500">destek@benimogretmenim.com</span>{" "}
              <span className="text-xs text-zinc-500">(örnek adres)</span>
            </dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-900">Çalışma saatleri</dt>
            <dd className="mt-1 text-zinc-600">Hafta içi 10:00–18:00 (GMT+3)</dd>
          </div>
        </dl>
      </div>
      <p className="mt-8 text-sm">
        <Link href="/yardim" className="text-brand-800 underline">
          Yardım sayfası
        </Link>
        {" · "}
        <Link href="/" className="text-brand-800 underline">
          Ana sayfa
        </Link>
      </p>
    </article>
  );
}
