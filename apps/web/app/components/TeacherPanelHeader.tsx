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

/** Grup ve doğrudan anlaşmalar özet / ilgili sayfalardan; üst menüde çekirdek işler. */
const nav = [
  { href: "/teacher", label: "Özet" },
  { href: "/teacher/requests", label: "Talepler" },
  { href: "/teacher/teklifler", label: "Teklifler" },
  { href: "/teacher/dersler", label: "Dersler" },
  { href: "/teacher/kurslar", label: "Kurslar" },
  { href: "/teacher/odev-havuzu", label: "Ödev" },
  { href: "/teacher/cuzdan", label: "Cüzdan" },
  { href: "/teacher/edit", label: "Profil" },
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

export function TeacherPanelHeader() {
  return (
    <header className={panelHeaderBar}>
      <div className="mx-auto flex min-h-[4rem] max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <Link href="/teacher" className="min-w-0 shrink no-underline" title="Öğretmen özeti">
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
