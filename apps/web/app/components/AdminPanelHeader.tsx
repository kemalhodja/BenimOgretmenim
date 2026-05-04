"use client";

import Link from "next/link";
import { BrandLockup } from "./BrandLockup";
import { HeaderAuthActions } from "./HeaderAuthActions";

export function AdminPanelHeader() {
  const link =
    "rounded-lg px-2.5 py-1.5 text-sm font-medium text-paper-800/80 transition hover:bg-paper-100/80 hover:text-paper-900";

  return (
    <header className="sticky top-0 z-40 border-b border-paper-200/80 bg-paper-50/95 shadow-[0_1px_0_0_rgb(0_0_0/0.04)] backdrop-blur-md">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <Link href="/admin/merkez" className="min-w-0 shrink no-underline" title="Yönetim merkezi">
          <BrandLockup asLink={false} className="max-sm:max-w-[min(70vw,16rem)]" />
        </Link>
        <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
          <Link href="/admin/merkez" className={link}>
            Merkez
          </Link>
          <Link href="/admin" className={link}>
            Özet
          </Link>
          <Link href="/admin/users" className={link}>
            Kullanıcılar
          </Link>
          <Link href="/admin/teachers" className={link}>
            Öğretmenler
          </Link>
          <Link href="/admin/requests" className={link}>
            Talepler
          </Link>
          <Link href="/admin/courses" className={link}>
            Kurslar
          </Link>
          <Link href="/admin/payments" className={link}>
            Ödemeler
          </Link>
          <Link href="/admin/bank" className={link}>
            Havale
          </Link>
          <Link href="/admin/wallet" className={link}>
            Cüzdan
          </Link>
          <Link href="/yardim" className={link}>
            Yardım
          </Link>
          <Link href="/" className={link + " text-paper-800/55"}>
            Ana site
          </Link>
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <HeaderAuthActions />
        </div>
      </div>
      <nav className="flex border-t border-paper-200/70 px-2 py-1.5 md:hidden">
        <div className="flex w-full gap-1 overflow-x-auto text-xs">
          <Link href="/admin/merkez" className="shrink-0 rounded-md px-2 py-1 hover:bg-paper-100/80">
            Merkez
          </Link>
          <Link href="/admin" className="shrink-0 rounded-md px-2 py-1 hover:bg-paper-100/80">
            Özet
          </Link>
          <Link href="/admin/users" className="shrink-0 rounded-md px-2 py-1 hover:bg-paper-100/80">
            Kullanıcı
          </Link>
          <Link href="/admin/teachers" className="shrink-0 rounded-md px-2 py-1 hover:bg-paper-100/80">
            Öğretmen
          </Link>
          <Link href="/admin/requests" className="shrink-0 rounded-md px-2 py-1 hover:bg-paper-100/80">
            Talep
          </Link>
          <Link href="/admin/courses" className="shrink-0 rounded-md px-2 py-1 hover:bg-paper-100/80">
            Kurs
          </Link>
          <Link href="/admin/payments" className="shrink-0 rounded-md px-2 py-1 hover:bg-paper-100/80">
            Ödeme
          </Link>
          <Link href="/admin/bank" className="shrink-0 rounded-md px-2 py-1 hover:bg-paper-100/80">
            Havale
          </Link>
          <Link href="/admin/wallet" className="shrink-0 rounded-md px-2 py-1 hover:bg-paper-100/80">
            Cüzdan
          </Link>
          <Link href="/" className="shrink-0 rounded-md px-2 py-1 text-paper-800/55 hover:bg-paper-100/80">
            Ana site
          </Link>
        </div>
      </nav>
    </header>
  );
}
