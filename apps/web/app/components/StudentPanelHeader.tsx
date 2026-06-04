"use client";

import Link from "next/link";
import { BrandLockup } from "./BrandLockup";
import { HeaderAuthActions } from "./HeaderAuthActions";
import {
  panelHeaderBar,
  panelNavLinkDesk,
  panelNavLinkMob,
  panelNavSubrow,
} from "./panelChrome";

/**
 * Çekirdek akışlar. Grup / katalog / öğretmen arama: vitrin footer veya özet sayfasından.
 */
const nav = [
  { href: "/student/panel", label: "Özet" },
  { href: "/student/requests", label: "Talepler" },
  { href: "/student/dersler", label: "Dersler" },
  { href: "/student/calisma", label: "Çalışma" },
  { href: "/student/kurslar", label: "Kurslar" },
  { href: "/student/odev-sor", label: "Ödev" },
  { href: "/student/dogrudan-dersler", label: "Doğrudan" },
  { href: "/student/grup-dersler", label: "Grup" },
] as const;

function NavLinks({ className }: { className: string }) {
  return (
    <>
      {nav.map((item) => (
        <Link key={item.href} href={item.href} className={className}>
          {item.label}
        </Link>
      ))}
    </>
  );
}

export function StudentPanelHeader() {
  return (
    <header className={panelHeaderBar}>
      <div className="mx-auto flex min-h-[4rem] max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <Link href="/student/panel" className="min-w-0 shrink no-underline" title="Öğrenci özeti">
          <BrandLockup asLink={false} className="max-sm:max-w-[min(90vw,22rem)]" />
        </Link>
        <nav className="hidden flex-1 items-center justify-center gap-0.5 lg:flex">
          <NavLinks className={panelNavLinkDesk} />
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <HeaderAuthActions />
        </div>
      </div>
      <nav className={`${panelNavSubrow} lg:hidden`}>
        <div className="flex w-full gap-1 overflow-x-auto text-xs">
          <NavLinks className={panelNavLinkMob} />
        </div>
      </nav>
    </header>
  );
}
