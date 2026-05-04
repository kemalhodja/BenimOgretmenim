"use client";

import Link from "next/link";

export function GuardianPanelFooter() {
  const api = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3002";

  return (
    <footer className="mt-auto border-t border-paper-200/80 bg-paper-100/40">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="text-xs font-semibold uppercase tracking-wide text-paper-800/60">
          Veli alanı
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-paper-800/90">
          <li>
            <Link href="/guardian" className="hover:underline">
              Özet
            </Link>
          </li>
          <li>
            <Link href="/yardim" className="hover:underline">
              Yardım
            </Link>
          </li>
          <li>
            <Link href="/iletisim" className="hover:underline">
              İletişim
            </Link>
          </li>
          <li>
            <Link href="/" className="hover:underline">
              Ana sayfa (site)
            </Link>
          </li>
        </ul>
        <div className="mt-6 flex flex-col gap-2 border-t border-paper-200/80 pt-6 text-xs text-paper-800/60 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} BenimÖğretmenim · veli alanı</span>
          <span className="font-mono text-[10px] text-paper-800/45">API: {api}</span>
        </div>
      </div>
    </footer>
  );
}
