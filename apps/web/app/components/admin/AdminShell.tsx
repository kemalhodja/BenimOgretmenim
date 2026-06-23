"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ADMIN_HOME, ADMIN_MERKEZ, navSectionsForScope } from "../../lib/adminRegistry";
import { getAdminScopeFromSession } from "../../lib/auth";
import { AdminGate } from "../../admin/useRequireAdmin";

function navActive(pathname: string, href: string): boolean {
  const base = href.split("?")[0];
  if (base === ADMIN_HOME) return pathname === ADMIN_HOME;
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ADMIN_HOME;
  const [open, setOpen] = useState(false);
  const adminScope = getAdminScopeFromSession();
  const navSections = navSectionsForScope(adminScope);

  return (
    <AdminGate>
      <div className="min-h-screen bg-paper-50">
        <header className="sticky top-0 z-40 border-b border-paper-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Link href={ADMIN_HOME} className="shrink-0 text-sm font-semibold text-paper-900">
                Yönetim
              </Link>
              <Link
                href={ADMIN_MERKEZ}
                className={`hidden rounded-lg px-2.5 py-1.5 text-sm font-medium sm:inline-flex ${
                  navActive(pathname, ADMIN_MERKEZ)
                    ? "bg-brand-50 text-brand-900"
                    : "text-paper-800/75 hover:bg-paper-100"
                }`}
              >
                Kontrol merkezi
              </Link>
            </div>
            <button
              type="button"
              className="rounded-lg border border-paper-200 px-3 py-1.5 text-sm font-medium text-paper-900 sm:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
            >
              Menü
            </button>
            <nav className="hidden flex-wrap justify-end gap-1 sm:flex">
              {[
                { href: ADMIN_HOME, label: "Özet" },
                { href: "/admin/users", label: "Kullanıcılar" },
                { href: "/admin/teachers", label: "Öğretmenler" },
                { href: "/admin/bank", label: "Havale" },
                { href: "/admin/payments", label: "Ödemeler" },
                { href: "/admin/wallet", label: "Cüzdan" },
                { href: "/admin/support", label: "Destek" },
                { href: ADMIN_MERKEZ, label: "Merkez" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-2.5 py-1.5 text-sm font-medium ${
                    navActive(pathname, item.href)
                      ? "bg-brand-50 text-brand-900"
                      : "text-paper-800/75 hover:bg-paper-100"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          {open ? (
            <div className="border-t border-paper-100 px-4 py-3 sm:hidden">
              <div className="space-y-4">
                {navSections.map((section) => (
                  <div key={section.title}>
                    <div className="text-xs font-semibold uppercase tracking-wide text-paper-800/50">
                      {section.title}
                    </div>
                    <ul className="mt-2 space-y-1">
                      {section.items.map((item) => (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            className="block rounded-md px-2 py-1.5 text-sm text-paper-900 hover:bg-paper-100"
                            onClick={() => setOpen(false)}
                          >
                            {item.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </header>
        {children}
      </div>
    </AdminGate>
  );
}
