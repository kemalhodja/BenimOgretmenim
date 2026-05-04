"use client";

import Link from "next/link";
import { BrandLockup } from "./BrandLockup";
import { HeaderAuthActions } from "./HeaderAuthActions";

const nav = [
  { href: "/teacher", label: "Özet" },
  { href: "/teacher/requests", label: "Talepler" },
  { href: "/teacher/teklifler", label: "Teklifler" },
  { href: "/teacher/dersler", label: "Dersler" },
  { href: "/teacher/kurslar", label: "Kurslarım" },
  { href: "/teacher/grup-dersler", label: "Grup ders" },
  { href: "/teacher/dogrudan-dersler", label: "Doğrudan ders" },
  { href: "/teacher/odev-havuzu", label: "Ödev havuzu" },
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
      <Link href="/" className={className + " text-paper-800/55"}>
        Ana site
      </Link>
    </>
  );
}

export function TeacherPanelHeader() {
  const linkDesk =
    "rounded-lg px-2.5 py-1.5 text-sm font-medium text-paper-800/80 transition hover:bg-paper-100/80 hover:text-paper-900";
  const linkMob = "shrink-0 rounded-md px-2 py-1 text-paper-800/85 hover:bg-paper-100/80";

  return (
    <header className="sticky top-0 z-40 border-b border-paper-200/80 bg-paper-50/95 shadow-[0_1px_0_0_rgb(0_0_0/0.04)] backdrop-blur-md">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <Link href="/teacher" className="min-w-0 shrink no-underline" title="Öğretmen özeti">
          <BrandLockup asLink={false} className="max-sm:max-w-[min(70vw,16rem)]" />
        </Link>
        <nav className="hidden flex-1 items-center justify-center gap-0.5 lg:flex">
          <NavLinks className={linkDesk} />
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <HeaderAuthActions />
        </div>
      </div>
      <nav className="border-t border-paper-200/70 px-2 py-1.5 lg:hidden">
        <div className="flex w-full gap-1 overflow-x-auto text-xs">
          <NavLinks className={linkMob} />
        </div>
      </nav>
    </header>
  );
}
