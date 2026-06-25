"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getCachedRole, getRoleFromToken, getToken, panelNavLabel, panelPathForRole, refreshSessionFromServer } from "../lib/auth";

/** Kısa liste: keşif + yardım. Panel yalnızca oturum açıkken gösterilir; giriş header'da. */
const NAV_PUBLIC = [
  { href: "/#nasil", label: "Nasıl işler?" },
  { href: "/ogretmenler", label: "Öğretmen ara" },
  { href: "/courses", label: "Kurslar" },
  { href: "/roller", label: "Roller" },
  { href: "/guven", label: "Güven" },
] as const;

const NAV_AUTH = [{ href: "/fiyatlar", label: "Fiyatlar" }] as const;

type Variant = "desktop" | "mobile";

export function SiteNavLinks({ variant }: { variant: Variant }) {
  const pathname = usePathname() ?? "";
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [sessionRole, setSessionRole] = useState(() => getCachedRole());

  const sync = useCallback(() => {
    setToken(getToken());
    setSessionRole(getCachedRole());
  }, []);

  useEffect(() => {
    let alive = true;
    setMounted(true);
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

  const role = mounted ? getRoleFromToken(token) ?? sessionRole : null;
  const panelHref = role ? panelPathForRole(role) : null;
  const panelLabel = role ? panelNavLabel(role) : null;
  const loggedIn = Boolean(token || sessionRole);
  const navPublic = loggedIn ? NAV_PUBLIC.filter((item) => item.href !== "/roller") : NAV_PUBLIC;
  const navItems = loggedIn ? [...navPublic, ...NAV_AUTH] : navPublic;

  const deskCls =
    "rounded-lg px-2.5 py-1.5 text-sm font-medium text-paper-800/80 transition hover:bg-paper-100 hover:text-paper-900";
  const mobCls = "shrink-0 rounded-md px-2 py-1 text-paper-800/85 hover:bg-paper-100";

  if (!mounted) {
    const n = NAV_PUBLIC.length + NAV_AUTH.length;
    return (
      <>
        {Array.from({ length: n }).map((_, i) => (
          <span
            key={i}
            className={
              variant === "desktop"
                ? "inline-block h-8 w-14 shrink-0 rounded-lg bg-paper-200/60"
                : "inline-block h-6 w-12 shrink-0 rounded-md bg-paper-200/60"
            }
            aria-hidden
          />
        ))}
      </>
    );
  }

  if (variant === "desktop") {
    return (
      <>
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className={deskCls}>
            {item.label}
          </Link>
        ))}
        {panelHref && panelLabel ? (
          <Link href={panelHref} className={deskCls}>
            {panelLabel}
          </Link>
        ) : null}
      </>
    );
  }

  return (
    <>
      {navItems.map((item) => (
        <Link key={item.href} href={item.href} className={mobCls}>
          {item.label}
        </Link>
      ))}
      {panelHref && panelLabel ? (
        <Link href={panelHref} className={`${mobCls} font-medium text-brand-900`}>
          {panelLabel}
        </Link>
      ) : null}
    </>
  );
}
