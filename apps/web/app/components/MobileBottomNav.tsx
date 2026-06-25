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
  icon?: IconName;
  match?: (pathname: string, searchParams: URLSearchParams) => boolean;
  primary?: boolean;
};

type IconName = "home" | "requests" | "lessons" | "wallet" | "profile" | "menu";

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
      { href: "/student/ders-videolari", label: "Videolar", shortLabel: "Video" },
      { href: "/student/kurslar", label: "Kurslar" },
      { href: "/student/odev-sor", label: "Ödev" },
    ];
  }
  if (effective === "teacher") {
    return [
      {
        href: "/teacher/requests",
        label: "Talepler",
        ariaLabel: "Öğretmen ders talepleri",
        icon: "requests",
        match: (p) => starts(p, "/teacher/requests") || starts(p, "/teacher/teklifler"),
      },
      { href: "/teacher/dersler", label: "Dersler", ariaLabel: "Öğretmen dersleri", icon: "lessons", primary: true },
      { href: "/teacher/edit", label: "Profil", ariaLabel: "Öğretmen profili", icon: "profile" },
      { href: "/teacher/cuzdan", label: "Cüzdan", ariaLabel: "Öğretmen cüzdanı", icon: "wallet" },
      {
        href: "/teacher",
        label: "Menü",
        ariaLabel: "Öğretmen menüsü",
        icon: "menu",
        match: (p) =>
          p === "/teacher" ||
          starts(p, "/teacher/kurslar") ||
          starts(p, "/teacher/ders-videolari") ||
          starts(p, "/teacher/kampanyalar") ||
          starts(p, "/teacher/odev-havuzu") ||
          starts(p, "/teacher/dogrudan-dersler") ||
          starts(p, "/teacher/grup-dersler"),
      },
    ];
  }
  if (effective === "guardian") {
    return [
      { href: "/guardian", label: "Özet" },
      { href: "/guardian/requests", label: "İlanlar", primary: true },
      { href: "/guardian/ders-videolari", label: "Videolar", shortLabel: "Video" },
      { href: "/student/kurslar", label: "Kurslar" },
      { href: "/ogretmenler", label: "Öğretmen", shortLabel: "Öğret" },
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
        label: "İtirazlar",
        match: (p, q) => starts(p, "/admin/veri") && q.get("k") === "disputes",
      },
      { href: "/admin/support", label: "Destek" },
    ];
  }
  return [
    { href: "/", label: "Ana" },
    { href: "/ogretmenler", label: "Öğretmen", shortLabel: "Öğret" },
    { href: "/courses", label: "Kurslar", primary: true },
    { href: "/roller", label: "Roller" },
    {
      href: pathname === "/kayit" ? loginHrefWithReturn(pathname) : registerHrefWithReturn(pathname),
      label: "Başla",
    },
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

function BottomNavIcon({ name, active, primary }: { name: IconName; active: boolean; primary: boolean }) {
  const stroke = primary ? "text-white" : active ? "text-brand-800" : "text-paper-800/65";
  const common = {
    className: `h-5 w-5 ${stroke}`,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "requests") {
    return (
      <svg {...common}>
        <path d="M7 8h10" />
        <path d="M7 12h6" />
        <path d="M5 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-4 3Z" />
      </svg>
    );
  }
  if (name === "lessons") {
    return (
      <svg {...common}>
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" />
        <path d="M8 7h8" />
        <path d="M8 11h6" />
      </svg>
    );
  }
  if (name === "profile") {
    return (
      <svg {...common}>
        <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    );
  }
  if (name === "wallet") {
    return (
      <svg {...common}>
        <path d="M4 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3H6a2 2 0 0 0 0 4h14v5a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V7Z" />
        <path d="M17 13h3V9h-3a2 2 0 0 0 0 4Z" />
      </svg>
    );
  }
  if (name === "menu") {
    return (
      <svg {...common}>
        <path d="M4 6h16" />
        <path d="M4 12h16" />
        <path d="M4 18h16" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M9 20v-6h6v6" />
    </svg>
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
                "relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl px-1.5 text-center text-[11px] font-semibold leading-tight transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
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
              {item.icon ? <BottomNavIcon name={item.icon} active={active} primary={Boolean(item.primary)} /> : null}
              <span className="block max-w-full truncate pt-0.5">{item.shortLabel ?? item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
