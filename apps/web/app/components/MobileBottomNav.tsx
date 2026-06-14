"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getCachedRole, getRoleFromToken, getToken, refreshSessionFromServer, type UserRole } from "../lib/auth";
import { loginHrefWithReturn, registerHrefWithReturn } from "../lib/authRedirect";
import { panelModeForPath, type PanelMode } from "../lib/panelMode";

type Item = {
  href: string;
  label: string;
  shortLabel?: string;
  ariaLabel?: string;
  match?: (pathname: string, searchParams: URLSearchParams) => boolean;
  primary?: boolean;
};

function starts(pathname: string, href: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  const clean = href.split("?")[0].replace(/\/+$/, "") || "/";
  return path === clean || (clean !== "/" && path.startsWith(`${clean}/`));
}

function itemsFor(mode: PanelMode, role: UserRole | null, pathname: string): Item[] {
  const effective = mode === "marketing" ? role : mode;
  if (effective === "student") {
    return [
      { href: "/student/panel", label: "Özet" },
      { href: "/student/requests", label: "Talepler" },
      { href: "/student/calisma", label: "Çalışma", shortLabel: "Çalış", ariaLabel: "Çalışma planı", primary: true },
      { href: "/student/kurslar", label: "Kurslar" },
      { href: "/student/odev-sor", label: "Ödev" },
    ];
  }
  if (effective === "teacher") {
    return [
      { href: "/teacher", label: "Özet" },
      { href: "/teacher/requests", label: "Talepler" },
      { href: "/teacher/dersler", label: "Dersler", primary: true },
      { href: "/teacher/cuzdan", label: "Cüzdan" },
      { href: "/teacher/edit", label: "Profil" },
    ];
  }
  if (effective === "guardian") {
    return [
      { href: "/guardian", label: "Panel" },
      { href: "/guardian/requests", label: "İlanlar", primary: true },
      { href: "/student/kurslar", label: "Kurslar" },
      { href: "/ogretmenler", label: "Öğretmen", shortLabel: "Öğret" },
      { href: "/iletisim", label: "Destek" },
    ];
  }
  if (effective === "admin") {
    return [
      { href: "/admin/merkez", label: "Merkez", primary: true },
      { href: "/admin/courses", label: "Kurs" },
      {
        href: "/admin/veri?k=teacher-withdrawals",
        label: "Finans",
        match: (p, q) => starts(p, "/admin/veri") && q.get("k") === "teacher-withdrawals",
      },
      {
        href: "/admin/veri?k=disputes",
        label: "Dispute",
        match: (p, q) => starts(p, "/admin/veri") && q.get("k") === "disputes",
      },
      { href: "/admin/support", label: "Destek" },
    ];
  }
  return [
    { href: "/", label: "Ana" },
    { href: "/ogretmenler", label: "Öğretmen", shortLabel: "Öğret" },
    { href: "/courses", label: "Kurslar", primary: true },
    { href: "/fiyatlar", label: "Fiyat" },
    { href: pathname === "/kayit" ? loginHrefWithReturn(pathname) : registerHrefWithReturn(pathname), label: "Başla" },
  ];
}

function shouldHideMobileNav(pathname: string): boolean {
  return (
    pathname.startsWith("/classroom/") ||
    pathname === "/login" ||
    pathname === "/kayit" ||
    pathname.startsWith("/odeme/")
  );
}

export function MobileBottomNav() {
  const pathname = usePathname() ?? "/";
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [sessionRole, setSessionRole] = useState(() => getCachedRole());
  const [search, setSearch] = useState("");

  const sync = useCallback(() => {
    setToken(getToken());
    setSessionRole(getCachedRole());
  }, []);

  useEffect(() => {
    let alive = true;
    setMounted(true);
    setSearch(window.location.search);
    sync();
    void refreshSessionFromServer().then(() => {
      if (alive) sync();
    });
    return () => {
      alive = false;
    };
  }, [sync, pathname]);

  useEffect(() => {
    const on = () => sync();
    window.addEventListener("bo:auth-changed", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("bo:auth-changed", on);
      window.removeEventListener("storage", on);
    };
  }, [sync]);

  const mode = panelModeForPath(pathname);
  const role = mounted ? getRoleFromToken(token) ?? sessionRole : null;
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const items = useMemo(() => itemsFor(mode, role, pathname), [mode, pathname, role]);

  if (shouldHideMobileNav(pathname)) return null;

  return (
    <nav
      className="mobile-app-nav fixed inset-x-0 bottom-0 z-50 border-t border-paper-200 bg-white/95 px-2 pt-2 shadow-[0_-10px_30px_rgb(88_170_169/0.12)] backdrop-blur md:hidden"
      aria-label="Mobil hızlı gezinme"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 gap-1 pb-[max(0.65rem,env(safe-area-inset-bottom))]">
        {items.map((item) => {
          const active = item.match ? item.match(pathname, searchParams) : starts(pathname, item.href);
          return (
            <Link
              key={`${item.href}:${item.label}`}
              href={item.href}
              aria-label={item.ariaLabel ?? item.label}
              onClick={() => {
                const query = item.href.split("?")[1];
                setSearch(query ? `?${query}` : "");
              }}
              aria-current={active ? "page" : undefined}
              className={[
                "relative flex min-h-12 flex-col items-center justify-center rounded-2xl px-1.5 text-center text-[11px] font-semibold leading-tight transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                item.primary
                  ? "bg-brand-800 text-white shadow-sm shadow-brand-900/15"
                  : active
                    ? "bg-brand-50 text-brand-900 ring-1 ring-brand-100"
                    : "text-paper-800/70 hover:bg-paper-100 hover:text-paper-950",
              ].join(" ")}
            >
              {active ? (
                <span
                  className={item.primary ? "absolute top-1 h-1 w-5 rounded-full bg-white/80" : "absolute top-1 h-1 w-5 rounded-full bg-brand-700"}
                  aria-hidden
                />
              ) : null}
              <span className="block max-w-full truncate pt-1">{item.shortLabel ?? item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
