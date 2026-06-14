"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getCachedRole, getToken, refreshSessionFromServer } from "../lib/auth";
import { loginHrefWithReturn } from "../lib/authRedirect";

type Props = {
  path: string;
  className?: string;
  children: React.ReactNode;
};

/** Oturum yoksa giriş sayfasına `returnUrl` ile yönlendirir; varsa doğrudan `path`. */
export function AuthEntryLink({ path, className, children }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [hasCookieSession, setHasCookieSession] = useState(() => Boolean(getCachedRole()));

  const sync = useCallback(() => {
    setToken(getToken());
    setHasCookieSession(Boolean(getCachedRole()));
  }, []);

  useEffect(() => {
    let alive = true;
    sync();
    void refreshSessionFromServer().then((role) => {
      if (alive) setHasCookieSession(Boolean(role ?? getCachedRole()));
    });
    const on = () => sync();
    window.addEventListener("bo:auth-changed", on);
    window.addEventListener("storage", on);
    return () => {
      alive = false;
      window.removeEventListener("bo:auth-changed", on);
      window.removeEventListener("storage", on);
    };
  }, [sync]);

  const href = token || hasCookieSession ? path : loginHrefWithReturn(path);

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
