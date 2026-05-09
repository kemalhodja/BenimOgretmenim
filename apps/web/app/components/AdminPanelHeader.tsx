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

/** Kısa menü; ayrıntılı modüller /admin/merkez üzerinden. */
const nav = [
  { href: "/admin/merkez", label: "Merkez" },
  { href: "/admin/users", label: "Kullanıcılar" },
  { href: "/admin/teachers", label: "Öğretmenler" },
  { href: "/admin/requests", label: "Talepler" },
  { href: "/admin/support", label: "Destek" },
  { href: "/admin/wallet", label: "Cüzdan" },
  { href: "/yardim", label: "Yardım" },
] as const;

export function AdminPanelHeader() {
  return (
    <header className={panelHeaderBar}>
      <div className="mx-auto flex min-h-[4rem] max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <Link href="/admin/merkez" className="min-w-0 shrink no-underline" title="Kontrol merkezi">
          <BrandLockup asLink={false} className="max-sm:max-w-[min(90vw,22rem)]" />
        </Link>
        <nav className="hidden flex-1 flex-wrap items-center justify-center gap-x-0.5 gap-y-1 lg:flex">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className={panelNavLinkDesk}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <HeaderAuthActions />
        </div>
      </div>
      <nav className={`flex ${panelNavSubrow} lg:hidden`}>
        <div className="flex w-full gap-1 overflow-x-auto text-xs">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className={panelNavLinkMob}>
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
