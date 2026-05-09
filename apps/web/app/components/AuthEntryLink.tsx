"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getToken } from "../lib/auth";
import { loginHrefWithReturn } from "../lib/authRedirect";

type Props = {
  path: string;
  className?: string;
  children: React.ReactNode;
};

/** Oturum yoksa giriş sayfasına `returnUrl` ile yönlendirir; varsa doğrudan `path`. */
export function AuthEntryLink({ path, className, children }: Props) {
  const [token, setToken] = useState<string | null>(null);

  const sync = useCallback(() => setToken(getToken()), []);

  useEffect(() => {
    sync();
    const on = () => sync();
    window.addEventListener("bo:auth-changed", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("bo:auth-changed", on);
      window.removeEventListener("storage", on);
    };
  }, [sync]);

  const href = token ? path : loginHrefWithReturn(path);

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
