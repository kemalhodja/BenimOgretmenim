"use client";

import Link from "next/link";
import { BrandLockup } from "./BrandLockup";
import { HeaderAuthActions } from "./HeaderAuthActions";

export function GuardianPanelHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-brand-200/35 bg-paper-50/90 shadow-[0_8px_32px_-8px_rgb(14_184_212/0.16),0_1px_0_0_rgb(242_100_58/0.09)] backdrop-blur-md">
      <div className="mx-auto flex min-h-20 max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/guardian" className="min-w-0 shrink no-underline" title="Veli paneli">
          <BrandLockup asLink={false} className="max-sm:max-w-[min(90vw,22rem)]" />
        </Link>
        <nav className="hidden items-center gap-2 md:flex">
          <span className="rounded-lg bg-paper-100/90 px-3 py-1.5 text-sm font-medium text-paper-800">
            Veli görünümü
          </span>
          <Link
            href="/yardim"
            className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-paper-800/80 hover:bg-paper-100/80"
          >
            Yardım
          </Link>
          <Link
            href="/"
            className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-paper-800/60 hover:bg-paper-100/80"
          >
            Ana site
          </Link>
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <HeaderAuthActions />
        </div>
      </div>
      <nav className="flex border-t border-paper-200/70 px-2 py-1.5 md:hidden">
        <div className="flex w-full gap-2 overflow-x-auto text-xs">
          <Link href="/yardim" className="shrink-0 rounded-md px-2 py-1 text-paper-800/85 hover:bg-paper-100/80">
            Yardım
          </Link>
          <Link href="/" className="shrink-0 rounded-md px-2 py-1 text-paper-800/55 hover:bg-paper-100/80">
            Ana site
          </Link>
        </div>
      </nav>
    </header>
  );
}
