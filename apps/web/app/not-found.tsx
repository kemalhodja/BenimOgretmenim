import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sayfa bulunamadı",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold text-paper-900">Sayfa bulunamadı</h1>
      <p className="text-sm text-paper-700">
        Aradığınız adres taşınmış veya hiç var olmamış olabilir.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/"
          className="rounded-lg bg-paper-900 px-4 py-2 text-sm font-medium text-white hover:bg-paper-800"
        >
          Ana sayfa
        </Link>
        <Link
          href="/ogretmenler"
          className="rounded-lg border border-paper-300 bg-white px-4 py-2 text-sm font-medium text-paper-900 hover:bg-paper-50"
        >
          Öğretmen ara
        </Link>
      </div>
    </div>
  );
}
