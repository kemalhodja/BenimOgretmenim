"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getRoleFromToken, getToken, panelNavLabel, panelPathForRole } from "../lib/auth";

const COMMON_BEFORE_PANEL = [
  { href: "/ogretmenler", label: "Öğretmen ara" },
  { href: "/#nasil", label: "Nasıl çalışır?" },
] as const;

const COMMON_AFTER_PANEL = [
  { href: "/courses", label: "Kurslar" },
  { href: "/fiyatlar", label: "Fiyatlar" },
  { href: "/iletisim", label: "İletişim" },
] as const;

type Variant = "desktop" | "mobile";

export function SiteNavLinks({ variant }: { variant: Variant }) {
  const pathname = usePathname() ?? "";
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const sync = useCallback(() => {
    setToken(getToken());
  }, []);

  useEffect(() => {
    setMounted(true);
    sync();
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

  const role = mounted ? getRoleFromToken(token) : null;
  const panelHref = role ? panelPathForRole(role) : "/panel";
  const panelLabel = role ? panelNavLabel(role) : "Panel";

  if (!mounted) {
    if (variant === "desktop") {
      return (
        <>
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              className="inline-block h-8 w-14 shrink-0 rounded-lg bg-paper-200/60"
              aria-hidden
            />
          ))}
        </>
      );
    }
    return (
      <>
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className="inline-block h-6 w-12 shrink-0 rounded-md bg-paper-200/60"
            aria-hidden
          />
        ))}
      </>
    );
  }

  if (variant === "desktop") {
    return (
      <>
        {COMMON_BEFORE_PANEL.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-paper-800/75 transition hover:bg-paper-100/80 hover:text-paper-900"
          >
            {item.label}
          </Link>
        ))}
        <Link
          href={panelHref}
          className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-paper-800/75 transition hover:bg-paper-100/80 hover:text-paper-900"
        >
          {panelLabel}
        </Link>
        {COMMON_AFTER_PANEL.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-paper-800/75 transition hover:bg-paper-100/80 hover:text-paper-900"
          >
            {item.label}
          </Link>
        ))}
      </>
    );
  }

  return (
    <>
      {COMMON_BEFORE_PANEL.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="shrink-0 rounded-md px-2 py-1 text-paper-800/80 hover:bg-paper-100/80"
        >
          {item.label}
        </Link>
      ))}
      <Link
        href={panelHref}
        className="shrink-0 rounded-md px-2 py-1 font-medium text-brand-900 hover:bg-brand-50/80"
      >
        {panelLabel}
      </Link>
      {COMMON_AFTER_PANEL.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="shrink-0 rounded-md px-2 py-1 text-paper-800/80 hover:bg-paper-100/80"
        >
          {item.label}
        </Link>
      ))}
    </>
  );
}
